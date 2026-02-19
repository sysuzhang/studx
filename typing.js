const refs = {
  modeSelect: document.getElementById("modeSelect"),
  levelFilter: document.getElementById("levelFilter"),
  durationSelect: document.getElementById("durationSelect"),
  includeWords: document.getElementById("includeWords"),
  startBtn: document.getElementById("startBtn"),
  skipBtn: document.getElementById("skipBtn"),
  endBtn: document.getElementById("endBtn"),
  scoreValue: document.getElementById("scoreValue"),
  comboValue: document.getElementById("comboValue"),
  lifeValue: document.getElementById("lifeValue"),
  timerValue: document.getElementById("timerValue"),
  accuracyValue: document.getElementById("accuracyValue"),
  promptType: document.getElementById("promptType"),
  promptText: document.getElementById("promptText"),
  promptHint: document.getElementById("promptHint"),
  answerInput: document.getElementById("answerInput"),
  submitBtn: document.getElementById("submitBtn"),
  feedbackText: document.getElementById("feedbackText"),
  addWrongToCartBtn: document.getElementById("addWrongToCartBtn"),
  openWorksheetLink: document.getElementById("openWorksheetLink"),
  sessionSummary: document.getElementById("sessionSummary"),
  historyBody: document.getElementById("historyBody"),
  keySetSelect: document.getElementById("keySetSelect"),
  keyboardDurationSelect: document.getElementById("keyboardDurationSelect"),
  keyboardStartBtn: document.getElementById("keyboardStartBtn"),
  keyboardEndBtn: document.getElementById("keyboardEndBtn"),
  targetKeyValue: document.getElementById("targetKeyValue"),
  keyboardTimerValue: document.getElementById("keyboardTimerValue"),
  keyboardStreakValue: document.getElementById("keyboardStreakValue"),
  keyboardAccuracyValue: document.getElementById("keyboardAccuracyValue"),
  keyboardSpeedValue: document.getElementById("keyboardSpeedValue"),
  fingerHintText: document.getElementById("fingerHintText"),
  keyboardFeedbackText: document.getElementById("keyboardFeedbackText"),
  virtualKeyboard: document.getElementById("virtualKeyboard"),
  keyboardSummary: document.getElementById("keyboardSummary"),
  keyboardHistoryBody: document.getElementById("keyboardHistoryBody"),
};

const store = window.LearningStore;
const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];

const state = {
  running: false,
  timerId: null,
  timeLeft: 60,
  mode: "hanzi",
  duration: 60,
  score: 0,
  combo: 0,
  maxCombo: 0,
  lives: 3,
  total: 0,
  correct: 0,
  prompt: null,
  wrongChars: new Set(),
  pool: [],
  keyboard: {
    running: false,
    timerId: null,
    flashTimerId: null,
    timeLeft: 60,
    duration: 60,
    keySet: "home",
    targetKey: "",
    hits: 0,
    misses: 0,
    streak: 0,
    maxStreak: 0,
    startTs: 0,
    flashKey: "",
    flashType: "",
  },
};

const levelBuckets = {
  basic: new Set(["启蒙", "HSK1"]),
  mid: new Set(["HSK2", "HSK3"]),
  high: new Set(["HSK4+"]),
};

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

function normalizePinyin(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[āáǎà]/g, "a")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "v")
    .replace(/[1-5]/g, "")
    .replace(/[^a-zv]/g, "");
}

function hanChars(text) {
  return [...String(text ?? "")].filter((char) => /[\u3400-\u9fff\uf900-\ufaff]/.test(char));
}

