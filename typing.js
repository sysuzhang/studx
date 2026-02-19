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
  queueStream: document.getElementById("queueStream"),
  answerInput: document.getElementById("answerInput"),
  submitBtn: document.getElementById("submitBtn"),
  feedbackText: document.getElementById("feedbackText"),
  addWrongToCartBtn: document.getElementById("addWrongToCartBtn"),
  openWorksheetLink: document.getElementById("openWorksheetLink"),
  sessionSummary: document.getElementById("sessionSummary"),
  historyBody: document.getElementById("historyBody"),
  missionTitle: document.getElementById("missionTitle"),
  missionDesc: document.getElementById("missionDesc"),
  missionStatus: document.getElementById("missionStatus"),
};

const store = window.LearningStore;
const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];

const levelBuckets = {
  basic: new Set(["启蒙", "HSK1"]),
  mid: new Set(["HSK2", "HSK3"]),
  high: new Set(["HSK4+"]),
};

const MISSION_TEMPLATES = [
  {
    id: "combo",
    title: "连击达人",
    desc: "本局连击达到 6 次",
    reward: 80,
    finalOnly: false,
    check: (ctx) => ctx.maxCombo >= 6,
  },
  {
    id: "correct",
    title: "快手挑战",
    desc: "本局正确达到 15 题",
    reward: 100,
    finalOnly: false,
    check: (ctx) => ctx.correct >= 15,
  },
  {
    id: "word",
    title: "词组猎人",
    desc: "本局正确完成 6 个词组题",
    reward: 100,
    finalOnly: false,
    check: (ctx) => ctx.wordCorrect >= 6,
  },
  {
    id: "accuracy",
    title: "精准挑战",
    desc: "结束时命中率不低于 85%（且总题数至少 10）",
    reward: 120,
    finalOnly: true,
    check: (ctx) => ctx.accuracy >= 85 && ctx.total >= 10,
  },
];

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
  wordCorrect: 0,
  prompt: null,
  promptQueue: [],
  wrongChars: new Set(),
  pool: [],
  mission: null,
  composing: false,
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

function setFeedback(type, text) {
  refs.feedbackText.className = `feedback ${type}`.trim();
  refs.feedbackText.textContent = text;
}

function refreshScoreBoard() {
  refs.scoreValue.textContent = `${state.score}`;
  refs.comboValue.textContent = `${state.combo}`;
  refs.lifeValue.textContent = "❤ ".repeat(Math.max(0, state.lives)).trim() || "—";
  refs.timerValue.textContent = `${state.timeLeft}s`;
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  refs.accuracyValue.textContent = `${accuracy}%`;
}

function getMissionContext() {
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  return {
    maxCombo: state.maxCombo,
    correct: state.correct,
    total: state.total,
    accuracy,
    wordCorrect: state.wordCorrect,
  };
}

function renderMissionPanel() {
  if (!state.mission) {
    refs.missionTitle.textContent = "今日趣味任务";
    refs.missionDesc.textContent = "-";
    refs.missionStatus.textContent = "状态：待开始";
    return;
  }
  refs.missionTitle.textContent = `${state.mission.title}（奖励 +${state.mission.reward}）`;
  refs.missionDesc.textContent = state.mission.desc;
  refs.missionStatus.textContent = state.mission.completed ? "状态：已完成" : "状态：进行中";
}

function createMission() {
  const template = MISSION_TEMPLATES[Math.floor(Math.random() * MISSION_TEMPLATES.length)];
  return {
    ...template,
    completed: false,
    awarded: false,
  };
}

function tryCompleteMission(finalPhase) {
  if (!state.mission || state.mission.completed) {
    return;
  }
  if (state.mission.finalOnly && !finalPhase) {
    return;
  }
  if (!state.mission.check(getMissionContext())) {
    return;
  }
  state.mission.completed = true;
  if (!state.mission.awarded) {
    state.score += state.mission.reward;
    state.mission.awarded = true;
    refreshScoreBoard();
    setFeedback("ok", `完成趣味任务“${state.mission.title}”，奖励 +${state.mission.reward} 分`);
  }
  renderMissionPanel();
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
  return filterByLevel(pool);
}

