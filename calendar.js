const refs = {
  startDate: document.getElementById("startDate"),
  spanDays: document.getElementById("spanDays"),
  newPerDay: document.getElementById("newPerDay"),
  showPendingOnly: document.getElementById("showPendingOnly"),
  charInput: document.getElementById("charInput"),
  fillBeginnerBtn: document.getElementById("fillBeginnerBtn"),
  generateBtn: document.getElementById("generateBtn"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
  summaryStats: document.getElementById("summaryStats"),
  calendarMeta: document.getElementById("calendarMeta"),
  calendarGrid: document.getElementById("calendarGrid"),
};

const REVIEW_OFFSETS = [0, 1, 2, 4, 7, 15, 30];
const STAGE_LABELS = ["初学", "复习1", "复习2", "复习3", "复习4", "复习5", "复习6"];
const STORAGE_KEY = "studyCalendarCompletionV1";
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const store = window.LearningStore;

const state = {
  completion: {},
  plan: null,
  chars: [],
};

let hanRegex;
try {
  hanRegex = /\p{Script=Han}/u;
} catch (error) {
  hanRegex = /[\u3400-\u9fff\uf900-\ufaff]/;
}

const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const pinyinMap = new Map(library.map((item) => [item.char, item.pinyin]));

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value) {
  const [y, m, d] = String(value).split("-").map((item) => Number.parseInt(item, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function addDays(date, offset) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

function extractHanChars(text) {
  return [...String(text ?? "")].filter((char) => hanRegex.test(char));
}

function uniqueChars(chars) {
  return [...new Set(chars)];
}

function loadCompletion() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.completion = raw ? JSON.parse(raw) : {};
  } catch (error) {
    state.completion = {};
  }
}

function saveCompletion() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.completion));
  } catch (error) {
    // Ignore storage errors.
  }
}

function beginnerChars() {
  const beginner = library
    .filter(
      (item) =>
        item.levels?.includes("启蒙") ||
        item.levels?.includes("HSK1") ||
        item.ages?.includes("6-8")
    )
    .map((item) => item.char);
  return uniqueChars(beginner);
}

function charSourceFromInput() {
  const manual = uniqueChars(extractHanChars(refs.charInput.value));
  if (manual.length) {
    return manual;
  }
  return beginnerChars();
}

function stageType(index) {
  return index === 0 ? "新学" : "复习";
}

function buildPlan(chars, startDate, spanDays, newPerDay) {
  const dayMap = new Map();
  for (let i = 0; i < spanDays; i += 1) {
    const date = addDays(startDate, i);
    const key = formatDateKey(date);
    dayMap.set(key, { key, date, tasks: [] });
  }

  chars.forEach((char, idx) => {
    const firstDay = Math.floor(idx / newPerDay);
    REVIEW_OFFSETS.forEach((offset, stageIdx) => {
      const dayIndex = firstDay + offset;
      if (dayIndex < 0 || dayIndex >= spanDays) {
        return;
      }
      const date = addDays(startDate, dayIndex);
      const key = formatDateKey(date);
      const record = dayMap.get(key);
      if (!record) {
        return;
      }
      record.tasks.push({
        id: `${key}|${char}|${stageIdx}`,
        char,
        pinyin: pinyinMap.get(char) || "",
        stageIdx,
        stageLabel: STAGE_LABELS[stageIdx],
        type: stageType(stageIdx),
      });
    });
  });

  const days = [...dayMap.values()];
  days.forEach((day) => {
    day.tasks.sort((a, b) => {
      if (a.stageIdx !== b.stageIdx) {
        return a.stageIdx - b.stageIdx;
      }
      return a.char.localeCompare(b.char, "zh-Hans-CN");
    });
  });
  return days;
}

function getPlanStats(days, chars) {
  let totalTasks = 0;
  let completed = 0;
  let todayPending = 0;
  const todayKey = formatDateKey(new Date());

  days.forEach((day) => {
    day.tasks.forEach((task) => {
      totalTasks += 1;
      if (state.completion[task.id]) {
        completed += 1;
      } else if (day.key === todayKey) {
        todayPending += 1;
      }
    });
  });

  const rate = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
  return {
    totalChars: chars.length,
    totalTasks,
    completed,
    rate,
    todayPending,
  };
}

function renderSummary(days, chars) {
  const stats = getPlanStats(days, chars);
  refs.summaryStats.innerHTML = `
    <article class="stat">
      <p class="label">学习汉字</p>
      <p class="value">${stats.totalChars}</p>
    </article>
    <article class="stat">
      <p class="label">总任务数</p>
      <p class="value">${stats.totalTasks}</p>
    </article>
    <article class="stat">
      <p class="label">已完成</p>
      <p class="value status-ok">${stats.completed}</p>
    </article>
    <article class="stat">
      <p class="label">完成率</p>
      <p class="value">${stats.rate}%</p>
    </article>
    <article class="stat">
      <p class="label">今日待复习</p>
      <p class="value status-warn">${stats.todayPending}</p>
    </article>
  `;
}

