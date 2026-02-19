const refs = {
  keySetSelect: document.getElementById("keySetSelect"),
  keyboardDurationSelect: document.getElementById("keyboardDurationSelect"),
  keyboardLevelSelect: document.getElementById("keyboardLevelSelect"),
  keyboardStartBtn: document.getElementById("keyboardStartBtn"),
  keyboardEndBtn: document.getElementById("keyboardEndBtn"),
  dailyTaskApplyBtn: document.getElementById("dailyTaskApplyBtn"),
  keyboardScoreValue: document.getElementById("keyboardScoreValue"),
  targetKeyValue: document.getElementById("targetKeyValue"),
  targetKeyValueBig: document.getElementById("targetKeyValueBig"),
  keyboardTimerValue: document.getElementById("keyboardTimerValue"),
  keyboardStreakValue: document.getElementById("keyboardStreakValue"),
  keyboardAccuracyValue: document.getElementById("keyboardAccuracyValue"),
  keyboardSpeedValue: document.getElementById("keyboardSpeedValue"),
  fingerHintText: document.getElementById("fingerHintText"),
  keyboardFeedbackText: document.getElementById("keyboardFeedbackText"),
  keyQueueStream: document.getElementById("keyQueueStream"),
  virtualKeyboard: document.getElementById("virtualKeyboard"),
  keyMissionTitle: document.getElementById("keyMissionTitle"),
  keyMissionDesc: document.getElementById("keyMissionDesc"),
  keyMissionStatus: document.getElementById("keyMissionStatus"),
  dailyTaskTitle: document.getElementById("dailyTaskTitle"),
  dailyTaskDesc: document.getElementById("dailyTaskDesc"),
  dailyTaskProgress: document.getElementById("dailyTaskProgress"),
  dailyTaskStatus: document.getElementById("dailyTaskStatus"),
  keyboardSummary: document.getElementById("keyboardSummary"),
  keyboardHistoryBody: document.getElementById("keyboardHistoryBody"),
};

const store = window.LearningStore;

const KEYBOARD_SETS = {
  home: ["a", "s", "d", "f", "j", "k", "l", ";"],
  pinyin: [..."abcdefghijklmnopqrstuvwxyz"],
  full: [..."abcdefghijklmnopqrstuvwxyz", ";"],
};

const KEYBOARD_SET_LABEL = {
  home: "基础键位",
  pinyin: "拼音高频字母",
  full: "全字母+分号",
};

const KEYBOARD_LEVEL_LABEL = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

const KEYBOARD_LEVEL_CONFIG = {
  beginner: {
    hitPoint: 10,
    streakBonus: 1,
    missPenalty: 3,
  },
  intermediate: {
    hitPoint: 14,
    streakBonus: 2,
    missPenalty: 5,
  },
  advanced: {
    hitPoint: 18,
    streakBonus: 3,
    missPenalty: 8,
  },
};

const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const FINGER_HINTS = {
  q: "左手小指",
  a: "左手小指",
  z: "左手小指",
  w: "左手无名指",
  s: "左手无名指",
  x: "左手无名指",
  e: "左手中指",
  d: "左手中指",
  c: "左手中指",
  r: "左手食指",
  f: "左手食指",
  v: "左手食指",
  t: "左手食指",
  g: "左手食指",
  b: "左手食指",
  y: "右手食指",
  h: "右手食指",
  n: "右手食指",
  u: "右手食指",
  j: "右手食指",
  m: "右手食指",
  i: "右手中指",
  k: "右手中指",
  o: "右手无名指",
  l: "右手无名指",
  p: "右手小指",
  ";": "右手小指",
};

