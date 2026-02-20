const refs = {
  gradeSelect: document.getElementById("gradeSelect"),
  termSelect: document.getElementById("termSelect"),
  searchInput: document.getElementById("searchInput"),
  prevLessonBtn: document.getElementById("prevLessonBtn"),
  nextLessonBtn: document.getElementById("nextLessonBtn"),
  goWorksheetBtn: document.getElementById("goWorksheetBtn"),
  catalogMeta: document.getElementById("catalogMeta"),
  catalogList: document.getElementById("catalogList"),
  progressBox: document.getElementById("progressBox"),
  lessonTitle: document.getElementById("lessonTitle"),
  lessonMeta: document.getElementById("lessonMeta"),
  readBtn: document.getElementById("readBtn"),
  markDoneBtn: document.getElementById("markDoneBtn"),
  addCharsBtn: document.getElementById("addCharsBtn"),
  lessonText: document.getElementById("lessonText"),
  focusChars: document.getElementById("focusChars"),
  keywordList: document.getElementById("keywordList"),
  questionList: document.getElementById("questionList"),
  taskList: document.getElementById("taskList"),
  quizMeta: document.getElementById("quizMeta"),
  regenQuizBtn: document.getElementById("regenQuizBtn"),
  submitQuizBtn: document.getElementById("submitQuizBtn"),
  addQuizWrongBtn: document.getElementById("addQuizWrongBtn"),
  quizForm: document.getElementById("quizForm"),
  quizResult: document.getElementById("quizResult"),
  readingSupport: document.getElementById("readingSupport"),
  readingStartBtn: document.getElementById("readingStartBtn"),
  readingStopBtn: document.getElementById("readingStopBtn"),
  readingScoreBtn: document.getElementById("readingScoreBtn"),
  readingAddWeakBtn: document.getElementById("readingAddWeakBtn"),
  readingTranscriptInput: document.getElementById("readingTranscriptInput"),
  readingScoreMeta: document.getElementById("readingScoreMeta"),
  readingDiagnosis: document.getElementById("readingDiagnosis"),
  actionTip: document.getElementById("actionTip"),
};

const store = window.LearningStore;
const books = Array.isArray(window.PRIMARY_TEXTBOOK_LIBRARY) ? window.PRIMARY_TEXTBOOK_LIBRARY : [];
const hanziLib = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const PROGRESS_KEY = "primaryTextbookProgressV1";
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  grade: "",
  term: "",
  filteredLessons: [],
  selectedLessonId: "",
  progress: {
    completedLessons: {},
    taskChecks: {},
    quizScores: {},
    readingReports: {},
    updatedAt: 0,
  },
  quizBank: {},
  quizWeakChars: [],
  readingWeakChars: [],
  reading: {
    supported: false,
    recognition: null,
    listening: false,
  },
};

const hanziMap = new Map(
  hanziLib
    .filter((item) => item && typeof item === "object" && item.char)
    .map((item) => [
      item.char,
      {
        pinyin: item.pinyin || "",
        meaning: item.meaning || "",
      },
    ])
);

const allLessons = books.flatMap((grade) =>
  (grade.terms || []).flatMap((term) =>
    (term.lessons || []).map((lesson) => ({
      ...lesson,
      _gradeLabel: grade.label || `${grade.grade}年级`,
      _term: term.term || "",
      _unitTitle: term.unitTitle || "",
    }))
  )
);

const allMeaningPool = [...new Set(allLessons.flatMap((lesson) => (lesson.keywords || []).map((item) => item.meaning || "")))].filter(
  Boolean
);
const allSentencePool = [...new Set(allLessons.flatMap((lesson) => lesson.text || []))].filter(Boolean);
const allPinyinPool = [...new Set([...hanziMap.values()].map((item) => item.pinyin || ""))].filter(Boolean);

function isHanChar(char) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
}

function toHanChars(text) {
  return [...String(text || "")].filter((char) => isHanChar(char));
}