function formatTime(ts) {
  const date = new Date(ts);
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${h}:${min}`;
}

function formatKeyLabel(key) {
  return key === ";" ? ";" : String(key ?? "").toUpperCase();
}

function setFeedback(type, text) {
  refs.feedbackText.className = `feedback ${type}`.trim();
  refs.feedbackText.textContent = text;
}

function setKeyboardFeedback(type, text) {
  refs.keyboardFeedbackText.className = `feedback ${type}`.trim();
  refs.keyboardFeedbackText.textContent = text;
}

function refreshScoreBoard() {
  refs.scoreValue.textContent = `${state.score}`;
  refs.comboValue.textContent = `${state.combo}`;
  refs.lifeValue.textContent = "❤ ".repeat(Math.max(0, state.lives)).trim() || "—";
  refs.timerValue.textContent = `${state.timeLeft}s`;
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  refs.accuracyValue.textContent = `${accuracy}%`;
}

function refreshKeyboardBoard() {
  const keyboard = state.keyboard;
  const total = keyboard.hits + keyboard.misses;
  const accuracy = total ? Math.round((keyboard.hits / total) * 100) : 0;
  const elapsedSeconds = keyboard.startTs ? Math.max(1, Math.floor((Date.now() - keyboard.startTs) / 1000)) : 0;
  const speed = elapsedSeconds ? Math.round((keyboard.hits / elapsedSeconds) * 60) : 0;
  refs.targetKeyValue.textContent = keyboard.targetKey ? formatKeyLabel(keyboard.targetKey) : "-";
  refs.keyboardTimerValue.textContent = `${keyboard.timeLeft}s`;
  refs.keyboardStreakValue.textContent = `${keyboard.streak}`;
  refs.keyboardAccuracyValue.textContent = `${accuracy}%`;
  refs.keyboardSpeedValue.textContent = `${speed}`;
  return { accuracy, speed, total };
}

function buildPools() {
  const charPool = library.map((item) => ({
    kind: "char",
    text: item.char,
    pinyin: item.pinyin || "",
    expectedPinyin: [normalizePinyin(item.pinyin || "")].filter(Boolean),
    meaning: item.meaning || "",
    levels: item.levels || [],
  }));

  const pinyinMap = new Map(library.map((item) => [item.char, item.pinyin]));
  const seenWords = new Set();
  const wordPool = [];
  library.forEach((item) => {
    (item.words || []).forEach((word) => {
      const text = word.word || "";
      if (!text || seenWords.has(text)) {
        return;
      }
      const chars = hanChars(text);
      if (!chars.length) {
        return;
      }
      const pyList = chars.map((char) => pinyinMap.get(char) || "");
      const ok = pyList.every(Boolean);
      seenWords.add(text);
      wordPool.push({
        kind: "word",
        text,
        pinyin: ok ? pyList.join(" ") : "",
        expectedPinyin: ok ? [normalizePinyin(pyList.join(""))] : [],
        meaning: word.meaning || "",
        levels: item.levels || [],
      });
    });
  });
  return { charPool, wordPool };
}

function filterByLevel(pool) {
  const levelFilter = refs.levelFilter.value;
  if (levelFilter === "all") {
    return pool;
  }
  const bucket = levelBuckets[levelFilter];
  if (!bucket) {
    return pool;
  }
  return pool.filter((item) => item.levels.some((lv) => bucket.has(lv)));
}

function buildRoundPool() {
  const { charPool, wordPool } = buildPools();
  let pool = [];

  if (state.mode === "hanzi") {
    pool = refs.includeWords.checked ? [...charPool, ...wordPool] : [...charPool];
  } else {
    const pinyinWordPool = refs.includeWords.checked
      ? wordPool.filter((item) => item.expectedPinyin.length)
      : [];
    pool = [...charPool.filter((item) => item.expectedPinyin.length), ...pinyinWordPool];
  }

  pool = filterByLevel(pool);
  return pool;
}

function pickPrompt() {
  if (!state.pool.length) {
    state.prompt = null;
    refs.promptText.textContent = "当前条件下没有可用题目";
    refs.promptHint.textContent = "请调整级别或题型设置。";
    return;
  }
  const random = state.pool[Math.floor(Math.random() * state.pool.length)];
  state.prompt = random;
  refs.promptType.textContent = `题型：${state.mode === "hanzi" ? "汉字输入" : "拼音输入"} / ${
    random.kind === "char" ? "单字" : "词组"
  }`;
  refs.promptText.textContent = random.text;
  refs.promptHint.textContent =
    state.mode === "hanzi"
      ? `提示：${random.meaning || random.pinyin || "输入与题目相同的汉字"}`
      : `提示：请输入拼音（可不带声调）；释义：${random.meaning || "—"}`;
  refs.answerInput.value = "";
  refs.answerInput.focus();
}

function updateWorksheetLinkByWrong() {
  const wrongChars = [...state.wrongChars];
  refs.openWorksheetLink.href = wrongChars.length
    ? `./worksheet.html?chars=${encodeURIComponent(wrongChars.join(""))}`
    : "./worksheet.html";
}

function getKeyboardSetChars() {
  return KEYBOARD_SETS[state.keyboard.keySet] || KEYBOARD_SETS.home;
}

function getKeyboardSetLabel(keySet) {
  return KEYBOARD_SET_LABEL[keySet] || "键位练习";
}

function updateFingerHint() {
  const key = state.keyboard.targetKey;
  if (!key) {
    refs.fingerHintText.textContent = "手指提示：请点击“开始键位练习”。";
    return;
  }
  const finger = FINGER_HINTS[key] || "对应手指";
  refs.fingerHintText.textContent = `手指提示：目标按键 ${formatKeyLabel(key)}，建议使用 ${finger}。`;
}

function renderVirtualKeyboard() {
  refs.virtualKeyboard.innerHTML = "";
  KEYBOARD_ROWS.forEach((rowKeys) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";
    rowKeys.forEach((key) => {
      const item = document.createElement("span");
      item.className = "vk-key";
      if (key === state.keyboard.targetKey) {
        item.classList.add("target");
      }
      if (key === state.keyboard.flashKey && state.keyboard.flashType) {
        item.classList.add(state.keyboard.flashType);
      }
      item.textContent = formatKeyLabel(key);
      row.appendChild(item);
    });
    refs.virtualKeyboard.appendChild(row);
  });
}

function flashKeyboardKey(key, type) {
  if (state.keyboard.flashTimerId) {
    clearTimeout(state.keyboard.flashTimerId);
  }
  state.keyboard.flashKey = key;
  state.keyboard.flashType = type;
  renderVirtualKeyboard();
  state.keyboard.flashTimerId = setTimeout(() => {
    state.keyboard.flashKey = "";
    state.keyboard.flashType = "";
    renderVirtualKeyboard();
  }, 150);
}

function pickKeyboardTarget() {
  const set = getKeyboardSetChars();
  if (!set.length) {
    state.keyboard.targetKey = "";
    refreshKeyboardBoard();
    updateFingerHint();
    renderVirtualKeyboard();
    return;
  }
  let next = set[Math.floor(Math.random() * set.length)];
  if (set.length > 1) {
    while (next === state.keyboard.targetKey) {
      next = set[Math.floor(Math.random() * set.length)];
    }
  }
  state.keyboard.targetKey = next;
  refreshKeyboardBoard();
  updateFingerHint();
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

function endGame(reason) {
  if (!state.running) {
    return;
  }
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  setFeedback("warn", `${reason}。本局结束，得分 ${state.score}。`);
  refs.promptType.textContent = "题型：本局已结束";
  refs.promptText.textContent = "可点击“开始闯关”再来一局";
  refs.promptHint.textContent = "建议把错题字加入字帖继续巩固。";
  refs.answerInput.value = "";

  const record = {
    mode: state.mode,
    score: state.score,
    accuracy,
    correct: state.correct,
    total: state.total,
    maxCombo: state.maxCombo,
    duration: state.duration,
    wrongChars: [...state.wrongChars],
    source: "typing_game",
  };
  if (store && typeof store.appendTypingGameRecord === "function") {
    store.appendTypingGameRecord(record);
  }

  refs.sessionSummary.innerHTML = `
    <p>本局模式：${state.mode === "hanzi" ? "汉字打字" : "拼音打字"}</p>
    <p>最终分数：${state.score}</p>
    <p>正确 / 总题：${state.correct} / ${state.total}</p>
    <p>命中率：${accuracy}%</p>
    <p>连击峰值：${state.maxCombo}</p>
    <p>错题字：${[...state.wrongChars].join("") || "无"}</p>
  `;
  updateWorksheetLinkByWrong();
  renderHistory();
}

function renderKeyboardHistory() {
  refs.keyboardHistoryBody.innerHTML = "";
  const records =
    store && typeof store.getKeyboardPracticeRecords === "function" ? store.getKeyboardPracticeRecords() : [];
  const latest = records.slice(-12).reverse();
  if (!latest.length) {
    refs.keyboardHistoryBody.innerHTML = `<tr><td colspan="6" class="empty">暂无记录，开始第一局键位练习吧。</td></tr>`;
    return;
  }
  latest.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatTime(item.ts)}</td>
      <td>${getKeyboardSetLabel(item.keySet)}</td>
      <td>${item.hits}</td>
      <td>${item.accuracy}%</td>
      <td>${item.speed}</td>
      <td>${item.maxStreak}</td>
    `;
    refs.keyboardHistoryBody.appendChild(row);
  });
}