const MISSION_POOL = {
  beginner: [
    {
      id: "streak10",
      title: "连对新星",
      desc: "单局连对达到 10 次",
      reward: 60,
      finalOnly: false,
      check: (ctx) => ctx.maxStreak >= 10,
    },
    {
      id: "hits70",
      title: "命中达人",
      desc: "单局命中达到 70 次",
      reward: 80,
      finalOnly: false,
      check: (ctx) => ctx.hits >= 70,
    },
    {
      id: "acc85",
      title: "稳定输出",
      desc: "结束命中率不低于 85%",
      reward: 90,
      finalOnly: true,
      check: (ctx) => ctx.total >= 20 && ctx.accuracy >= 85,
    },
  ],
  intermediate: [
    {
      id: "streak16",
      title: "节奏大师",
      desc: "单局连对达到 16 次",
      reward: 90,
      finalOnly: false,
      check: (ctx) => ctx.maxStreak >= 16,
    },
    {
      id: "hits110",
      title: "火力全开",
      desc: "单局命中达到 110 次",
      reward: 120,
      finalOnly: false,
      check: (ctx) => ctx.hits >= 110,
    },
    {
      id: "speed150",
      title: "极速挑战",
      desc: "结束速度不低于 150 键/分",
      reward: 130,
      finalOnly: true,
      check: (ctx) => ctx.total >= 25 && ctx.speed >= 150,
    },
  ],
  advanced: [
    {
      id: "streak24",
      title: "连击王者",
      desc: "单局连对达到 24 次",
      reward: 140,
      finalOnly: false,
      check: (ctx) => ctx.maxStreak >= 24,
    },
    {
      id: "hits150",
      title: "超频输出",
      desc: "单局命中达到 150 次",
      reward: 160,
      finalOnly: false,
      check: (ctx) => ctx.hits >= 150,
    },
    {
      id: "acc92",
      title: "神准节奏",
      desc: "结束命中率不低于 92%",
      reward: 180,
      finalOnly: true,
      check: (ctx) => ctx.total >= 35 && ctx.accuracy >= 92,
    },
  ],
};

const state = {
  running: false,
  timerId: null,
  flashTimerId: null,
  keySet: "home",
  level: "beginner",
  duration: 60,
  timeLeft: 60,
  score: 0,
  hits: 0,
  misses: 0,
  streak: 0,
  maxStreak: 0,
  startTs: 0,
  targetKey: "",
  keyQueue: [],
  flashKey: "",
  flashType: "",
  mission: null,
};