function uniqueArray(list) {
  return [...new Set((list || []).filter(Boolean))];
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomDistinct(list, count, excludes) {
  const excludeSet = excludes instanceof Set ? excludes : new Set(excludes || []);
  const source = list.filter((item) => item && !excludeSet.has(item));
  return shuffle(source).slice(0, Math.max(0, count));
}

function createProgressDefaults() {
  return {
    completedLessons: {},
    taskChecks: {},
    quizScores: {},
    readingReports: {},
    updatedAt: 0,
  };
}

function safeReadProgress() {
  const defaults = createProgressDefaults();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return {
      completedLessons:
        parsed?.completedLessons && typeof parsed.completedLessons === "object"
          ? parsed.completedLessons
          : defaults.completedLessons,
      taskChecks: parsed?.taskChecks && typeof parsed.taskChecks === "object" ? parsed.taskChecks : defaults.taskChecks,
      quizScores: parsed?.quizScores && typeof parsed.quizScores === "object" ? parsed.quizScores : defaults.quizScores,
      readingReports:
        parsed?.readingReports && typeof parsed.readingReports === "object"
          ? parsed.readingReports
          : defaults.readingReports,
      updatedAt: Number.isFinite(parsed?.updatedAt) ? parsed.updatedAt : 0,
    };
  } catch (error) {
    return defaults;
  }
}

function saveProgress() {
  try {
    state.progress.updatedAt = Date.now();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
  } catch (error) {
    // ignore storage errors
  }
}

function textIncludes(text, keyword) {
  return String(text || "").toLowerCase().includes(keyword);
}

