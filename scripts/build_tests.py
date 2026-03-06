#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

ROOT_DIR = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT_DIR / "Тести БЗВП створення"
OUT_FILE = ROOT_DIR / "data" / "tests.json"


@dataclass
class Cell:
    value: str
    style: int


def normalize_target(target: str) -> str:
    target = target.replace("\\", "/")
    if target.startswith("/"):
        target = target[1:]
    if not target.startswith("xl/"):
        target = f"xl/{target}"
    return target


def get_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    out: List[str] = []
    for si in root.findall("x:si", NS):
        text = "".join(node.text or "" for node in si.findall(".//x:t", NS)).strip()
        out.append(text)
    return out


def get_style_maps(zf: zipfile.ZipFile) -> tuple[Dict[int, str], set[int]]:
    font_color_by_idx: Dict[int, str] = {}
    red_style_ids: set[int] = set()

    styles = ET.fromstring(zf.read("xl/styles.xml"))
    fonts = list(styles.find("x:fonts", NS) or [])
    cell_xfs = list(styles.find("x:cellXfs", NS) or [])

    for idx, font in enumerate(fonts):
        color = font.find("x:color", NS)
        if color is None:
            continue
        rgb = color.attrib.get("rgb", "").upper()
        if rgb:
            font_color_by_idx[idx] = rgb

    for style_idx, xf in enumerate(cell_xfs):
        font_id = int(xf.attrib.get("fontId", "0"))
        color = font_color_by_idx.get(font_id, "")
        if color.startswith("FFFF0000"):
            red_style_ids.add(style_idx)

    return font_color_by_idx, red_style_ids


def col_from_ref(ref: str) -> str:
    m = re.match(r"([A-Z]+)", ref)
    return m.group(1) if m else ""


def load_sheet_rows(path: Path) -> tuple[List[Dict[str, Cell]], set[int]]:
    with zipfile.ZipFile(path) as zf:
        ss = get_shared_strings(zf)
        _, red_style_ids = get_style_maps(zf)

        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        sheet = wb.find(".//x:sheets/x:sheet", NS)
        if sheet is None:
            return [], red_style_ids

        rel_id = sheet.attrib.get(REL_NS, "")
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))

        target = ""
        for rel in rels:
            if rel.attrib.get("Id") == rel_id:
                target = rel.attrib.get("Target", "")
                break
        if not target:
            return [], red_style_ids

        sheet_xml = ET.fromstring(zf.read(normalize_target(target)))
        rows: List[Dict[str, Cell]] = []

        for row in sheet_xml.findall(".//x:sheetData/x:row", NS):
            current: Dict[str, Cell] = {}
            for c in row.findall("x:c", NS):
                ref = c.attrib.get("r", "")
                col = col_from_ref(ref)
                if not col:
                    continue
                style = int(c.attrib.get("s", "0"))
                ctype = c.attrib.get("t", "")

                value = ""
                v = c.find("x:v", NS)
                is_inline = c.find("x:is", NS)

                if v is not None and (v.text or "").strip():
                    raw = (v.text or "").strip()
                    if ctype == "s" and raw.isdigit():
                        idx = int(raw)
                        value = ss[idx] if idx < len(ss) else raw
                    else:
                        value = raw
                elif is_inline is not None:
                    value = "".join(t.text or "" for t in is_inline.findall(".//x:t", NS))

                value = value.strip()
                if value:
                    current[col] = Cell(value=value, style=style)

            rows.append(current)

        return rows, red_style_ids


def normalize_text(text: str) -> str:
    return " ".join(text.lower().replace("\n", " ").split())


def is_header_value(value: str, token: str) -> bool:
    return token in normalize_text(value)


def detect_header(rows: List[Dict[str, Cell]]) -> Optional[int]:
    for i, row in enumerate(rows):
        values = [cell.value for cell in row.values()]
        joined = " | ".join(normalize_text(v) for v in values)
        if "назва питання" in joined:
            return i
        if "питання" in joined and ("правильна відповідь" in joined or "варіант" in joined):
            return i
    return None