function endKeyboardPractice(reason) {
  if (!state.keyboard.running) {
    return;
  }
  const keyboard = state.keyboard;
  keyboard.running = false;
  if (keyboard.timerId) {
    clearInterval(keyboard.timerId);
    keyboard.timerId = null;
  }
  if (keyboard.flashTimerId) {
    clearTimeout(keyboard.flashTimerId);
    keyboard.flashTimerId = null;
  }

  const stats = refreshKeyboardBoard();
  keyboard.targetKey = "";
  keyboard.flashKey = "";
  keyboard.flashType = "";
  updateFingerHint();
  renderVirtualKeyboard();
  setKeyboardFeedback("warn", `${reason}。本局命中 ${keyboard.hits} 次。`);

  const record = {
    keySet: keyboard.keySet,
    duration: keyboard.duration,
    hits: keyboard.hits,
    misses: keyboard.misses,
    total: keyboard.hits + keyboard.misses,
    accuracy: stats.accuracy,
    speed: stats.speed,
    maxStreak: keyboard.maxStreak,
    source: "keyboard_practice",
  };
  if (store && typeof store.appendKeyboardPracticeRecord === "function") {
    store.appendKeyboardPracticeRecord(record);
  }

  refs.keyboardSummary.innerHTML = `
    <p>键位集：${getKeyboardSetLabel(keyboard.keySet)}</p>
    <p>命中 / 总按键：${keyboard.hits} / ${keyboard.hits + keyboard.misses}</p>
    <p>命中率：${stats.accuracy}%</p>
    <p>速度：${stats.speed} 键/分</p>
    <p>连对峰值：${keyboard.maxStreak}</p>
  `;
  renderKeyboardHistory();
}

