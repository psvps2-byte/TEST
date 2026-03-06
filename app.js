import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const DATA_URL = "./data/tests.json";
const DEV_QUESTION_LIMIT = 5;

const studentNameInput = document.getElementById("studentName");
const setStats = document.getElementById("setStats");
const startBtn = document.getElementById("startBtn");

const setupSection = document.getElementById("setup");
const quizSection = document.getElementById("quiz");
const resultSection = document.getElementById("result");

const progressEl = document.getElementById("progress");
const topicEl = document.getElementById("topic");
const questionTextEl = document.getElementById("questionText");
const optionsForm = document.getElementById("optionsForm");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const feedbackEl = document.getElementById("feedback");

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

function updateStats() {
  const launchCount = Math.min(DEV_QUESTION_LIMIT, allQuestions.length);
  setStats.textContent = `Доступно з ключами: ${allQuestions.length}. Для розробки запускається: ${launchCount} питань.`;
}

function renderQuestion() {
  const q = activeQuestions[index];
  if (!q) {
    return;
  }

  checked = false;
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  nextBtn.classList.add("hidden");

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
    input.type = "checkbox";
    input.id = id;
    input.value = opt.id;
    input.name = "answer";

    const span = document.createElement("span");
    span.textContent = `${opt.id}. ${opt.text}`;

    label.append(input, span);
    optionsForm.append(label);
  });
}

function selectedIds() {
  return [...optionsForm.querySelectorAll('input[name="answer"]:checked')].map((i) => i.value).sort();
}

function markAnswers(correctIds, selected) {
  const correctSet = new Set(correctIds);
  const selectedSet = new Set(selected);

  optionsForm.querySelectorAll("label.option").forEach((label) => {
    const input = label.querySelector("input");
    if (!input) {
      return;
    }
    const id = input.value;
    if (correctSet.has(id)) {
      label.classList.add("correct");
    }
    if (selectedSet.has(id) && !correctSet.has(id)) {
      label.classList.add("wrong");
    }
    input.disabled = true;
  });
}

function clearOptionMarks() {
  optionsForm.querySelectorAll("label.option").forEach((label) => {
    label.classList.remove("correct", "wrong");
  });
}

function submitCurrent() {
  if (checked) {
    return;
  }

  const q = activeQuestions[index];
  const picked = selectedIds();
  if (picked.length === 0) {
    feedbackEl.textContent = "Оберіть хоча б один варіант.";
    feedbackEl.classList.add("bad");
    return;
  }

  const correctIds = [...q.correctOptionIds].sort();

  if (correctIds.length === 0) {
    feedbackEl.textContent = "Для цього питання ключ не знайдено. Це тренувальний режим.";
    feedbackEl.classList.add("muted");
    optionsForm.querySelectorAll('input[name="answer"]').forEach((input) => {
      input.disabled = true;
    });
  } else {
    scoredQuestions += 1;
    const isCorrect = JSON.stringify(picked) === JSON.stringify(correctIds);
    if (isCorrect) {
      score += 1;
      feedbackEl.textContent = "Правильно.";
      feedbackEl.classList.add("ok");
    } else {
      feedbackEl.textContent = `Неправильно. Правильна відповідь: ${correctIds.join(", ")}.`;
      feedbackEl.classList.add("bad");
    }
    markAnswers(correctIds, picked);
  }

  checked = true;
  nextBtn.classList.remove("hidden");
}

function nextQuestion() {
  index += 1;
  if (index >= activeQuestions.length) {
    finishQuiz();
    return;
  }
  clearOptionMarks();
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

  const studentName = studentNameInput.value.trim() || "Без імені";
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
  if (savedName) {
    studentNameInput.value = savedName;
  }

  studentNameInput.addEventListener("change", () => {
    localStorage.setItem("quiz_student_name", studentNameInput.value.trim());
  });

  try {
    const res = await fetch(DATA_URL);
    dataset = await res.json();
  } catch (err) {
    setStats.textContent = `Не вдалося завантажити ${DATA_URL}. Запустіть локальний сервер.`;
    return;
  }

  if (!dataset.sets || !dataset.sets.length) {
    setStats.textContent = "Набори питань не знайдено.";
    return;
  }

  allQuestions = dataset.sets
    .flatMap((setItem) =>
      setItem.questions
        .filter((q) => q.correctOptionIds.length > 0)
        .map((q) => ({ ...q, setTitle: setItem.title }))
    );

  updateStats();
  startBtn.addEventListener("click", startQuiz);
  submitBtn.addEventListener("click", submitCurrent);
  nextBtn.addEventListener("click", nextQuestion);
  restartBtn.addEventListener("click", restart);
}

init();