def parse_answer_tokens(raw: str) -> List[str]:
    s = normalize_text(raw)
    if not s or s == "-":
        return []

    cleaned = re.sub(r"[^a-zа-яіїєґ0-9,;\s]", " ", s)
    parts = [p for p in re.split(r"[\s,;]+", cleaned) if p]
    mapped: List[str] = []
    mapping = {
        "a": "A",
        "б": "B",
        "b": "B",
        "в": "C",
        "v": "C",
        "c": "C",
        "г": "D",
        "g": "D",
        "d": "D",
        "1": "A",
        "2": "B",
        "3": "C",
        "4": "D",
    }
    for p in parts:
        if p in mapping:
            mapped.append(mapping[p])
    return list(dict.fromkeys(mapped))


def parse_workbook(path: Path) -> dict:
    rows, red_style_ids = load_sheet_rows(path)
    header_idx = detect_header(rows)

    if header_idx is None:
        return {"title": path.stem, "questions": [], "source": str(path)}

    header = rows[header_idx]
    cols = sorted(header.keys())

    question_col = ""
    answer_col = ""
    subject_col = ""
    option_cols: List[str] = []

    for col in cols:
        hv = normalize_text(header[col].value)
        if "назва питання" in hv or hv == "питання":
            question_col = col
        elif "правильна відповідь" in hv or hv == "відповідь":
            answer_col = col
        elif "дисципліна" in hv or hv == "тема":
            if not subject_col:
                subject_col = col
        elif "варіант" in hv or hv in {"a", "b", "c", "d", "а", "б", "в", "г"}:
            option_cols.append(col)

    option_cols = sorted(option_cols)
    if not question_col or not option_cols:
        return {"title": path.stem, "questions": [], "source": str(path)}

    questions: List[dict] = []
    last_subject = ""
    empty_streak = 0

    for row in rows[header_idx + 1 :]:
        q_cell = row.get(question_col)
        q_text = q_cell.value.strip() if q_cell else ""

        options: List[dict] = []
        for idx, col in enumerate(option_cols):
            cell = row.get(col)
            if not cell:
                continue
            text = cell.value.strip()
            if not text or text == "-":
                continue
            option_id = chr(ord("A") + idx)
            options.append(
                {
                    "id": option_id,
                    "text": text,
                    "style": cell.style,
                }
            )

        if q_text and options:
            empty_streak = 0
        else:
            empty_streak += 1
            if empty_streak >= 10:
                break
            continue

        subject = ""
        if subject_col and subject_col in row:
            subject = row[subject_col].value.strip()
            if subject:
                last_subject = subject
        if not subject:
            subject = last_subject

        correct_ids: List[str] = []
        if answer_col and answer_col in row:
            answer_raw = row[answer_col].value
            direct = parse_answer_tokens(answer_raw)
            if direct:
                correct_ids = direct
            elif answer_raw:
                exact = normalize_text(answer_raw)
                for opt in options:
                    if normalize_text(opt["text"]) == exact:
                        correct_ids = [opt["id"]]
                        break

        if not correct_ids and red_style_ids:
            by_red = [opt["id"] for opt in options if opt["style"] in red_style_ids]
            if by_red:
                correct_ids = by_red

        questions.append(
            {
                "prompt": q_text,
                "subject": subject or path.stem,
                "options": [{"id": o["id"], "text": o["text"]} for o in options],
                "correctOptionIds": correct_ids,
            }
        )

    return {"title": path.stem, "questions": questions, "source": str(path)}


def main() -> None:
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Source dir not found: {SOURCE_DIR}")

    workbooks = sorted(
        p
        for p in SOURCE_DIR.rglob("*.xlsx")
        if not p.name.startswith("~$")
    )

    all_sets: List[dict] = []
    total_questions = 0
    total_with_answers = 0

    for wb in workbooks:
        parsed = parse_workbook(wb)
        if not parsed["questions"]:
            continue
        for q in parsed["questions"]:
            total_questions += 1
            if q["correctOptionIds"]:
                total_with_answers += 1
        all_sets.append(parsed)

    payload = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "totalSets": len(all_sets),
        "totalQuestions": total_questions,
        "questionsWithAnswers": total_with_answers,
        "sets": all_sets,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Saved {OUT_FILE}")
    print(f"Sets: {payload['totalSets']}")
    print(f"Questions: {payload['totalQuestions']}")
    print(f"With answers: {payload['questionsWithAnswers']}")


if __name__ == "__main__":
    main()