function tickKeyboardPractice() {
  if (!state.keyboard.running) {
    return;
  }
  state.keyboard.timeLeft -= 1;
  refreshKeyboardBoard();
  if (state.keyboard.timeLeft <= 0) {
    endKeyboardPractice("时间到");
  }
}

function startKeyboardPractice() {
  if (state.keyboard.running) {
    return;
  }
  state.keyboard.keySet = refs.keySetSelect.value || "home";
  state.keyboard.duration = Number.parseInt(refs.keyboardDurationSelect.value, 10) || 60;
  state.keyboard.timeLeft = state.keyboard.duration;
  state.keyboard.hits = 0;
  state.keyboard.misses = 0;
  state.keyboard.streak = 0;
  state.keyboard.maxStreak = 0;
  state.keyboard.startTs = Date.now();
  state.keyboard.flashKey = "";
  state.keyboard.flashType = "";
  state.keyboard.running = true;

  refs.keyboardSummary.innerHTML = `<p class="empty">键位练习进行中...</p>`;
  setKeyboardFeedback("warn", "键位练习开始，请按下目标按键。");
  pickKeyboardTarget();

  if (state.keyboard.timerId) {
    clearInterval(state.keyboard.timerId);
  }
  state.keyboard.timerId = setInterval(tickKeyboardPractice, 1000);
  refreshKeyboardBoard();
}

function handleKeyboardPracticeInput(event) {
  if (!state.keyboard.running || event.repeat) {
    return;
  }
  const key = normalizeKeyboardInput(event.key);
  if (!key) {
    return;
  }
  event.preventDefault();
  const allowed = getKeyboardSetChars();
  if (key === state.keyboard.targetKey) {
    state.keyboard.hits += 1;
    state.keyboard.streak += 1;
    state.keyboard.maxStreak = Math.max(state.keyboard.maxStreak, state.keyboard.streak);
    setKeyboardFeedback("ok", `正确：${formatKeyLabel(key)}。继续保持！`);
    flashKeyboardKey(key, "hit");
    pickKeyboardTarget();
  } else {
    state.keyboard.misses += 1;
    state.keyboard.streak = 0;
    if (allowed.includes(key)) {
      setKeyboardFeedback(
        "bad",
        `按键 ${formatKeyLabel(key)} 错误，目标是 ${formatKeyLabel(state.keyboard.targetKey)}。`
      );
    } else {
      setKeyboardFeedback("warn", `按键 ${formatKeyLabel(key)} 不在当前键位集内。`);
    }
    flashKeyboardKey(key, "miss");
  }
  refreshKeyboardBoard();
}

function applyCorrect() {
  state.correct += 1;
  state.total += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += 10 + state.combo * 2;
  setFeedback("ok", `正确！连击 +1，当前连击 ${state.combo}`);
}

function applyWrong(expectedText, sourceText) {
  state.total += 1;
  state.combo = 0;
  state.lives -= 1;
  hanChars(sourceText || "").forEach((char) => state.wrongChars.add(char));
  setFeedback("bad", `错误，正确答案应为：${expectedText}`);
  updateWorksheetLinkByWrong();
}