function formatTime(ts) {
  const date = new Date(ts);
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${h}:${min}`;
}

function toDateKey(ts) {
  const date = new Date(Number.isFinite(ts) ? ts : Date.now());
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatKeyLabel(key) {
  return key === ";" ? ";" : String(key ?? "").toUpperCase();
}

function getKeyboardSetChars() {
  return KEYBOARD_SETS[state.keySet] || KEYBOARD_SETS.home;
}

function getKeyboardSetLabel(keySet) {
  return KEYBOARD_SET_LABEL[keySet] || "键位练习";
}

function getKeyboardLevelLabel(level) {
  return KEYBOARD_LEVEL_LABEL[level] || "初级";
}

function getKeyboardLevelConfig(level) {
  return KEYBOARD_LEVEL_CONFIG[level] || KEYBOARD_LEVEL_CONFIG.beginner;
}

function setKeyboardFeedback(type, text) {
  refs.keyboardFeedbackText.className = `feedback ${type}`.trim();
  refs.keyboardFeedbackText.textContent = text;
}

function computeLiveStats() {
  const total = state.hits + state.misses;
  const accuracy = total ? Math.round((state.hits / total) * 100) : 0;
  const elapsedSeconds = state.startTs ? Math.max(1, Math.floor((Date.now() - state.startTs) / 1000)) : 0;
  const speed = elapsedSeconds ? Math.round((state.hits / elapsedSeconds) * 60) : 0;
  return { total, accuracy, speed };
}

function refreshBoard() {
  const { total, accuracy, speed } = computeLiveStats();
  refs.keyboardScoreValue.textContent = `${state.score}`;
  refs.targetKeyValue.textContent = state.targetKey ? formatKeyLabel(state.targetKey) : "-";
  refs.targetKeyValueBig.textContent = state.targetKey ? formatKeyLabel(state.targetKey) : "-";
  refs.keyboardTimerValue.textContent = `${state.timeLeft}s`;
  refs.keyboardStreakValue.textContent = `${state.streak}`;
  refs.keyboardAccuracyValue.textContent = `${accuracy}%`;
  refs.keyboardSpeedValue.textContent = `${speed}`;
  return { total, accuracy, speed };
}

function updateFingerHint() {
  if (!state.targetKey) {
    refs.fingerHintText.textContent = "手指提示：请点击“开始练习”。";
    return;
  }
  const finger = FINGER_HINTS[state.targetKey] || "对应手指";
  refs.fingerHintText.textContent = `手指提示：目标按键 ${formatKeyLabel(state.targetKey)}，建议使用 ${finger}。`;
}

function renderVirtualKeyboard() {
  refs.virtualKeyboard.innerHTML = "";
  KEYBOARD_ROWS.forEach((rowKeys) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";
    rowKeys.forEach((key) => {
      const item = document.createElement("span");
      item.className = "vk-key";
      if (key === state.targetKey) {
        item.classList.add("target");
      }
      if (key === state.flashKey && state.flashType) {
        item.classList.add(state.flashType);
      }
      item.textContent = formatKeyLabel(key);
      row.appendChild(item);
    });
    refs.virtualKeyboard.appendChild(row);
  });
}

function flashKeyboardKey(key, type) {
  if (state.flashTimerId) {
    clearTimeout(state.flashTimerId);
  }
  state.flashKey = key;
  state.flashType = type;
  renderVirtualKeyboard();
  state.flashTimerId = setTimeout(() => {
    state.flashKey = "";
    state.flashType = "";
    renderVirtualKeyboard();
  }, 150);
}

function randomKey(exclude) {
  const set = getKeyboardSetChars();
  if (!set.length) {
    return "";
  }
  let next = set[Math.floor(Math.random() * set.length)];
  if (set.length > 1) {
    while (next === exclude) {
      next = set[Math.floor(Math.random() * set.length)];
    }
  }
  return next;
}

function refillQueue(minCount) {
  while (state.keyQueue.length < minCount) {
    const next = randomKey(state.keyQueue[state.keyQueue.length - 1] || "");
    if (!next) {
      break;
    }
    state.keyQueue.push(next);
  }
}

function renderQueueStream() {
  refs.keyQueueStream.innerHTML = "";
  if (!state.keyQueue.length) {
    refs.keyQueueStream.innerHTML = `<span class="queue-chip active">-</span>`;
    return;
  }
  let activeEl = null;
  state.keyQueue.slice(0, 40).forEach((key, idx) => {
    const chip = document.createElement("span");
    chip.className = `queue-chip${idx === 0 ? " active" : ""}`;
    chip.textContent = formatKeyLabel(key);
    refs.keyQueueStream.appendChild(chip);
    if (idx === 0) {
      activeEl = chip;
    }
  });
  if (activeEl) {
    setTimeout(() => {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }, 0);
  }
}

function syncTargetByQueue() {
  state.targetKey = state.keyQueue[0] || "";
  refreshBoard();
  updateFingerHint();
  renderQueueStream();
  renderVirtualKeyboard();
}

function normalizeKeyboardInput(key) {
  const text = String(key ?? "").toLowerCase();
  if (text === "；") {
    return ";";
  }
  if (text.length !== 1) {
    return "";
  }
  return /[a-z;]/.test(text) ? text : "";
}

function missionContext() {
  const { total, accuracy, speed } = computeLiveStats();
  return {
    hits: state.hits,
    misses: state.misses,
    maxStreak: state.maxStreak,
    total,
    accuracy,
    speed,
  };
}

function createMission(level) {
  const pool = MISSION_POOL[level] || MISSION_POOL.beginner;
  const mission = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...mission,
    completed: false,
    awarded: false,
  };
}

function renderMissionPanel() {
  if (!state.mission) {
    refs.keyMissionTitle.textContent = "趣味任务";
    refs.keyMissionDesc.textContent = "-";
    refs.keyMissionStatus.textContent = "状态：待开始";
    return;
  }
  refs.keyMissionTitle.textContent = `${state.mission.title}（奖励 +${state.mission.reward}）`;
  refs.keyMissionDesc.textContent = state.mission.desc;
  refs.keyMissionStatus.textContent = state.mission.completed ? "状态：已完成" : "状态：进行中";
}

function tryCompleteMission(finalPhase) {
  if (!state.mission || state.mission.completed) {
    return;
  }
  if (state.mission.finalOnly && !finalPhase) {
    return;
  }
  if (!state.mission.check(missionContext())) {
    return;
  }
  state.mission.completed = true;
  if (!state.mission.awarded) {
    state.score += state.mission.reward;
    state.mission.awarded = true;
    refreshBoard();
    setKeyboardFeedback("ok", `完成趣味任务“${state.mission.title}”，奖励 +${state.mission.reward} 分`);
  }
  renderMissionPanel();
}

function renderDailyTask(task) {
  if (!task) {
    refs.dailyTaskTitle.textContent = "今日任务不可用";
    refs.dailyTaskDesc.textContent = "当前浏览器未启用本地存储。";
    refs.dailyTaskProgress.textContent = "进度：-";
    refs.dailyTaskStatus.textContent = "状态：-";
    refs.dailyTaskApplyBtn.disabled = true;
    return;
  }
  refs.dailyTaskApplyBtn.disabled = false;
  refs.dailyTaskTitle.textContent = `今日任务（${getKeyboardLevelLabel(task.level)}）`;
  refs.dailyTaskDesc.textContent = `目标：键位集 ${getKeyboardSetLabel(task.keySet)}，时长 ${task.duration}s，命中 ≥ ${
    task.targetHits
  }，命中率 ≥ ${task.targetAccuracy}% ，速度 ≥ ${task.targetSpeed} 键/分。`;
  refs.dailyTaskProgress.textContent = `进度：今日已练 ${task.sessionCount || 0} 局，最佳命中 ${
    task.bestHits || 0
  }，最佳命中率 ${task.bestAccuracy || 0}% ，最佳速度 ${task.bestSpeed || 0} 键/分。`;
  refs.dailyTaskStatus.textContent = task.completed
    ? `状态：已完成（${formatTime(task.completedAt || Date.now())}）`
    : "状态：未完成";
}

function loadDailyTask() {
  if (!store || typeof store.getKeyboardDailyTask !== "function") {
    renderDailyTask(null);
    return null;
  }
  const task = store.getKeyboardDailyTask(toDateKey());
  renderDailyTask(task);
  return task;
}

function applyDailyTaskSettings() {
  const task = loadDailyTask();
  if (!task) {
    setKeyboardFeedback("warn", "每日任务暂不可用。");
    return;
  }
  refs.keySetSelect.value = task.keySet;
  refs.keyboardDurationSelect.value = `${task.duration}`;
  refs.keyboardLevelSelect.value = task.level;
  setKeyboardFeedback("ok", "已应用今日任务配置，可直接开始练习。");
}

function renderHistory() {
  refs.keyboardHistoryBody.innerHTML = "";
  const records =
    store && typeof store.getKeyboardPracticeRecords === "function" ? store.getKeyboardPracticeRecords() : [];
  const latest = records.slice(-12).reverse();
  if (!latest.length) {
    refs.keyboardHistoryBody.innerHTML = `<tr><td colspan="8" class="empty">暂无记录，开始第一局键位练习吧。</td></tr>`;
    return;
  }
  latest.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatTime(item.ts)}</td>
      <td>${getKeyboardSetLabel(item.keySet)}</td>
      <td>${getKeyboardLevelLabel(item.level)}</td>
      <td>${item.score || 0}</td>
      <td>${item.hits}</td>
      <td>${item.accuracy}%</td>
      <td>${item.speed}</td>
      <td>${item.maxStreak}</td>
    `;
    refs.keyboardHistoryBody.appendChild(row);
  });
}