function randomPrompt() {
  if (!state.pool.length) {
    return null;
  }
  const base = state.pool[Math.floor(Math.random() * state.pool.length)];
  return { ...base };
}

function refillPromptQueue(minCount) {
  while (state.promptQueue.length < minCount) {
    const next = randomPrompt();
    if (!next) {
      break;
    }
    state.promptQueue.push(next);
  }
}

function renderQueueStream() {
  refs.queueStream.innerHTML = "";
  if (!state.promptQueue.length) {
    refs.queueStream.innerHTML = `<span class="queue-chip active">无题目</span>`;
    return;
  }
  let activeEl = null;
  state.promptQueue.slice(0, 30).forEach((item, idx) => {
    const chip = document.createElement("span");
    chip.className = `queue-chip${idx === 0 ? " active" : ""}`;
    chip.textContent = item.text;
    refs.queueStream.appendChild(chip);
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

function updatePromptDisplay() {
  state.prompt = state.promptQueue[0] || null;
  if (!state.prompt) {
    refs.promptType.textContent = "题型：当前无题目";
    refs.promptText.textContent = "-";
    refs.promptHint.textContent = "提示：请重新开始闯关。";
    return;
  }
  refs.promptType.textContent = `题型：${state.mode === "hanzi" ? "汉字输入" : "拼音输入"} / ${
    state.prompt.kind === "char" ? "单字" : "词组"
  }`;
  refs.promptText.textContent = state.prompt.text;
  refs.promptHint.textContent =
    state.mode === "hanzi"
      ? `提示：${state.prompt.meaning || state.prompt.pinyin || "输入与题目相同的汉字"}`
      : `提示：请输入拼音（可不带声调）；释义：${state.prompt.meaning || "—"}`;
}

function advancePrompt() {
  if (state.promptQueue.length) {
    state.promptQueue.shift();
  }
  refillPromptQueue(30);
  renderQueueStream();
  updatePromptDisplay();
}

function updateWorksheetLinkByWrong() {
  const wrongChars = [...state.wrongChars];
  refs.openWorksheetLink.href = wrongChars.length
    ? `./worksheet.html?chars=${encodeURIComponent(wrongChars.join(""))}`
    : "./worksheet.html";
}

function getAnswerSnapshot(inputValue) {
  const input = String(inputValue ?? "").trim();
  if (!state.prompt) {
    return {
      input,
      expectedView: "",
      exact: false,
      partial: false,
    };
  }
  if (state.mode === "hanzi") {
    const expected = state.prompt.text;
    return {
      input,
      expectedView: expected,
      exact: input === expected,
      partial: !!input && expected.startsWith(input),
    };
  }
  const normalizedInput = normalizePinyin(input);
  const expectedNormalized = (state.prompt.expectedPinyin || [])[0] || "";
  return {
    input,
    expectedView: state.prompt.pinyin || "（可不带声调）",
    exact: !!normalizedInput && normalizedInput === expectedNormalized,
    partial: !!normalizedInput && expectedNormalized.startsWith(normalizedInput),
  };
}

function evaluateInputProgress() {
  if (!state.running || !state.prompt || state.composing) {
    return;
  }
  const snap = getAnswerSnapshot(refs.answerInput.value);
  if (!snap.input) {
    setFeedback("warn", "开始输入后会实时匹配正确性。");
    return;
  }
  if (snap.exact) {
    submitAnswer(true);
    return;
  }
  if (snap.partial) {
    setFeedback("warn", "匹配中：继续输入即可自动切题。");
    return;
  }
  setFeedback("bad", `当前输入与目标不匹配，目标参考：${snap.expectedView}`);
}

function applyCorrect() {
  state.correct += 1;
  state.total += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  if (state.prompt?.kind === "word") {
    state.wordCorrect += 1;
  }
  state.score += 12 + state.combo * 2;
  setFeedback("ok", `正确！连击 ${state.combo}，自动进入下一题。`);
  tryCompleteMission(false);
}

function applyWrong(expectedText, sourceText) {
  state.total += 1;
  state.combo = 0;
  state.lives -= 1;
  hanChars(sourceText || "").forEach((char) => state.wrongChars.add(char));
  setFeedback("bad", `错误，正确答案应为：${expectedText}`);
  updateWorksheetLinkByWrong();
}

function submitAnswer(fromAuto) {
  if (!state.running || !state.prompt) {
    return;
  }
  const snap = getAnswerSnapshot(refs.answerInput.value);
  if (!snap.input) {
    return;
  }
  if (snap.exact) {
    applyCorrect();
  } else {
    applyWrong(snap.expectedView, state.prompt.text);
  }
  refreshScoreBoard();

  if (state.lives <= 0) {
    endGame("生命值耗尽");
    return;
  }
  refs.answerInput.value = "";
  advancePrompt();
  if (!fromAuto) {
    refs.answerInput.focus();
  }
}

function skipPrompt() {
  if (!state.running || !state.prompt) {
    return;
  }
  state.combo = 0;
  state.lives -= 1;
  state.total += 1;
  hanChars(state.prompt.text).forEach((char) => state.wrongChars.add(char));
  const expected = state.mode === "hanzi" ? state.prompt.text : state.prompt.pinyin || "（可不带声调）";
  setFeedback("warn", `已跳过，正确答案参考：${expected}`);
  refreshScoreBoard();
  updateWorksheetLinkByWrong();
  if (state.lives <= 0) {
    endGame("生命值耗尽");
    return;
  }
  refs.answerInput.value = "";
  advancePrompt();
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

function endGame(reason) {
  if (!state.running) {
    return;
  }
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  tryCompleteMission(true);
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;

  refs.promptType.textContent = "题型：本局已结束";
  refs.promptText.textContent = "可点击“开始闯关”再来一局";
  refs.promptHint.textContent = "系统将保留战绩，并可将错题加入字帖继续巩固。";
  setFeedback("warn", `${reason}。本局结束，得分 ${state.score}。`);

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
    <p>词组正确数：${state.wordCorrect}</p>
    <p>趣味任务：${state.mission?.completed ? "已完成" : "未完成"}</p>
    <p>错题字：${[...state.wrongChars].join("") || "无"}</p>
  `;
  renderMissionPanel();
  updateWorksheetLinkByWrong();
  renderHistory();
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
  state.wordCorrect = 0;
  state.wrongChars = new Set();
  state.mission = createMission();
  state.pool = buildRoundPool();
  state.running = true;

  if (!state.pool.length) {
    state.running = false;
    refreshScoreBoard();
    setFeedback("bad", "当前条件下没有可用题目，请调整筛选设置。");
    return;
  }

  state.promptQueue = [];
  refillPromptQueue(30);
  renderQueueStream();
  updatePromptDisplay();
  renderMissionPanel();

  refreshScoreBoard();
  setFeedback("warn", "闯关开始：实时匹配已启用，输入正确会自动切题。");
  refs.sessionSummary.innerHTML = `<p class="empty">本局进行中...</p>`;
  refs.answerInput.value = "";
  refs.answerInput.focus();
  updateWorksheetLinkByWrong();

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
  refs.submitBtn.addEventListener("click", () => submitAnswer(false));
  refs.answerInput.addEventListener("compositionstart", () => {
    state.composing = true;
  });
  refs.answerInput.addEventListener("compositionend", () => {
    state.composing = false;
    evaluateInputProgress();
  });
  refs.answerInput.addEventListener("input", evaluateInputProgress);
  refs.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitAnswer(false);
    }
  });
  refs.addWrongToCartBtn.addEventListener("click", addWrongToCart);
}

function bootstrap() {
  bindEvents();
  refreshScoreBoard();
  refs.promptType.textContent = "题型：待开始";
  refs.promptHint.textContent = "提示：选择模式后点击“开始闯关”。";
  refs.sessionSummary.innerHTML = `<p class="empty">尚未开始本局。</p>`;
  renderMissionPanel();
  renderHistory();
  renderQueueStream();
  updateWorksheetLinkByWrong();
}

bootstrap();
