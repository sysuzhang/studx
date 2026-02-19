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
  actionTip: document.getElementById("actionTip"),
};

const store = window.LearningStore;
const books = Array.isArray(window.PRIMARY_TEXTBOOK_LIBRARY) ? window.PRIMARY_TEXTBOOK_LIBRARY : [];
const hanziLib = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const PROGRESS_KEY = "primaryTextbookProgressV1";

const state = {
  grade: "",
  term: "",
  filteredLessons: [],
  selectedLessonId: "",
  progress: {
    completedLessons: {},
    taskChecks: {},
    updatedAt: 0,
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

function safeReadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return { completedLessons: {}, taskChecks: {}, updatedAt: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      completedLessons:
        parsed?.completedLessons && typeof parsed.completedLessons === "object" ? parsed.completedLessons : {},
      taskChecks: parsed?.taskChecks && typeof parsed.taskChecks === "object" ? parsed.taskChecks : {},
      updatedAt: Number.isFinite(parsed?.updatedAt) ? parsed.updatedAt : 0,
    };
  } catch (error) {
    return { completedLessons: {}, taskChecks: {}, updatedAt: 0 };
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
  return [...new Set(chars.filter((char) => /[\u3400-\u9fff\uf900-\ufaff]/.test(char)))];
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
  const latestTs = Number(state.progress.updatedAt) || 0;
  refs.progressBox.innerHTML = `
    <p>当前年级：<strong>${gradeBook?.label || "-"}</strong></p>
    <p>年级完成：<strong class="${percent >= 70 ? "ok-text" : ""}">${doneCount}/${total}</strong>（${percent}%）</p>
    <p>当前学期完成：<strong>${currentTermDone}/${state.filteredLessons.length || 0}</strong></p>
    <p>最近更新：${latestTs ? new Date(latestTs).toLocaleString("zh-CN") : "暂无"}</p>
  `;
}

function renderLessonText(lesson) {
  refs.lessonText.innerHTML = "";
  (lesson.text || []).forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    refs.lessonText.appendChild(p);
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
  refs.actionTip.textContent = `${lesson._gradeLabel} ${lesson._term} · ${doneText}。建议：先朗读，再完成任务，最后生成字帖巩固生字。`;
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
  const index = Math.max(
    0,
    state.filteredLessons.findIndex((item) => item.id === state.selectedLessonId)
  );
  const nextIndex = Math.min(state.filteredLessons.length - 1, Math.max(0, index + step));
  state.selectedLessonId = state.filteredLessons[nextIndex].id;
  renderAll();
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
  bindEvents();
  renderAll();
}

bootstrap();