function normalizeKeyword(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

function getGradeBook(gradeValue) {
  return books.find((item) => String(item.grade) === String(gradeValue)) || null;
}

function getCurrentLessons() {
  const gradeBook = getGradeBook(state.grade);
  if (!gradeBook) {
    return [];
  }
  const termRows = Array.isArray(gradeBook.terms) ? gradeBook.terms : [];
  const targetTerm = termRows.find((term) => term.term === state.term) || termRows[0];
  if (!targetTerm) {
    return [];
  }
  const search = normalizeKeyword(refs.searchInput.value);
  const rows = (targetTerm.lessons || [])
    .filter((lesson) => lesson && typeof lesson === "object")
    .map((lesson, index) => ({
      ...lesson,
      _unitTitle: targetTerm.unitTitle || "",
      _term: targetTerm.term || "",
      _order: index + 1,
      _gradeLabel: gradeBook.label || `${gradeBook.grade}年级`,
    }));
  if (!search) {
    return rows;
  }
  return rows.filter((lesson) => {
    const keywordCorpus = [
      lesson.title,
      ...(lesson.text || []),
      ...(lesson.focusChars || []),
      ...(lesson.keywords || []).map((item) => `${item.word || ""}${item.meaning || ""}`),
    ]
      .join(" ")
      .toLowerCase();
    return textIncludes(keywordCorpus, search);
  });
}

function collectLessonChars(lesson) {
  const chars = Array.isArray(lesson?.focusChars) ? lesson.focusChars : [];
  return uniqueArray(chars.filter((char) => isHanChar(char)));
}

function getSelectedLesson() {
  return state.filteredLessons.find((item) => item.id === state.selectedLessonId) || null;
}

function isLessonDone(lessonId) {
  return Boolean(state.progress.completedLessons[String(lessonId || "")]);
}

function setLessonDone(lessonId, done) {
  const key = String(lessonId || "");
  if (!key) {
    return;
  }
  if (done) {
    state.progress.completedLessons[key] = true;
  } else {
    delete state.progress.completedLessons[key];
  }
  saveProgress();
}

function getTaskCheckedMap(lessonId) {
  const key = String(lessonId || "");
  const map = state.progress.taskChecks[key];
  return map && typeof map === "object" ? map : {};
}

function setTaskChecked(lessonId, taskIndex, checked) {
  const lessonKey = String(lessonId || "");
  const indexKey = String(taskIndex);
  if (!lessonKey) {
    return;
  }
  const current = getTaskCheckedMap(lessonKey);
  if (checked) {
    current[indexKey] = true;
  } else {
    delete current[indexKey];
  }
  state.progress.taskChecks[lessonKey] = current;
  saveProgress();
}

function logTextbookActivity(type, payload) {
  if (!store || typeof store.logActivity !== "function") {
    return;
  }
  store.logActivity(type, payload || {});
}

function renderSelectors() {
  refs.gradeSelect.innerHTML = books
    .map((item) => `<option value="${item.grade}">${item.label || `${item.grade}年级`}</option>`)
    .join("");
  if (!books.length) {
    refs.termSelect.innerHTML = `<option value="">暂无课本</option>`;
    return;
  }
  if (!state.grade) {
    state.grade = String(books[0].grade);
  }
  refs.gradeSelect.value = state.grade;

  const gradeBook = getGradeBook(state.grade);
  const terms = gradeBook?.terms || [];
  refs.termSelect.innerHTML = terms.map((item) => `<option value="${item.term}">${item.term}</option>`).join("");
  if (!state.term || !terms.some((item) => item.term === state.term)) {
    state.term = terms[0]?.term || "";
  }
  refs.termSelect.value = state.term;
}

function renderCatalog() {
  refs.catalogList.innerHTML = "";
  state.filteredLessons = getCurrentLessons();
  if (!state.filteredLessons.length) {
    refs.catalogMeta.textContent = "当前筛选下暂无课文。";
    refs.catalogList.innerHTML = `<p class="meta">请调整年级、学期或关键词。</p>`;
    return;
  }
  refs.catalogMeta.textContent = `共 ${state.filteredLessons.length} 课`;

  if (!state.filteredLessons.some((item) => item.id === state.selectedLessonId)) {
    state.selectedLessonId = state.filteredLessons[0].id;
  }

  state.filteredLessons.forEach((lesson, idx) => {
    const node = document.createElement("div");
    node.className = `catalog-item${lesson.id === state.selectedLessonId ? " active" : ""}`;
    const doneText = isLessonDone(lesson.id) ? "已掌握" : "待学习";
    node.innerHTML = `
      <p class="catalog-title">${idx + 1}. ${lesson.title}</p>
      <p class="catalog-sub">${lesson._term} · ${lesson._unitTitle || "语文单元"} · ${doneText}</p>
    `;
    node.addEventListener("click", () => {
      if (state.reading.listening) {
        stopReadingRecord();
      }
      state.selectedLessonId = lesson.id;
      renderAll();
    });
    refs.catalogList.appendChild(node);
  });
}

function renderProgress() {
  const gradeBook = getGradeBook(state.grade);
  const allGradeLessons = (gradeBook?.terms || []).flatMap((term) => term.lessons || []);
  const doneCount = allGradeLessons.filter((item) => isLessonDone(item.id)).length;
  const total = allGradeLessons.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  const currentTermDone = state.filteredLessons.filter((item) => isLessonDone(item.id)).length;
  const quizRows = Object.values(state.progress.quizScores || {}).filter((item) => item && item.passed).length;
  const readingRows = Object.values(state.progress.readingReports || {}).filter((item) => item && Number(item.score) >= 80).length;
  const latestTs = Number(state.progress.updatedAt) || 0;
  refs.progressBox.innerHTML = `
    <p>当前年级：<strong>${gradeBook?.label || "-"}</strong></p>
    <p>年级完成：<strong class="${percent >= 70 ? "ok-text" : ""}">${doneCount}/${total}</strong>（${percent}%）</p>
    <p>当前学期完成：<strong>${currentTermDone}/${state.filteredLessons.length || 0}</strong></p>
    <p>小测达标课次：<strong>${quizRows}</strong></p>
    <p>朗读达标课次：<strong>${readingRows}</strong></p>
    <p>最近更新：${latestTs ? new Date(latestTs).toLocaleString("zh-CN") : "暂无"}</p>
  `;
}

function renderLessonText(lesson) {
  refs.lessonText.innerHTML = "";
  (lesson.text || []).forEach((line) => {
    const row = document.createElement("div");
    row.className = "tian-line";
    [...String(line || "")].forEach((char) => {
      const cell = document.createElement("span");
      cell.className = `tian-cell ${isHanChar(char) ? "han" : "punc"}`;
      cell.textContent = char;
      row.appendChild(cell);
    });
    refs.lessonText.appendChild(row);
  });
}

function renderFocusChars(lesson) {
  refs.focusChars.innerHTML = "";
  const chars = collectLessonChars(lesson);
  if (!chars.length) {
    refs.focusChars.innerHTML = `<span class="meta">暂无生字。</span>`;
    return;
  }
  chars.forEach((char) => {
    const meta = hanziMap.get(char) || {};
    const card = document.createElement("div");
    card.className = "char-card";
    card.innerHTML = `
      <div class="char">${char}</div>
      <div class="pinyin">${meta.pinyin || "-"}</div>
      <div class="meaning">${meta.meaning ? meta.meaning.slice(0, 12) : "课本生字"}</div>
    `;
    refs.focusChars.appendChild(card);
  });
}

function renderKeywords(lesson) {
  refs.keywordList.innerHTML = "";
  const rows = Array.isArray(lesson.keywords) ? lesson.keywords : [];
  if (!rows.length) {
    refs.keywordList.innerHTML = `<li class="meta">暂无重点词语。</li>`;
    return;
  }
  rows.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.word || ""}：${item.meaning || ""}`;
    refs.keywordList.appendChild(li);
  });
}

function renderQuestions(lesson) {
  refs.questionList.innerHTML = "";
  const rows = Array.isArray(lesson.questions) ? lesson.questions : [];
  if (!rows.length) {
    refs.questionList.innerHTML = `<li class="meta">暂无思考题。</li>`;
    return;
  }
  rows.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    refs.questionList.appendChild(li);
  });
}

function renderTasks(lesson) {
  refs.taskList.innerHTML = "";
  const rows = Array.isArray(lesson.tasks) ? lesson.tasks : [];
  if (!rows.length) {
    refs.taskList.innerHTML = `<p class="meta">暂无任务。</p>`;
    return;
  }
  const checkedMap = getTaskCheckedMap(lesson.id);
  rows.forEach((task, index) => {
    const checked = Boolean(checkedMap[String(index)]);
    const row = document.createElement("div");
    row.className = `task-item${checked ? " done" : ""}`;
    row.innerHTML = `
      <input id="task_${lesson.id}_${index}" type="checkbox" ${checked ? "checked" : ""} />
      <label for="task_${lesson.id}_${index}">${task}</label>
    `;
    row.querySelector("input").addEventListener("change", (event) => {
      const next = Boolean(event.target.checked);
      setTaskChecked(lesson.id, index, next);
      renderTasks(lesson);
      logTextbookActivity("textbook_task_update", {
        lessonId: lesson.id,
        taskIndex: index,
        checked: next,
        grade: state.grade,
      });
    });
    refs.taskList.appendChild(row);
  });
}

function updateActionTip(lesson) {
  const doneText = isLessonDone(lesson.id) ? "当前状态：已掌握 ✅" : "当前状态：待掌握";
  refs.actionTip.textContent = `${lesson._gradeLabel} ${lesson._term} · ${doneText}。建议：先朗读田字格课文，再做小测与录音评分。`;
}

function makeChoiceQuestion(base) {
  const optionRows = shuffle(base.options.map((text, index) => ({ text, originIndex: index })));
  const answerIndex = optionRows.findIndex((item) => item.originIndex === base.answerIndex);
  return {
    ...base,
    options: optionRows.map((item) => item.text),
    answerIndex,
  };
}

function buildSentenceQuestion(lesson, suffixId) {
  const ownLines = (lesson.text || []).filter(Boolean);
  if (!ownLines.length) {
    return null;
  }
  const correct = ownLines[Math.floor(Math.random() * ownLines.length)];
  const distractors = pickRandomDistinct(allSentencePool, 3, new Set(ownLines.concat([correct])));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `${lesson.id}_sentence_${suffixId}`,
    type: "sentence",
    prompt: "下列哪一句出自本课课文？",
    options: [correct, ...distractors],
    answerIndex: 0,
    relatedChars: collectLessonChars(lesson),
    explain: `正确句：${correct}`,
  });
}

function buildKeywordMeaningQuestion(lesson, keyword, index) {
  if (!keyword?.word || !keyword?.meaning) {
    return null;
  }
  const distractors = pickRandomDistinct(allMeaningPool, 3, new Set([keyword.meaning]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `${lesson.id}_keyword_${index}`,
    type: "keyword",
    prompt: `“${keyword.word}”在本课中的意思最接近哪一项？`,
    options: [keyword.meaning, ...distractors],
    answerIndex: 0,
    relatedChars: uniqueArray(toHanChars(keyword.word)),
    explain: `正确释义：${keyword.meaning}`,
  });
}

function buildPinyinQuestion(lesson, char, index) {
  const pinyin = hanziMap.get(char)?.pinyin || "";
  if (!pinyin) {
    return null;
  }
  const distractors = pickRandomDistinct(allPinyinPool, 3, new Set([pinyin]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `${lesson.id}_pinyin_${index}`,
    type: "pinyin",
    prompt: `“${char}”的正确拼音是：`,
    options: [pinyin, ...distractors],
    answerIndex: 0,
    relatedChars: [char],
    explain: `正确拼音：${char}（${pinyin}）`,
  });
}

function buildLessonQuiz(lesson) {
  const questions = [];
  const sentenceQ = buildSentenceQuestion(lesson, 1);
  if (sentenceQ) {
    questions.push(sentenceQ);
  }
  (lesson.keywords || [])
    .slice(0, 3)
    .forEach((keyword, index) => {
      const q = buildKeywordMeaningQuestion(lesson, keyword, index + 1);
      if (q) {
        questions.push(q);
      }
    });
  collectLessonChars(lesson)
    .slice(0, 2)
    .forEach((char, index) => {
      const q = buildPinyinQuestion(lesson, char, index + 1);
      if (q) {
        questions.push(q);
      }
    });

  let extraIndex = 2;
  while (questions.length < 5) {
    const extra = buildSentenceQuestion(lesson, extraIndex);
    extraIndex += 1;
    if (!extra) {
      break;
    }
    questions.push(extra);
  }
  return questions.slice(0, 6);
}

function getQuizForLesson(lesson, forceNew) {
  if (!lesson) {
    return [];
  }
  if (!forceNew && Array.isArray(state.quizBank[lesson.id]) && state.quizBank[lesson.id].length) {
    return state.quizBank[lesson.id];
  }
  const quiz = buildLessonQuiz(lesson);
  state.quizBank[lesson.id] = quiz;
  return quiz;
}

function renderQuiz(lesson) {
  refs.quizForm.innerHTML = "";
  const quiz = getQuizForLesson(lesson, false);
  if (!quiz.length) {
    refs.quizMeta.textContent = "暂无可生成的小测题。";
    refs.quizResult.textContent = "测评结果：本课题目不足，暂不支持自动判分。";
    return;
  }
  refs.quizMeta.textContent = `本课共 ${quiz.length} 题，提交后自动判分（80 分及以上为达标）。`;
  quiz.forEach((q, idx) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "quiz-item";
    fieldset.dataset.qindex = `${idx}`;
    const optionsHtml = q.options
      .map(
        (option, optionIndex) => `
          <label>
            <input type="radio" name="quiz_${lesson.id}_${idx}" value="${optionIndex}" />
            <span>${option}</span>
          </label>
        `
      )
      .join("");
    fieldset.innerHTML = `
      <legend>${idx + 1}. ${q.prompt}</legend>
      <div class="quiz-options">${optionsHtml}</div>
      <p class="quiz-analysis"></p>
    `;
    refs.quizForm.appendChild(fieldset);
  });
  const last = state.progress.quizScores?.[lesson.id];
  if (last && Number.isFinite(last.score)) {
    refs.quizResult.textContent = `上次成绩：${last.score} 分（${last.correct}/${last.total}），${last.passed ? "已达标" : "待提升"}。`;
  } else {
    refs.quizResult.textContent = "测评结果：待提交。";
  }
}

function submitQuiz() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const quiz = getQuizForLesson(lesson, false);
  if (!quiz.length) {
    return;
  }
  let answered = 0;
  let correct = 0;
  const wrongChars = new Set();
  quiz.forEach((q, idx) => {
    const name = `quiz_${lesson.id}_${idx}`;
    const selected = refs.quizForm.querySelector(`input[name="${name}"]:checked`);
    const fieldset = refs.quizForm.querySelector(`[data-qindex="${idx}"]`);
    const analysis = fieldset?.querySelector(".quiz-analysis");
    fieldset?.classList.remove("correct", "wrong");
    if (!selected) {
      if (analysis) {
        analysis.textContent = `未作答。${q.explain || ""}`;
      }
      fieldset?.classList.add("wrong");
      (q.relatedChars || []).forEach((char) => wrongChars.add(char));
      return;
    }
    answered += 1;
    const selectedIndex = Number.parseInt(selected.value, 10);
    if (selectedIndex === q.answerIndex) {
      correct += 1;
      fieldset?.classList.add("correct");
      if (analysis) {
        analysis.textContent = "回答正确。";
      }
      return;
    }
    fieldset?.classList.add("wrong");
    (q.relatedChars || []).forEach((char) => wrongChars.add(char));
    if (analysis) {
      const right = q.options[q.answerIndex] || "";
      analysis.textContent = `回答错误，正确答案：${right}。`;
    }
  });
  const score = Math.round((correct / quiz.length) * 100);
  const passed = score >= 80;
  state.quizWeakChars = uniqueArray([...wrongChars].filter((char) => isHanChar(char)));
  state.progress.quizScores[lesson.id] = {
    score,
    total: quiz.length,
    correct,
    answered,
    passed,
    weakChars: state.quizWeakChars,
    ts: Date.now(),
  };
  saveProgress();
  refs.quizResult.textContent = `测评结果：${score} 分（答对 ${correct}/${quiz.length}，作答 ${answered}/${quiz.length}）${
    passed ? "，已达标 ✅" : "，建议复习后再测"
  }${state.quizWeakChars.length ? `；错题关联字：${state.quizWeakChars.join("")}` : ""}`;
  logTextbookActivity("textbook_quiz_submit", {
    lessonId: lesson.id,
    grade: state.grade,
    term: state.term,
    score,
    correct,
    total: quiz.length,
    passed,
    weakCount: state.quizWeakChars.length,
  });
  updateActionTip(lesson);
  renderProgress();
}

function addQuizWrongCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const fallback = state.progress.quizScores?.[lesson.id]?.weakChars || [];
  const chars = uniqueArray((state.quizWeakChars.length ? state.quizWeakChars : fallback).filter((char) => isHanChar(char)));
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "当前小测暂无错题字可加入字帖。";
    return;
  }
  const result = store.addWorksheetChars(chars, "textbook_quiz_wrong");
  refs.actionTip.textContent = `已将小测错题字加入字帖：${result.added.join("") || chars.join("")}`;
  logTextbookActivity("textbook_quiz_wrong_to_worksheet", {
    lessonId: lesson.id,
    chars,
    count: chars.length,
  });
}

function renderChipList(items, emptyText) {
  const list = uniqueArray(items);
  if (!list.length) {
    return `<p>${emptyText}</p>`;
  }
  return `<div class="chip-list">${list.map((item) => `<span class="chip">${item}</span>`).join("")}</div>`;
}

function alignChars(expectedChars, actualChars) {
  const m = expectedChars.length;
  const n = actualChars.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const same = expectedChars[i - 1] === actualChars[j - 1];
      const cost = same ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = expectedChars[i - 1] === actualChars[j - 1];
      const cost = same ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        if (same) {
          ops.push({ type: "equal", char: expectedChars[i - 1] });
        } else {
          ops.push({ type: "sub", expected: expectedChars[i - 1], actual: actualChars[j - 1] });
        }
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: "del", expected: expectedChars[i - 1] });
      i -= 1;
      continue;
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ type: "ins", actual: actualChars[j - 1] });
      j -= 1;
      continue;
    }
    if (i > 0 && j > 0) {
      ops.push({ type: "sub", expected: expectedChars[i - 1], actual: actualChars[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0) {
      ops.push({ type: "del", expected: expectedChars[i - 1] });
      i -= 1;
    } else if (j > 0) {
      ops.push({ type: "ins", actual: actualChars[j - 1] });
      j -= 1;
    }
  }
  ops.reverse();
  return { distance: dp[m][n], ops };
}

function evaluateReadingTranscript(lesson, transcript) {
  const expectedChars = toHanChars((lesson.text || []).join(""));
  const actualChars = toHanChars(transcript || "");
  const aligned = alignChars(expectedChars, actualChars);
  const missing = aligned.ops.filter((op) => op.type === "del").map((op) => op.expected);
  const extra = aligned.ops.filter((op) => op.type === "ins").map((op) => op.actual);
  const substitutions = aligned.ops.filter((op) => op.type === "sub");
  const matched = aligned.ops.filter((op) => op.type === "equal").length;
  const weakChars = uniqueArray([...missing, ...substitutions.map((item) => item.expected)]).filter((char) => isHanChar(char));
  const expectedLen = expectedChars.length || 1;
  const penalty = substitutions.length * 0.35 + extra.length * 0.2;
  const score = Math.max(0, Math.min(100, Math.round(((matched - penalty) / expectedLen) * 100)));
  const coverage = Math.round((actualChars.length / expectedLen) * 100);
  return {
    score,
    expectedCount: expectedChars.length,
    actualCount: actualChars.length,
    matched,
    missing,
    extra,
    substitutions,
    weakChars,
    coverage: Number.isFinite(coverage) ? Math.max(0, coverage) : 0,
  };
}

function renderReadingReport(report) {
  if (!report) {
    refs.readingScoreMeta.textContent = "朗读评分：-";
    refs.readingDiagnosis.innerHTML = `<p>诊断结果：待生成。</p>`;
    return;
  }
  refs.readingScoreMeta.textContent = `朗读评分：${report.score} 分（匹配 ${report.matched}/${report.expectedCount}，识别覆盖 ${report.coverage}%）${
    report.score >= 80 ? "，达标 ✅" : "，建议继续练习"
  }`;
  const subText = report.substitutions.slice(0, 8).map((item) => `${item.expected}→${item.actual}`);
  refs.readingDiagnosis.innerHTML = `
    <p>漏读字：${report.missing.length}</p>
    ${renderChipList(report.missing, "漏读字：无")}
    <p>误读字：${report.substitutions.length}</p>
    ${renderChipList(subText, "误读字：无")}
    <p>增读字：${report.extra.length}</p>
    ${renderChipList(report.extra, "增读字：无")}
  `;
}

function applyReadingScore() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const transcript = String(refs.readingTranscriptInput.value || "").trim();
  if (!transcript) {
    refs.readingScoreMeta.textContent = "朗读评分：请先录音或输入识别文本。";
    return;
  }
  const report = evaluateReadingTranscript(lesson, transcript);
  state.readingWeakChars = report.weakChars;
  state.progress.readingReports[lesson.id] = {
    ...report,
    weakChars: report.weakChars,
    transcript,
    ts: Date.now(),
  };
  saveProgress();
  renderReadingReport(report);
  logTextbookActivity("textbook_reading_assess", {
    lessonId: lesson.id,
    grade: state.grade,
    term: state.term,
    score: report.score,
    missing: report.missing.length,
    substitutions: report.substitutions.length,
    extra: report.extra.length,
    weakCount: report.weakChars.length,
  });
  updateActionTip(lesson);
  renderProgress();
}

function addReadingWeakCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const fallback = state.progress.readingReports?.[lesson.id]?.weakChars || [];
  const chars = uniqueArray((state.readingWeakChars.length ? state.readingWeakChars : fallback).filter((char) => isHanChar(char)));
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "当前朗读暂无错字可加入字帖。";
    return;
  }
  const result = store.addWorksheetChars(chars, "textbook_reading_weak");
  refs.actionTip.textContent = `已将朗读错字加入字帖：${result.added.join("") || chars.join("")}`;
  logTextbookActivity("textbook_reading_weak_to_worksheet", {
    lessonId: lesson.id,
    chars,
    count: chars.length,
  });
}

function setupReadingRecognition() {
  state.reading.supported = Boolean(SpeechRecognitionCtor);
  if (!state.reading.supported) {
    refs.readingSupport.textContent = "当前浏览器不支持语音识别。可手动粘贴朗读文本后点击“生成评分”。";
    refs.readingStartBtn.disabled = true;
    refs.readingStopBtn.disabled = true;
    return;
  }
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.reading.listening = true;
    refs.readingSupport.textContent = "录音中：请朗读当前课文，结束后点击“停止录音”。";
  };

  recognition.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i += 1) {
      const piece = event.results[i]?.[0]?.transcript || "";
      text += piece;
    }
    refs.readingTranscriptInput.value = text.trim();
  };

  recognition.onerror = (event) => {
    refs.readingSupport.textContent = `语音识别异常：${event?.error || "unknown"}。可手动粘贴文本进行评分。`;
  };

  recognition.onend = () => {
    state.reading.listening = false;
    refs.readingSupport.textContent = "录音已结束，可点击“生成评分”查看结果。";
  };

  state.reading.recognition = recognition;
  refs.readingSupport.textContent = "点击“开始录音”，朗读课文后系统将自动识别并进行评分诊断。";
}

function startReadingRecord() {
  if (!state.reading.supported || !state.reading.recognition) {
    refs.readingSupport.textContent = "当前浏览器不支持语音识别，请改用手动文本评分。";
    return;
  }
  if (state.reading.listening) {
    return;
  }
  refs.readingTranscriptInput.value = "";
  refs.readingScoreMeta.textContent = "朗读评分：录音中...";
  refs.readingDiagnosis.innerHTML = `<p>诊断结果：录音中，暂未生成。</p>`;
  try {
    state.reading.recognition.start();
  } catch (error) {
    refs.readingSupport.textContent = "语音识别启动失败，请稍后重试。";
  }
}

function stopReadingRecord() {
  if (!state.reading.listening || !state.reading.recognition) {
    return;
  }
  state.reading.recognition.stop();
}

function renderReadingPanel(lesson) {
  const report = state.progress.readingReports?.[lesson.id];
  state.readingWeakChars = uniqueArray(report?.weakChars || []);
  if (report) {
    refs.readingTranscriptInput.value = report.transcript || "";
  } else {
    refs.readingTranscriptInput.value = "";
  }
  renderReadingReport(report || null);
}

function renderQuizPanel(lesson) {
  state.quizWeakChars = uniqueArray(state.progress.quizScores?.[lesson.id]?.weakChars || []);
  renderQuiz(lesson);
}

function renderLessonDetail() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    refs.lessonTitle.textContent = "请选择课文";
    refs.lessonMeta.textContent = "-";
    refs.lessonText.innerHTML = `<p class="meta">暂无课文内容。</p>`;
    refs.focusChars.innerHTML = "";
    refs.keywordList.innerHTML = "";
    refs.questionList.innerHTML = "";
    refs.taskList.innerHTML = "";
    refs.quizForm.innerHTML = "";
    refs.quizResult.textContent = "测评结果：-";
    refs.readingScoreMeta.textContent = "朗读评分：-";
    refs.readingDiagnosis.innerHTML = `<p>诊断结果：-</p>`;
    return;
  }
  refs.lessonTitle.textContent = lesson.title;
  refs.lessonMeta.textContent = `${lesson._gradeLabel} · ${lesson._term} · ${lesson._unitTitle || "语文单元"}`;
  refs.markDoneBtn.textContent = isLessonDone(lesson.id) ? "取消掌握标记" : "标记本课已掌握";

  renderLessonText(lesson);
  renderFocusChars(lesson);
  renderKeywords(lesson);
  renderQuestions(lesson);
  renderTasks(lesson);
  renderQuizPanel(lesson);
  renderReadingPanel(lesson);
  updateActionTip(lesson);
}

function speakLesson() {
  const lesson = getSelectedLesson();
  if (!lesson || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return;
  }
  const text = [...(lesson.text || []), ...(lesson.questions || []).map((item) => `思考：${item}`)].join(" ");
  if (!text.trim()) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.94;
  window.speechSynthesis.speak(utterance);
}

function toggleLessonDone() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const current = isLessonDone(lesson.id);
  setLessonDone(lesson.id, !current);
  logTextbookActivity("textbook_lesson_done", {
    lessonId: lesson.id,
    done: !current,
    grade: state.grade,
    term: state.term,
  });
  renderAll();
}

function addLessonCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const chars = collectLessonChars(lesson);
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "本课暂无可加入字帖的生字。";
    return;
  }
  const result = store.addWorksheetChars(chars, "primary_textbook");
  refs.actionTip.textContent = `已加入字帖收藏：${result.added.join("") || chars.join("")}。可前往字帖工坊打印。`;
  logTextbookActivity("textbook_chars_to_worksheet", {
    lessonId: lesson.id,
    count: chars.length,
    chars,
  });
}

function openWorksheetByLesson() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const chars = collectLessonChars(lesson);
  const href = chars.length
    ? `./worksheet.html?chars=${encodeURIComponent(chars.join(""))}&source=textbook`
    : "./worksheet.html";
  window.location.href = href;
}

function moveLesson(step) {
  if (!state.filteredLessons.length) {
    return;
  }
  if (state.reading.listening) {
    stopReadingRecord();
  }
  const index = Math.max(
    0,
    state.filteredLessons.findIndex((item) => item.id === state.selectedLessonId)
  );
  const nextIndex = Math.min(state.filteredLessons.length - 1, Math.max(0, index + step));
  state.selectedLessonId = state.filteredLessons[nextIndex].id;
  renderAll();
}

function regenerateQuiz() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  getQuizForLesson(lesson, true);
  renderQuizPanel(lesson);
  refs.quizResult.textContent = "测评结果：已重新生成题目，请提交判分。";
}

function renderAll() {
  renderCatalog();
  renderProgress();
  renderLessonDetail();
}

function bindEvents() {
  refs.gradeSelect.addEventListener("change", () => {
    state.grade = refs.gradeSelect.value;
    state.term = "";
    renderSelectors();
    renderAll();
  });

  refs.termSelect.addEventListener("change", () => {
    state.term = refs.termSelect.value;
    renderAll();
  });

  refs.searchInput.addEventListener("input", renderAll);
  refs.prevLessonBtn.addEventListener("click", () => moveLesson(-1));
  refs.nextLessonBtn.addEventListener("click", () => moveLesson(1));
  refs.readBtn.addEventListener("click", speakLesson);
  refs.markDoneBtn.addEventListener("click", toggleLessonDone);
  refs.addCharsBtn.addEventListener("click", addLessonCharsToWorksheet);
  refs.goWorksheetBtn.addEventListener("click", openWorksheetByLesson);
  refs.regenQuizBtn?.addEventListener("click", regenerateQuiz);
  refs.submitQuizBtn?.addEventListener("click", submitQuiz);
  refs.addQuizWrongBtn?.addEventListener("click", addQuizWrongCharsToWorksheet);
  refs.readingStartBtn?.addEventListener("click", startReadingRecord);
  refs.readingStopBtn?.addEventListener("click", stopReadingRecord);
  refs.readingScoreBtn?.addEventListener("click", applyReadingScore);
  refs.readingAddWeakBtn?.addEventListener("click", addReadingWeakCharsToWorksheet);
}

function bootstrap() {
  state.progress = safeReadProgress();
  if (!books.length) {
    refs.catalogMeta.textContent = "课本数据未加载。";
    refs.catalogList.innerHTML = `<p class="meta">请检查 primary-textbook-data.js。</p>`;
    return;
  }
  state.grade = String(books[0].grade);
  state.term = books[0].terms?.[0]?.term || "";
  renderSelectors();
  setupReadingRecognition();
  bindEvents();
  renderAll();
}

bootstrap();