function endKeyboardPractice(reason) {
  if (!state.running) {
    return;
  }
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.flashTimerId) {
    clearTimeout(state.flashTimerId);
    state.flashTimerId = null;
  }

  tryCompleteMission(true);
  const stats = refreshBoard();
  const record = {
    keySet: state.keySet,
    level: state.level,
    duration: state.duration,
    score: state.score,
    hits: state.hits,
    misses: state.misses,
    total: stats.total,
    accuracy: stats.accuracy,
    speed: stats.speed,
    maxStreak: state.maxStreak,
    source: "keyboard_practice",
  };

  if (store && typeof store.appendKeyboardPracticeRecord === "function") {
    store.appendKeyboardPracticeRecord(record);
  }

  let taskResult = null;
  if (store && typeof store.updateKeyboardDailyTaskProgress === "function") {
    taskResult = store.updateKeyboardDailyTaskProgress(record, toDateKey());
    renderDailyTask(taskResult);
  } else {
    loadDailyTask();
  }

  if (taskResult?.justCompleted) {
    setKeyboardFeedback("ok", "恭喜完成今日键位任务！");
  } else {
    setKeyboardFeedback("warn", `${reason}。本局命中 ${state.hits} 次，速度 ${stats.speed} 键/分。`);
  }

  refs.keyboardSummary.innerHTML = `
    <p>训练关卡：${getKeyboardLevelLabel(state.level)}</p>
    <p>键位集：${getKeyboardSetLabel(state.keySet)}</p>
    <p>键位积分：${state.score}</p>
    <p>命中 / 总按键：${state.hits} / ${stats.total}</p>
    <p>命中率：${stats.accuracy}%</p>
    <p>速度：${stats.speed} 键/分</p>
    <p>连对峰值：${state.maxStreak}</p>
    <p>趣味任务：${state.mission?.completed ? "已完成" : "未完成"}</p>
  `;
  renderHistory();

  state.targetKey = "";
  state.keyQueue = [];
  refreshBoard();
  updateFingerHint();
  renderQueueStream();
  renderVirtualKeyboard();
}