function submitAnswer() {
  if (!state.running || !state.prompt) {
    return;
  }
  const input = refs.answerInput.value.trim();
  if (!input) {
    return;
  }

  let ok = false;
  if (state.mode === "hanzi") {
    ok = input === state.prompt.text;
  } else {
    const norm = normalizePinyin(input);
    ok = state.prompt.expectedPinyin.includes(norm);
  }

  if (ok) {
    applyCorrect();
  } else {
    const expected = state.mode === "hanzi" ? state.prompt.text : state.prompt.pinyin || "（可不带声调）";
    applyWrong(expected, state.prompt.text);
  }
  refreshScoreBoard();

  if (state.lives <= 0) {
    endGame("生命值耗尽");
    return;
  }
  pickPrompt();
}

function skipPrompt() {
  if (!state.running || !state.prompt) {
    return;
  }
  state.combo = 0;
  state.lives -= 1;
  state.total += 1;
  hanChars(state.prompt.text).forEach((char) => state.wrongChars.add(char));
  setFeedback(
    "warn",
    `已跳过，正确答案参考：${state.mode === "hanzi" ? state.prompt.text : state.prompt.pinyin || "（可不带声调）"}`
  );
  updateWorksheetLinkByWrong();
  refreshScoreBoard();
  if (state.lives <= 0) {
    endGame("生命值耗尽");
    return;
  }
  pickPrompt();
}

function tick() {
  if (!state.running) {
    return;
  }
  state.timeLeft -= 1;
  refreshScoreBoard();
  if (state.timeLeft <= 0) {
    endGame("时间到");
  }
}

function startGame() {
  if (state.running) {
    return;
  }
  state.mode = refs.modeSelect.value;
  state.duration = Number.parseInt(refs.durationSelect.value, 10) || 60;
  state.timeLeft = state.duration;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.lives = 3;
  state.total = 0;
  state.correct = 0;
  state.wrongChars = new Set();
  state.pool = buildRoundPool();
  state.running = true;

  if (!state.pool.length) {
    state.running = false;
    refreshScoreBoard();
    setFeedback("bad", "当前条件下没有可用题目，请调整设置。");
    return;
  }

  refreshScoreBoard();
  setFeedback("warn", "游戏开始，尽量保持连击！");
  refs.sessionSummary.innerHTML = `<p class="empty">本局进行中...</p>`;
  updateWorksheetLinkByWrong();
  pickPrompt();

  if (state.timerId) {
    clearInterval(state.timerId);
  }
  state.timerId = setInterval(tick, 1000);
}

function addWrongToCart() {
  const chars = [...state.wrongChars];
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    setFeedback("warn", "暂无错题字可加入字帖。");
    return;
  }
  const result = store.addWorksheetChars(chars, "typing_wrong_chars");
  setFeedback("ok", `已加入字帖收藏：${result.added.join("") || chars.join("")}`);
}

function renderHistory() {
  refs.historyBody.innerHTML = "";
  const records = store && typeof store.getTypingGameRecords === "function" ? store.getTypingGameRecords() : [];
  const latest = records.slice(-12).reverse();
  if (!latest.length) {
    refs.historyBody.innerHTML = `<tr><td colspan="5" class="empty">暂无战绩，开始第一局吧。</td></tr>`;
    return;
  }
  latest.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatTime(item.ts)}</td>
      <td>${item.mode === "hanzi" ? "汉字" : "拼音"}</td>
      <td>${item.score}</td>
      <td>${item.accuracy}%</td>
      <td>${item.maxCombo}</td>
    `;
    refs.historyBody.appendChild(row);
  });
}

function bindEvents() {
  refs.startBtn.addEventListener("click", startGame);
  refs.skipBtn.addEventListener("click", skipPrompt);
  refs.endBtn.addEventListener("click", () => endGame("已手动结束"));
  refs.submitBtn.addEventListener("click", submitAnswer);
  refs.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitAnswer();
    }
  });
  refs.addWrongToCartBtn.addEventListener("click", addWrongToCart);
  refs.keyboardStartBtn.addEventListener("click", startKeyboardPractice);
  refs.keyboardEndBtn.addEventListener("click", () => endKeyboardPractice("已手动结束"));
  window.addEventListener("keydown", handleKeyboardPracticeInput);
}

function bootstrap() {
  bindEvents();
  refreshScoreBoard();
  refreshKeyboardBoard();
  refs.promptType.textContent = "题型：待开始";
  refs.promptHint.textContent = "提示：选择模式后点击“开始闯关”。";
  refs.sessionSummary.innerHTML = `<p class="empty">尚未开始本局。</p>`;
  refs.keyboardSummary.innerHTML = `<p class="empty">尚未开始键位练习。</p>`;
  updateFingerHint();
  renderHistory();
  renderKeyboardHistory();
  renderVirtualKeyboard();
  updateWorksheetLinkByWrong();
}

bootstrap();