function createTaskRow(task) {
  const row = document.createElement("label");
  row.className = `task-item${state.completion[task.id] ? " done" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(state.completion[task.id]);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      state.completion[task.id] = true;
      if (store && typeof store.logActivity === "function") {
        store.logActivity("calendar_task_done", {
          char: task.char,
          stage: task.stageLabel,
          day: String(task.id).split("|")[0],
        });
      }
    } else {
      delete state.completion[task.id];
      if (store && typeof store.logActivity === "function") {
        store.logActivity("calendar_task_undo", {
          char: task.char,
          stage: task.stageLabel,
          day: String(task.id).split("|")[0],
        });
      }
    }
    saveCompletion();
    renderPlan();
  });

  const charNode = document.createElement("span");
  charNode.className = "task-char";
  charNode.textContent = task.char;

  const stage = document.createElement("span");
  stage.className = "task-stage";
  stage.textContent = task.stageLabel;

  const note = document.createElement("span");
  note.textContent = task.pinyin ? `${task.type} · ${task.pinyin}` : task.type;

  const spacer = document.createElement("span");
  spacer.className = "task-spacer";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "task-action-btn";
  addBtn.textContent = "入字帖";
  addBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (store && typeof store.addWorksheetChars === "function") {
      store.addWorksheetChars(task.char, "calendar_task");
    }
  });

  row.appendChild(checkbox);
  row.appendChild(charNode);
  row.appendChild(stage);
  row.appendChild(note);
  row.appendChild(spacer);
  row.appendChild(addBtn);
  return row;
}

function renderDayCard(day) {
  const showPendingOnly = refs.showPendingOnly.checked;
  const tasks = showPendingOnly
    ? day.tasks.filter((task) => !state.completion[task.id])
    : day.tasks;
  if (showPendingOnly && !tasks.length) {
    return null;
  }

  const pendingCount = day.tasks.filter((task) => !state.completion[task.id]).length;
  const newCount = day.tasks.filter((task) => task.stageIdx === 0).length;
  const reviewCount = day.tasks.length - newCount;

  const card = document.createElement("article");
  card.className = "day-card";
  card.innerHTML = `
    <div class="day-head">
      <div class="day-date">${day.key}（${weekdays[day.date.getDay()]}）</div>
      <span class="day-badge">新学 ${newCount} / 复习 ${reviewCount} / 待完成 ${pendingCount}</span>
    </div>
  `;

  const taskList = document.createElement("div");
  taskList.className = "task-list";
  if (!tasks.length) {
    taskList.innerHTML = `<p class="empty">今日任务已全部完成。</p>`;
  } else {
    tasks.forEach((task) => taskList.appendChild(createTaskRow(task)));
  }
  card.appendChild(taskList);
  return card;
}

function renderPlan() {
  const plan = state.plan;
  if (!plan || !plan.length) {
    refs.calendarGrid.innerHTML = `<p class="empty">请先生成学习计划。</p>`;
    refs.calendarMeta.textContent = "生成计划后显示。";
    refs.summaryStats.innerHTML = "";
    return;
  }

  renderSummary(plan, state.chars);
  refs.calendarMeta.textContent = `复习间隔：${REVIEW_OFFSETS.join(" / ")} 天`;

  refs.calendarGrid.innerHTML = "";
  const cards = plan.map((day) => renderDayCard(day)).filter(Boolean);
  if (!cards.length) {
    refs.calendarGrid.innerHTML = `<p class="empty">当前筛选下没有待显示任务。</p>`;
    return;
  }
  cards.forEach((card) => refs.calendarGrid.appendChild(card));
}

function generateCalendar() {
  const chars = charSourceFromInput();
  const start = refs.startDate.value ? parseDateKey(refs.startDate.value) : new Date();
  const spanDays = Math.min(Math.max(Number.parseInt(refs.spanDays.value, 10) || 45, 7), 120);
  const newPerDay = Math.min(Math.max(Number.parseInt(refs.newPerDay.value, 10) || 2, 1), 12);

  if (!chars.length) {
    refs.calendarGrid.innerHTML = `<p class="empty">未获取到可学习的汉字，请输入至少一个汉字。</p>`;
    refs.summaryStats.innerHTML = "";
    return;
  }

  state.chars = chars;
  state.plan = buildPlan(chars, start, spanDays, newPerDay);
  refs.charInput.value = chars.join("");
  renderPlan();
}

function setDefaultStartDate() {
  refs.startDate.value = formatDateKey(new Date());
}

function initFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const queryChars = uniqueChars(extractHanChars(params.get("chars") || ""));
  if (queryChars.length) {
    refs.charInput.value = queryChars.join("");
  }
}

function bindEvents() {
  refs.fillBeginnerBtn.addEventListener("click", () => {
    refs.charInput.value = beginnerChars().join("");
    generateCalendar();
  });
  refs.generateBtn.addEventListener("click", generateCalendar);
  refs.showPendingOnly.addEventListener("change", renderPlan);
  refs.resetProgressBtn.addEventListener("click", () => {
    state.completion = {};
    saveCompletion();
    renderPlan();
  });
}

function bootstrap() {
  loadCompletion();
  setDefaultStartDate();
  initFromQuery();
  bindEvents();
  generateCalendar();
}

bootstrap();
