import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const DATA_URL = "./data/tests.json";
const DEV_QUESTION_LIMIT = 5;

const studentNameInput = document.getElementById("studentName");
const studentSurnameInput = document.getElementById("studentSurname");
const companyNumberInput = document.getElementById("companyNumber");
const platoonNumberInput = document.getElementById("platoonNumber");
const startBtn = document.getElementById("startBtn");

const setupSection = document.getElementById("setup");
const quizSection = document.getElementById("quiz");
const resultSection = document.getElementById("result");

const progressEl = document.getElementById("progress");
const topicEl = document.getElementById("topic");
const questionTextEl = document.getElementById("questionText");
const optionsForm = document.getElementById("optionsForm");

const resultText = document.getElementById("resultText");
const saveStatus = document.getElementById("saveStatus");
const restartBtn = document.getElementById("restartBtn");

const SUPABASE_CFG = window.SUPABASE_CONFIG || {
  url: "",
  anonKey: "",
};

let supabase = null;
let dataset = null;
let activeQuestions = [];
let index = 0;
let checked = false;
let score = 0;
let scoredQuestions = 0;
let currentSetTitle = "Загальний тест БЗВП";
let allQuestions = [];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildStudentLabel() {
  const name = studentNameInput.value.trim();
  const surname = studentSurnameInput.value.trim();
  const company = companyNumberInput.value.trim();
  const platoon = platoonNumberInput.value.trim();

  const fullName = [surname, name].filter(Boolean).join(" ").trim() || "Без імені";
  const unitParts = [];
  if (company) {
    unitParts.push(`рота ${company}`);
  }
  if (platoon) {
    unitParts.push(`взвод ${platoon}`);
  }
  const suffix = unitParts.length ? ` (${unitParts.join(", ")})` : "";
  return `${fullName}${suffix}`.slice(0, 64);
}

function renderQuestion() {
  const q = activeQuestions[index];
  if (!q) {
    return;
  }

  checked = false;

  progressEl.textContent = `Питання ${index + 1} з ${activeQuestions.length}`;
  topicEl.textContent = q.subject || "";
  questionTextEl.textContent = q.prompt;

  optionsForm.innerHTML = "";

  q.options.forEach((opt) => {
    const id = `opt-${index}-${opt.id}`;
    const label = document.createElement("label");
    label.className = "option";
    label.htmlFor = id;

    const input = document.createElement("input");
    input.type = "radio";
    input.id = id;
    input.value = opt.id;
    input.name = "answer";
    input.addEventListener("change", () => {
      submitCurrent();
    });

    const span = document.createElement("span");
    span.textContent = `${opt.id}. ${opt.text}`;

    label.append(input, span);
    optionsForm.append(label);
  });
}

function selectedIds() {
  return [...optionsForm.querySelectorAll('input[name="answer"]:checked')].map((i) => i.value).sort();
}

function submitCurrent() {
  if (checked) {
    return;
  }

  const q = activeQuestions[index];
  const picked = selectedIds();
  if (picked.length === 0) {
    return;
  }

  const correctIds = [...q.correctOptionIds].sort();
  scoredQuestions += 1;
  const isCorrect = JSON.stringify(picked) === JSON.stringify(correctIds);
  if (isCorrect) {
    score += 1;
  }

  checked = true;
  setTimeout(() => {
    nextQuestion();
  }, 120);
}

function nextQuestion() {
  index += 1;
  if (index >= activeQuestions.length) {
    finishQuiz();
    return;
  }
  renderQuestion();
}

async function saveAttempt(payload) {
  if (!supabase) {
    return { ok: false, message: "Supabase не налаштовано" };
  }

  const { error } = await supabase.from("quiz_attempts").insert(payload);
  if (error) {
    return { ok: false, message: `Не вдалося зберегти: ${error.message}` };
  }

  return { ok: true, message: "Результат збережено в Supabase." };
}

async function finishQuiz() {
  quizSection.classList.add("hidden");
  resultSection.classList.remove("hidden");

  if (scoredQuestions === 0) {
    resultText.textContent = "Тест завершено. Питання з ключами відповідей не було, оцінка не виставлялась.";
    saveStatus.textContent = "";
    return;
  }

  const pct = Math.round((score / scoredQuestions) * 100);
  resultText.textContent = `Результат: ${score} / ${scoredQuestions} (${pct}%).`;

  const studentName = buildStudentLabel();
  const saveResult = await saveAttempt({
    student_name: studentName,
    quiz_set_title: currentSetTitle,
    score,
    scored_questions: scoredQuestions,
    percent: pct,
  });

  saveStatus.textContent = saveResult.message;
}

function startQuiz() {
  if (!allQuestions.length) {
    alert("Немає питань з відомими правильними відповідями.");
    return;
  }

  activeQuestions = shuffle(allQuestions).slice(0, DEV_QUESTION_LIMIT);
  index = 0;
  score = 0;
  scoredQuestions = 0;

  setupSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  quizSection.classList.remove("hidden");

  renderQuestion();
}

function restart() {
  setupSection.classList.remove("hidden");
  quizSection.classList.add("hidden");
  resultSection.classList.add("hidden");
}

function initSupabase() {
  if (SUPABASE_CFG.url && SUPABASE_CFG.anonKey) {
    supabase = createClient(SUPABASE_CFG.url, SUPABASE_CFG.anonKey);
  }
}

async function init() {
  initSupabase();

  const savedName = localStorage.getItem("quiz_student_name");
  const savedSurname = localStorage.getItem("quiz_student_surname");
  const savedCompany = localStorage.getItem("quiz_company_number");
  const savedPlatoon = localStorage.getItem("quiz_platoon_number");
  if (savedName) {
    studentNameInput.value = savedName;
  }
  if (savedSurname) {
    studentSurnameInput.value = savedSurname;
  }
  if (savedCompany) {
    companyNumberInput.value = savedCompany;
  }
  if (savedPlatoon) {
    platoonNumberInput.value = savedPlatoon;
  }

  studentNameInput.addEventListener("change", () => {
    localStorage.setItem("quiz_student_name", studentNameInput.value.trim());
  });
  studentSurnameInput.addEventListener("change", () => {
    localStorage.setItem("quiz_student_surname", studentSurnameInput.value.trim());
  });
  companyNumberInput.addEventListener("change", () => {
    localStorage.setItem("quiz_company_number", companyNumberInput.value.trim());
  });
  platoonNumberInput.addEventListener("change", () => {
    localStorage.setItem("quiz_platoon_number", platoonNumberInput.value.trim());
  });

  try {
    const res = await fetch(DATA_URL);
    dataset = await res.json();
  } catch (err) {
    alert(`Не вдалося завантажити ${DATA_URL}. Запустіть локальний сервер.`);
    return;
  }

  if (!dataset.sets || !dataset.sets.length) {
    alert("Набори питань не знайдено.");
    return;
  }

  allQuestions = dataset.sets
    .flatMap((setItem) =>
      setItem.questions
        .filter((q) => q.correctOptionIds.length > 0)
        .map((q) => ({ ...q, setTitle: setItem.title }))
    );

  startBtn.addEventListener("click", startQuiz);
  restartBtn.addEventListener("click", restart);
}

init();