function tickKeyboardPractice() {
  if (!state.running) {
    return;
  }
  state.timeLeft -= 1;
  refreshBoard();
  if (state.timeLeft <= 0) {
    endKeyboardPractice("时间到");
  }
}

function startKeyboardPractice() {
  if (state.running) {
    return;
  }
  state.keySet = refs.keySetSelect.value || "home";
  state.level = refs.keyboardLevelSelect.value || "beginner";
  state.duration = Number.parseInt(refs.keyboardDurationSelect.value, 10) || 60;
  state.timeLeft = state.duration;
  state.score = 0;
  state.hits = 0;
  state.misses = 0;
  state.streak = 0;
  state.maxStreak = 0;
  state.startTs = Date.now();
  state.flashKey = "";
  state.flashType = "";
  state.mission = createMission(state.level);
  state.running = true;

  state.keyQueue = [];
  refillQueue(40);
  syncTargetByQueue();
  renderMissionPanel();

  refs.keyboardSummary.innerHTML = `<p class="empty">键位练习进行中...</p>`;
  setKeyboardFeedback("warn", `练习开始（${getKeyboardLevelLabel(state.level)}），请按下目标按键。`);
  refreshBoard();

  if (state.timerId) {
    clearInterval(state.timerId);
  }
  state.timerId = setInterval(tickKeyboardPractice, 1000);
}

function handleKeyboardInput(event) {
  if (!state.running || event.repeat) {
    return;
  }
  const tag = event.target?.tagName || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
    return;
  }

  const key = normalizeKeyboardInput(event.key);
  if (!key) {
    return;
  }
  event.preventDefault();
  const config = getKeyboardLevelConfig(state.level);
  const setChars = getKeyboardSetChars();

  if (key === state.targetKey) {
    state.hits += 1;
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    state.score += config.hitPoint + state.streak * config.streakBonus;
    setKeyboardFeedback("ok", `正确：${formatKeyLabel(key)}，自动滚动到下一按键。`);
    flashKeyboardKey(key, "hit");
    state.keyQueue.shift();
    refillQueue(40);
    tryCompleteMission(false);
  } else {
    state.misses += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - config.missPenalty);
    if (setChars.includes(key)) {
      setKeyboardFeedback(
        "bad",
        `按键 ${formatKeyLabel(key)} 错误，目标是 ${formatKeyLabel(state.targetKey)}（-${config.missPenalty}）`
      );
    } else {
      setKeyboardFeedback("warn", `按键 ${formatKeyLabel(key)} 不在当前键位集内。`);
    }
    flashKeyboardKey(key, "miss");
  }
  syncTargetByQueue();
}

function bindEvents() {
  refs.keyboardStartBtn.addEventListener("click", startKeyboardPractice);
  refs.keyboardEndBtn.addEventListener("click", () => endKeyboardPractice("已手动结束"));
  refs.dailyTaskApplyBtn.addEventListener("click", applyDailyTaskSettings);
  window.addEventListener("keydown", handleKeyboardInput);
}

function bootstrap() {
  bindEvents();
  refreshBoard();
  updateFingerHint();
  renderQueueStream();
  renderVirtualKeyboard();
  renderMissionPanel();
  loadDailyTask();
  renderHistory();
}

bootstrap();
