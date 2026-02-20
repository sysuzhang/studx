const refs = {
  pageTitle: document.getElementById("pageTitle"),
  pageDesc: document.getElementById("pageDesc"),
  practiceModeSelect: document.getElementById("practiceModeSelect"),
  textInput: document.getElementById("textInput"),
  textInputHint: document.getElementById("textInputHint"),
  cartSection: document.getElementById("cartSection"),
  cartMeta: document.getElementById("cartMeta"),
  cartChars: document.getElementById("cartChars"),
  useCartBtn: document.getElementById("useCartBtn"),
  mergeCartBtn: document.getElementById("mergeCartBtn"),
  clearCartBtn: document.getElementById("clearCartBtn"),
  gradeTemplateSelect: document.getElementById("gradeTemplateSelect"),
  gridType: document.getElementById("gridType"),
  repeatCount: document.getElementById("repeatCount"),
  columns: document.getElementById("columns"),
  cellSize: document.getElementById("cellSize"),
  traceMode: document.getElementById("traceMode"),
  showGuide: document.getElementById("showGuide"),
  showPinyin: document.getElementById("showPinyin"),
  templateTip: document.getElementById("templateTip"),
  generateBtn: document.getElementById("generateBtn"),
  printBtn: document.getElementById("printBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  clearBtn: document.getElementById("clearBtn"),
  billingTip: document.getElementById("billingTip"),
  charPickerSection: document.getElementById("charPickerSection"),
  charPickerTitle: document.getElementById("charPickerTitle"),
  charPicker: document.getElementById("charPicker"),
  workbookBuilderSection: document.getElementById("workbookBuilderSection"),
  bookAgeGroup: document.getElementById("bookAgeGroup"),
  bookLevel: document.getElementById("bookLevel"),
  bookCharCount: document.getElementById("bookCharCount"),
  bookRepeatCount: document.getElementById("bookRepeatCount"),
  bookMasteryThreshold: document.getElementById("bookMasteryThreshold"),
  bookPrioritizeWeak: document.getElementById("bookPrioritizeWeak"),
  generateBookBtn: document.getElementById("generateBookBtn"),
  printBookBtn: document.getElementById("printBookBtn"),
  bookMeta: document.getElementById("bookMeta"),
  bookFocusChars: document.getElementById("bookFocusChars"),
  workbookScanSection: document.getElementById("workbookScanSection"),
  scanBookSelect: document.getElementById("scanBookSelect"),
  scanThreshold: document.getElementById("scanThreshold"),
  scanResultInput: document.getElementById("scanResultInput"),
  scanFileInput: document.getElementById("scanFileInput"),
  applyScanBtn: document.getElementById("applyScanBtn"),
  generateNextBookBtn: document.getElementById("generateNextBookBtn"),
  scanMeta: document.getElementById("scanMeta"),
  scanWeakChars: document.getElementById("scanWeakChars"),
  worksheetPages: document.getElementById("worksheetPages"),
  currentChar: document.getElementById("currentChar"),
  writerTarget: document.getElementById("writerTarget"),
  animateBtn: document.getElementById("animateBtn"),
  loopBtn: document.getElementById("loopBtn"),
  speakBtn: document.getElementById("speakBtn"),
  followBtn: document.getElementById("followBtn"),
  addCurrentToCartBtn: document.getElementById("addCurrentToCartBtn"),
  quizBtn: document.getElementById("quizBtn"),
  strokeMeta: document.getElementById("strokeMeta"),
  followResult: document.getElementById("followResult"),
  followCompare: document.getElementById("followCompare"),
  strokeOrderList: document.getElementById("strokeOrderList"),
  strokePanel: document.getElementById("strokePanel"),
};

const state = {
  chars: [],
  selectedChar: "",
  practiceMode: "hanzi",
  writer: null,
  loopMode: false,
  strokeReqId: 0,
  followListening: false,
  activeWorkbookId: "",
  workbookHistory: [],
  workbookMasteryMap: {},
  strokePaths: [],
  strokeHighlightTimer: null,
  strokeHighlightIndex: -1,
};

let hanRegex;
const speechState = { voice: null };
const followState = { supported: false, recognition: null };
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const store = window.LearningStore;
try {
  hanRegex = /\p{Script=Han}/u;
} catch (error) {
  hanRegex = /[\u3400-\u9fff\uf900-\ufaff]/;
}

const MATH_CHAR_MAP = {
  "０": "0",
  "１": "1",
  "２": "2",
  "３": "3",
  "４": "4",
  "５": "5",
  "６": "6",
  "７": "7",
  "８": "8",
  "９": "9",
  "＋": "+",
  "－": "-",
  "−": "-",
  "×": "×",
  "✕": "×",
  x: "×",
  X: "×",
  "*": "×",
  "／": "÷",
  "/": "÷",
  "÷": "÷",
  "＝": "=",
  "（": "(",
  "）": ")",
  "％": "%",
};

const MATH_ALLOWED_SET = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", "×", "÷", "=", "(", ")", ".", "%"]);
const WORKBOOK_MAX_HISTORY = 120;

const DEFAULT_AGE_GROUPS =
  window.LEARNING_DIMENSIONS?.ageGroups ||
  [
    { value: "6-8", label: "6-8 岁（启蒙）" },
    { value: "9-12", label: "9-12 岁（基础）" },
    { value: "13-16", label: "13-16 岁（提升）" },
    { value: "16+", label: "16 岁以上（进阶）" },
  ];

const DEFAULT_LEVELS =
  window.LEARNING_DIMENSIONS?.chineseLevels ||
  [
    { value: "启蒙", label: "启蒙" },
    { value: "HSK1", label: "HSK 1" },
    { value: "HSK2", label: "HSK 2" },
    { value: "HSK3", label: "HSK 3" },
    { value: "HSK4+", label: "HSK 4+" },
  ];

const HANZI_PINYIN_MAP = new Map(
  (Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [])
    .filter((item) => item && typeof item === "object" && item.char)
    .map((item) => [item.char, String(item.pinyin || "").trim()])
);

const GRADE_TEMPLATE_PRESETS = {
  custom: {
    id: "custom",
    label: "自定义配置",
    gridType: null,
    columns: null,
    cellSize: null,
    repeatCount: null,
    showPinyin: false,
    writingTrack: "hanzi",
  },
  g12_tian: {
    id: "g12_tian",
    label: "1-2 年级（田字格）",
    gridType: "tian",
    columns: 10,
    cellSize: 60,
    repeatCount: 10,
    showPinyin: false,
    writingTrack: "hanzi",
  },
  g36_fourline: {
    id: "g36_fourline",
    label: "3-6 年级（四线三格）",
    gridType: "fourline",
    columns: 8,
    cellSize: 66,
    repeatCount: 8,
    showPinyin: true,
    writingTrack: "pinyin",
  },
};

const STROKE_HIGHLIGHT_STEP_MS = 760;

function refreshSpeechVoice() {
  if (!("speechSynthesis" in window)) {
    speechState.voice = null;
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  speechState.voice =
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("zh")) || voices[0] || null;
}

function speakText(text) {
  const content = String(text ?? "").trim();
  if (!content || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = "zh-CN";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  if (speechState.voice) {
    utterance.voice = speechState.voice;
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

function setFollowCompareLine(level, text) {
  if (!refs.followCompare) {
    return;
  }
  refs.followCompare.className = `hint ${level}`.trim();
  refs.followCompare.textContent = text;
}

function resetFollowPanel(char) {
  if (!refs.followResult || !refs.followCompare) {
    return;
  }
  refs.followResult.className = "hint";
  refs.followResult.textContent = "识别结果：-";
  refs.followCompare.className = "hint";
  refs.followCompare.textContent = followState.supported
    ? char
      ? `对比结果：请朗读“${char}”，系统会与标准读音对比。`
      : "对比结果：请选择一个汉字后开始跟读。"
    : "对比结果：当前浏览器暂不支持语音识别。";
  if (refs.followBtn) {
    refs.followBtn.textContent = "开始跟读";
  }
}

function isHanziMode() {
  return state.practiceMode !== "math";
}

function normalizeMathChar(char) {
  if (Object.prototype.hasOwnProperty.call(MATH_CHAR_MAP, char)) {
    return MATH_CHAR_MAP[char];
  }
  return char;
}

function extractMathChars(text) {
  const chars = [];
  for (const rawChar of String(text ?? "")) {
    const char = normalizeMathChar(rawChar);
    if (MATH_ALLOWED_SET.has(char)) {
      chars.push(char);
    }
  }
  return chars;
}

function extractInputChars(text) {
  return isHanziMode() ? extractChineseChars(text) : extractMathChars(text);
}

function refreshPracticeModeUI() {
  const hanziMode = isHanziMode();
  if (refs.pageTitle) {
    refs.pageTitle.textContent = hanziMode ? "汉字字帖打印工坊" : "数学数字字帖工坊";
  }
  if (refs.pageDesc) {
    refs.pageDesc.textContent = hanziMode
      ? "支持自定义字帖生成、A4 打印、汉字笔顺动画演示与笔画顺序查看。"
      : "支持数字与运算符字帖生成、A4 打印，适合数学符号与算式书写练习。";
  }
  if (refs.textInput) {
    refs.textInput.placeholder = hanziMode
      ? "请输入要练习的汉字，例如：永和春风"
      : "请输入数学数字/算式，例如：1+2=3 (8÷2=4)";
  }
  if (refs.textInputHint) {
    refs.textInputHint.textContent = hanziMode
      ? "将自动过滤非汉字字符。"
      : "将自动过滤非数字与数学运算符（支持 0-9、+-×÷=()%.）。";
  }
  if (refs.cartSection) {
    refs.cartSection.classList.toggle("hidden", !hanziMode);
  }
  if (refs.charPickerSection) {
    refs.charPickerSection.classList.toggle("hidden", !hanziMode);
  }
  if (refs.charPickerTitle) {
    refs.charPickerTitle.textContent = hanziMode ? "3) 选择演示汉字" : "3) 选择演示内容";
  }
  if (refs.strokePanel) {
    refs.strokePanel.classList.toggle("hidden", !hanziMode);
  }
  if (refs.workbookBuilderSection) {
    refs.workbookBuilderSection.classList.toggle("hidden", !hanziMode);
  }
  if (refs.workbookScanSection) {
    refs.workbookScanSection.classList.toggle("hidden", !hanziMode);
  }
  if (refs.gradeTemplateSelect) {
    refs.gradeTemplateSelect.disabled = !hanziMode;
  }
  if (refs.showPinyin) {
    refs.showPinyin.disabled = !hanziMode;
  }
  if (refs.templateTip && !hanziMode) {
    refs.templateTip.textContent = "数学数字模式下不使用年级模板与拼音标注。";
  } else if (refs.templateTip) {
    refs.templateTip.textContent = getTemplateTipText(refs.gradeTemplateSelect?.value || "custom");
  }
}

function getCartChars() {
  return store && typeof store.getWorksheetCart === "function" ? store.getWorksheetCart() : [];
}

function refreshCartPanel() {
  if (!refs.cartMeta || !refs.cartChars) {
    return;
  }
  const cart = getCartChars();
  refs.cartMeta.textContent = `已收藏 ${cart.length} 个汉字`;
  refs.cartChars.innerHTML = "";
  if (!cart.length) {
    refs.cartChars.innerHTML = `<span class="hint">暂无收藏，可在学习页或本页加入。</span>`;
    return;
  }
  cart.forEach((char) => {
    const chip = document.createElement("span");
    chip.className = "char-pill with-remove";
    chip.innerHTML = `<span>${char}</span><button type="button" class="remove" aria-label="移除 ${char}">×</button>`;
    chip.querySelector(".remove").addEventListener("click", () => {
      if (!store) {
        return;
      }
      store.removeWorksheetChar(char);
      refreshCartPanel();
    });
    refs.cartChars.appendChild(chip);
  });
}

function formatQuota(limit, used) {
  if (limit === null) {
    return `已使用 ${used} 次（不限量）`;
  }
  return `已使用 ${used}/${limit} 次`;
}

function refreshBillingTip() {
  if (!refs.billingTip) {
    return;
  }
  if (!store || typeof store.getBillingSnapshot !== "function") {
    refs.billingTip.textContent = "计费状态不可用。";
    return;
  }
  const snapshot = store.getBillingSnapshot();
  const planName = snapshot?.plan?.name || "基础版";
  const usage = snapshot?.usage?.worksheetPrint || { used: 0, limit: 2, remaining: 2 };
  const quotaText = formatQuota(usage.limit, usage.used);
  const remainText = usage.limit === null ? "剩余：无限" : `剩余：${usage.remaining} 次`;
  refs.billingTip.innerHTML = `当前套餐：<strong>${planName}</strong>；打印配额：${quotaText}，${remainText}。<a href="./pricing.html">查看订阅方案</a>`;
}

function addCharsToCart(chars, source) {
  if (!isHanziMode() || !store || !chars) {
    return;
  }
  store.addWorksheetChars(chars, source || "worksheet");
  refreshCartPanel();
}

function stopFollowReading() {
  if (followState.recognition && state.followListening) {
    followState.recognition.stop();
  }
}

function evaluateFollowReading(transcript, targetChar, confidence) {
  const cleaned = String(transcript ?? "").replace(/[，。！？、,.!?;；:：\s]/g, "");
  if (!cleaned) {
    return { level: "bad", text: "❌ 未识别到有效内容，请再试一次。" };
  }
  const confidenceText =
    Number.isFinite(confidence) && confidence > 0 ? `（识别置信度 ${Math.round(confidence * 100)}%）` : "";
  if (cleaned.includes(targetChar)) {
    return { level: "ok", text: `✅ 与标准读音匹配，识别到了“${targetChar}”${confidenceText}` };
  }
  return {
    level: "bad",
    text: `❌ 识别为“${cleaned}”，与目标字“${targetChar}”不一致，建议放慢语速重读。${confidenceText}`,
  };
}

function startFollowReading() {
  if (!followState.supported || !followState.recognition || !state.selectedChar) {
    return;
  }
  if (state.followListening) {
    stopFollowReading();
    return;
  }
  refs.followResult.textContent = "识别结果：识别中...";
  setFollowCompareLine("warn", "对比结果：请朗读当前汉字...");
  try {
    followState.recognition.start();
  } catch (error) {
    setFollowCompareLine("bad", "对比结果：语音识别启动失败，请稍后再试。");
  }
}

function setupFollowReading() {
  followState.supported = Boolean(SpeechRecognitionCtor);
  if (!refs.followBtn) {
    return;
  }
  if (!followState.supported) {
    refs.followBtn.disabled = true;
    setFollowCompareLine("warn", "对比结果：当前浏览器暂不支持语音识别。");
    return;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    state.followListening = true;
    refs.followBtn.textContent = "停止跟读";
    setFollowCompareLine("warn", "对比结果：正在收听，请读出当前汉字。");
  };

  recognition.onresult = (event) => {
    const result = event.results?.[0]?.[0];
    const transcript = result?.transcript?.trim() || "";
    const confidence = Number.isFinite(result?.confidence) ? result.confidence : NaN;
    refs.followResult.textContent = `识别结果：${transcript || "（未识别）"}`;

    if (!state.selectedChar) {
      return;
    }
    const compare = evaluateFollowReading(transcript, state.selectedChar, confidence);
    setFollowCompareLine(compare.level, compare.text);
    if (store && typeof store.appendFollowReadingRecord === "function") {
      store.appendFollowReadingRecord({
        char: state.selectedChar,
        level: compare.level,
        transcript,
        confidence,
        source: "worksheet",
      });
    }
  };

  recognition.onerror = (event) => {
    const msg = event?.error || "unknown";
    setFollowCompareLine("bad", `对比结果：识别异常（${msg}），请重试。`);
  };

  recognition.onend = () => {
    state.followListening = false;
    if (refs.followBtn) {
      refs.followBtn.textContent = "开始跟读";
    }
  };

  followState.recognition = recognition;
}

function extractChineseChars(text) {
  return [...text].filter((char) => hanRegex.test(char));
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chunk(list, size) {
  const result = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
}

function getWorksheetConfig() {
  const templateId = refs.gradeTemplateSelect?.value || "custom";
  const preset = GRADE_TEMPLATE_PRESETS[templateId] || GRADE_TEMPLATE_PRESETS.custom;
  const rawGridType = refs.gridType.value;
  const rawRepeatCount = Math.min(Math.max(toInt(refs.repeatCount.value, 10), 2), 24);
  const rawColumns = Math.min(Math.max(toInt(refs.columns.value, 10), 4), 20);
  const rawCellSize = Math.min(Math.max(toInt(refs.cellSize.value, 60), 40), 90);
  const showPinyin = Boolean(refs.showPinyin?.checked);
  const writingTrack =
    preset.id === "custom" ? (rawGridType === "fourline" ? "pinyin" : "hanzi") : preset.writingTrack || "hanzi";
  const templateLabel =
    preset.id === "custom" && rawGridType === "fourline" ? "自定义（四线三格）" : preset.label;
  return {
    templateId,
    templateLabel,
    gridType: preset.gridType || rawGridType,
    repeatCount: preset.repeatCount || rawRepeatCount,
    columns: preset.columns || rawColumns,
    cellSize: preset.cellSize || rawCellSize,
    traceMode: refs.traceMode.value,
    showGuide: refs.showGuide.checked,
    showPinyin: preset.showPinyin || showPinyin || (preset.id === "custom" && rawGridType === "fourline"),
    writingTrack,
  };
}

function getGradeTemplatePreset(templateId) {
  return GRADE_TEMPLATE_PRESETS[templateId] || GRADE_TEMPLATE_PRESETS.custom;
}

function getTemplateTipText(templateId) {
  const preset = getGradeTemplatePreset(templateId);
  if (preset.id === "custom") {
    return refs.gridType?.value === "fourline"
      ? "当前为自定义四线三格，可用于拼音书写与 PDF 导出。"
      : "模板可一键切换为小学年级常用练习版式，并用于 PDF 导出。";
  }
  return `当前模板：${preset.label}。将自动应用 ${
    preset.gridType === "fourline" ? "四线三格拼音练习" : "田字格汉字练习"
  }。`;
}

function applyGradeTemplatePreset(templateId) {
  const preset = getGradeTemplatePreset(templateId);
  if (!refs.gradeTemplateSelect) {
    return preset;
  }
  refs.gradeTemplateSelect.value = preset.id;
  if (preset.id !== "custom") {
    if (preset.gridType && refs.gridType.value !== preset.gridType) {
      refs.gridType.value = preset.gridType;
    }
    if (Number.isFinite(preset.repeatCount) && refs.repeatCount.value !== String(preset.repeatCount)) {
      refs.repeatCount.value = String(preset.repeatCount);
    }
    if (Number.isFinite(preset.columns) && refs.columns.value !== String(preset.columns)) {
      refs.columns.value = String(preset.columns);
    }
    if (Number.isFinite(preset.cellSize) && refs.cellSize.value !== String(preset.cellSize)) {
      refs.cellSize.value = String(preset.cellSize);
    }
    if (refs.showPinyin) {
      refs.showPinyin.checked = Boolean(preset.showPinyin);
    }
  }
  if (refs.templateTip) {
    refs.templateTip.textContent = getTemplateTipText(preset.id);
  }
  return preset;
}

function switchTemplateToCustomOnManualEdit() {
  if (!refs.gradeTemplateSelect) {
    return;
  }
  if (refs.gradeTemplateSelect.value === "custom") {
    return;
  }
  refs.gradeTemplateSelect.value = "custom";
  applyGradeTemplatePreset("custom");
}

function getCharPinyin(char) {
  return HANZI_PINYIN_MAP.get(char) || "";
}

function clampNumber(value, min, max, fallback) {
  const input = Number(value);
  if (!Number.isFinite(input)) {
    return fallback;
  }
  return Math.min(Math.max(input, min), max);
}

function createLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOptionLabel(list, value) {
  const row = (list || []).find((item) => item.value === value);
  return row?.label || value || "-";
}

function uniqueChars(chars) {
  return [...new Set((chars || []).filter((char) => hanRegex.test(char)))];
}

function getHanziLibraryRows() {
  const rows = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
  return rows.filter((item) => item && typeof item === "object" && hanRegex.test(item.char || ""));
}

function getLaneChars(ageGroup, level) {
  const rows = getHanziLibraryRows();
  return uniqueChars(
    rows
      .filter((item) => {
        const ages = Array.isArray(item.ages) ? item.ages : [];
        const levels = Array.isArray(item.levels) ? item.levels : [];
        return ages.includes(ageGroup) && levels.includes(level);
      })
      .map((item) => item.char)
  );
}

function getDefaultBookCharCount(ageGroup, level) {
  const levelBase = {
    启蒙: 14,
    HSK1: 18,
    HSK2: 22,
    HSK3: 26,
    "HSK4+": 30,
  };
  const ageAdjust = {
    "6-8": -2,
    "9-12": 0,
    "13-16": 2,
    "16+": 4,
  };
  const base = (levelBase[level] || 18) + (ageAdjust[ageGroup] || 0);
  return clampNumber(base, 8, 120, 24);
}

function loadWorkbookHistory() {
  if (store && typeof store.getWorkbookHistory === "function") {
    state.workbookHistory = store.getWorkbookHistory();
  } else {
    state.workbookHistory = [];
  }
}

function loadWorkbookMasteryMap() {
  if (store && typeof store.getWorkbookMasteryMap === "function") {
    state.workbookMasteryMap = store.getWorkbookMasteryMap();
  } else {
    state.workbookMasteryMap = {};
  }
}

function saveWorkbookMasteryMap(map) {
  state.workbookMasteryMap = map && typeof map === "object" ? map : {};
  if (store && typeof store.saveWorkbookMasteryMap === "function") {
    store.saveWorkbookMasteryMap(state.workbookMasteryMap);
  }
}

function getWorkbookRecordById(bookId) {
  const target = String(bookId || "");
  if (!target) {
    return null;
  }
  if (store && typeof store.getWorkbookRecordById === "function") {
    return store.getWorkbookRecordById(target);
  }
  return state.workbookHistory.find((item) => String(item.id || "") === target) || null;
}

function appendWorkbookRecord(record) {
  if (store && typeof store.appendWorkbookRecord === "function") {
    store.appendWorkbookRecord(record);
  } else {
    const list = [...state.workbookHistory, record].slice(-WORKBOOK_MAX_HISTORY);
    state.workbookHistory = list;
  }
  loadWorkbookHistory();
}

function updateWorkbookRecord(bookId, patch) {
  if (store && typeof store.updateWorkbookRecord === "function") {
    const row = store.updateWorkbookRecord(bookId, patch);
    loadWorkbookHistory();
    return row;
  }
  const idx = state.workbookHistory.findIndex((item) => String(item.id || "") === String(bookId || ""));
  if (idx < 0) {
    return null;
  }
  state.workbookHistory[idx] = { ...state.workbookHistory[idx], ...(patch || {}), id: state.workbookHistory[idx].id };
  return state.workbookHistory[idx];
}

function renderCharTags(target, chars) {
  if (!target) {
    return;
  }
  target.innerHTML = "";
  const list = uniqueChars(chars);
  if (!list.length) {
    target.innerHTML = `<span class="hint">暂无标记字符。</span>`;
    return;
  }
  list.forEach((char) => {
    const chip = document.createElement("span");
    chip.className = "char-pill";
    chip.textContent = char;
    target.appendChild(chip);
  });
}

function getBookFormValues() {
  const ageGroup = refs.bookAgeGroup?.value || DEFAULT_AGE_GROUPS[0]?.value || "9-12";
  const level = refs.bookLevel?.value || DEFAULT_LEVELS[1]?.value || "HSK1";
  const targetCount = clampNumber(refs.bookCharCount?.value, 8, 120, getDefaultBookCharCount(ageGroup, level));
  const repeatCount = clampNumber(refs.bookRepeatCount?.value, 4, 24, 8);
  const threshold = clampNumber(refs.bookMasteryThreshold?.value, 50, 100, 80);
  const prioritizeWeak = Boolean(refs.bookPrioritizeWeak?.checked);
  return { ageGroup, level, targetCount, repeatCount, threshold, prioritizeWeak };
}

function normalizeMasteryRow(row) {
  if (!row || typeof row !== "object") {
    return { score: 0, attempts: 0, lastUpdatedAt: 0 };
  }
  return {
    score: clampNumber(row.score, 0, 100, 0),
    attempts: Math.max(0, toInt(row.attempts, 0)),
    lastUpdatedAt: Number.isFinite(row.lastUpdatedAt) ? row.lastUpdatedAt : 0,
    weakCount: Math.max(0, toInt(row.weakCount, 0)),
    passCount: Math.max(0, toInt(row.passCount, 0)),
    lastBookId: row.lastBookId || "",
  };
}

function buildWorkbookCharPlan(input) {
  const laneChars = getLaneChars(input.ageGroup, input.level);
  const mastery = state.workbookMasteryMap || {};
  const threshold = clampNumber(input.threshold, 50, 100, 80);
  const weakSeed = new Set(uniqueChars(input.forceWeakChars || []));
  const targetCount = clampNumber(input.targetCount, 8, 120, 24);
  const prioritizeWeak = Boolean(input.prioritizeWeak);

  const weakPool = laneChars
    .filter((char) => {
      const row = normalizeMasteryRow(mastery[char]);
      return weakSeed.has(char) || (row.attempts > 0 && row.score < threshold);
    })
    .sort((a, b) => {
      const rowA = normalizeMasteryRow(mastery[a]);
      const rowB = normalizeMasteryRow(mastery[b]);
      return rowA.score - rowB.score || rowA.lastUpdatedAt - rowB.lastUpdatedAt;
    });

  const freshPool = laneChars.filter((char) => normalizeMasteryRow(mastery[char]).attempts === 0);
  const trainedPool = laneChars.filter((char) => {
    const row = normalizeMasteryRow(mastery[char]);
    return row.attempts > 0 && row.score >= threshold;
  });

  const selected = [];
  const pushUnique = (char) => {
    if (!selected.includes(char)) {
      selected.push(char);
    }
  };

  if (prioritizeWeak) {
    weakPool.forEach(pushUnique);
  }
  freshPool.forEach(pushUnique);
  if (!prioritizeWeak) {
    weakPool.forEach(pushUnique);
  }
  trainedPool.forEach(pushUnique);
  laneChars.forEach(pushUnique);

  const chars = selected.slice(0, targetCount);
  const focusChars = chars.filter((char) => weakPool.includes(char));
  const newChars = chars.filter((char) => !focusChars.includes(char));
  return {
    chars,
    focusChars,
    newChars,
    laneTotal: laneChars.length,
    weakPoolSize: weakPool.length,
  };
}

function renderScanBookOptions() {
  if (!refs.scanBookSelect) {
    return;
  }
  const rows = [...state.workbookHistory].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  refs.scanBookSelect.innerHTML = "";
  if (!rows.length) {
    refs.scanBookSelect.innerHTML = `<option value="">暂无字帖本记录</option>`;
    return;
  }
  rows.forEach((book) => {
    const option = document.createElement("option");
    option.value = book.id;
    option.textContent = `${book.title || "字帖本"}｜${getOptionLabel(DEFAULT_AGE_GROUPS, book.ageGroup)}｜${
      book.level
    }｜${formatTime(book.createdAt || 0)}`;
    refs.scanBookSelect.appendChild(option);
  });
  if (state.activeWorkbookId && rows.some((item) => item.id === state.activeWorkbookId)) {
    refs.scanBookSelect.value = state.activeWorkbookId;
  } else {
    refs.scanBookSelect.value = rows[0].id;
  }
}

function setBookMeta(text) {
  if (refs.bookMeta) {
    refs.bookMeta.textContent = text;
  }
}

function formatTime(ts) {
  if (!Number.isFinite(ts) || ts <= 0) {
    return "-";
  }
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function setScanMeta(text) {
  if (refs.scanMeta) {
    refs.scanMeta.textContent = text;
  }
}

function parseScanResultText(text) {
  const rows = [];
  const map = {};
  const qualityScoreMap = { 优: 92, 良: 84, 中: 74, 差: 60 };
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const charMatch = line.match(/[\u3400-\u9fff\uf900-\ufaff]/);
      if (!charMatch) {
        return;
      }
      const char = charMatch[0];
      let score = NaN;
      const numberMatch = line.match(/(-?\d{1,3}(?:\.\d+)?)/);
      if (numberMatch) {
        score = clampNumber(Number(numberMatch[1]), 0, 100, 0);
      } else {
        const levelHit = Object.keys(qualityScoreMap).find((label) => line.includes(label));
        if (levelHit) {
          score = qualityScoreMap[levelHit];
        }
      }
      rows.push({ char, score });
      if (!Number.isFinite(score)) {
        return;
      }
      if (!Number.isFinite(map[char]) || score > map[char]) {
        map[char] = score;
      }
    });
  return { rows, map };
}

function initWorkbookSelectors() {
  if (!refs.bookAgeGroup || !refs.bookLevel) {
    return;
  }
  refs.bookAgeGroup.innerHTML = DEFAULT_AGE_GROUPS.map(
    (item) => `<option value="${item.value}">${item.label}</option>`
  ).join("");
  refs.bookLevel.innerHTML = DEFAULT_LEVELS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");

  const profileLevel = store && typeof store.getUserProfile === "function" ? store.getUserProfile()?.targetLevel : "";
  const defaultLevel = DEFAULT_LEVELS.some((item) => item.value === profileLevel) ? profileLevel : "HSK1";
  refs.bookLevel.value = defaultLevel;
  refs.bookAgeGroup.value = "9-12";
  refs.bookCharCount.value = String(getDefaultBookCharCount(refs.bookAgeGroup.value, refs.bookLevel.value));
}

function createWorkbookRecord(input) {
  const currentConfig = getWorksheetConfig();
  const plan = buildWorkbookCharPlan({
    ageGroup: input.ageGroup,
    level: input.level,
    targetCount: input.targetCount,
    threshold: input.threshold,
    prioritizeWeak: input.prioritizeWeak,
    forceWeakChars: input.forceWeakChars || [],
  });
  if (!plan.chars.length) {
    return null;
  }
  const ageLabel = getOptionLabel(DEFAULT_AGE_GROUPS, input.ageGroup);
  const now = Date.now();
  return {
    id: createLocalId("wbk"),
    createdAt: now,
    updatedAt: now,
    title: `${ageLabel} · ${input.level} 分级字帖本`,
    ageGroup: input.ageGroup,
    level: input.level,
    threshold: input.threshold,
    targetCount: input.targetCount,
    repeatCount: input.repeatCount,
    prioritizeWeak: input.prioritizeWeak,
    chars: plan.chars,
    focusChars: plan.focusChars,
    newChars: plan.newChars,
    laneTotal: plan.laneTotal,
    weakPoolSize: plan.weakPoolSize,
    source: input.source || "grading_auto",
    sourceBookId: input.sourceBookId || "",
    cycle: Number.isFinite(input.cycle) ? input.cycle : 1,
    scanSummary: null,
    configSnapshot: {
      gridType: currentConfig.gridType,
      columns: currentConfig.columns,
      cellSize: currentConfig.cellSize,
      traceMode: "trace",
      showGuide: true,
      repeatCount: input.repeatCount,
      showPinyin: Boolean(currentConfig.showPinyin),
      templateId: currentConfig.templateId || "custom",
      templateLabel: currentConfig.templateLabel || "自定义配置",
      writingTrack: currentConfig.writingTrack || "hanzi",
    },
  };
}

function createWorkbookCoverPage(book) {
  const cover = document.createElement("section");
  cover.className = "worksheet-page workbook-cover";
  const ageLabel = getOptionLabel(DEFAULT_AGE_GROUPS, book.ageGroup);
  const focusText = book.focusChars?.length ? `${book.focusChars.join("")}` : "无";
  cover.innerHTML = `
    <div class="cover-title">${book.title}</div>
    <div class="cover-subtitle">第 ${book.cycle} 册 · 生成时间：${formatTime(book.createdAt || 0)}</div>
    <div class="cover-meta-grid">
      <div class="meta-card">年龄段：${ageLabel}</div>
      <div class="meta-card">分级：${book.level}</div>
      <div class="meta-card">本册汉字：${book.chars.length} / 目标 ${book.targetCount}</div>
      <div class="meta-card">每字格数：${book.repeatCount}</div>
      <div class="meta-card">掌握阈值：${book.threshold}</div>
      <div class="meta-card">未达标优先：${book.prioritizeWeak ? "是" : "否"}</div>
      <div class="meta-card">模板：${book.configSnapshot?.templateLabel || "自定义配置"}</div>
      <div class="meta-card">强化标记字：${focusText}</div>
      <div class="meta-card">来源：${book.sourceBookId ? `由 ${book.sourceBookId} 循环生成` : "首次生成"}</div>
    </div>
    <div class="cover-note">
      使用说明：先整本打印并描红，再将扫描/OCR结果粘贴到“扫描复盘”区。系统会自动标记未达标汉字并循环生成下一册强化字帖本。
    </div>
  `;
  return cover;
}

function renderWorkbookPreview(book) {
  if (!book) {
    return;
  }
  state.activeWorkbookId = book.id;
  refs.textInput.value = Array.isArray(book.chars) ? book.chars.join("") : "";
  state.chars = Array.isArray(book.chars) ? [...book.chars] : [];

  const weakSet = new Set(uniqueChars(book.focusChars || []));
  const configOverride = {
    ...getWorksheetConfig(),
    ...(book.configSnapshot || {}),
    repeatCount: clampNumber(book.repeatCount, 4, 24, 8),
    traceMode: "trace",
    showGuide: true,
  };
  renderWorksheet(state.chars, {
    configOverride,
    weakSet,
    headerMainText: `${book.title}｜第 ${book.cycle} 册｜本册 ${state.chars.length} 字`,
  });
  refs.worksheetPages.prepend(createWorkbookCoverPage(book));

  renderCharPicker(state.chars);
  if (state.chars.length) {
    selectChar(state.chars[0]);
  }
  renderCharTags(refs.bookFocusChars, book.focusChars || []);
  renderCharTags(refs.scanWeakChars, book.scanSummary?.weakChars || []);
  renderScanBookOptions();
  if (refs.scanBookSelect) {
    refs.scanBookSelect.value = book.id;
  }

  const summary = book.scanSummary;
  if (summary) {
    setBookMeta(
      `当前第 ${book.cycle} 册：本册 ${book.chars.length} 字，扫描达标 ${summary.masteredCount}/${summary.totalChars}，未达标 ${summary.weakCount}。`
    );
  } else {
    setBookMeta(
      `当前第 ${book.cycle} 册：本册 ${book.chars.length} 字，其中未达标优先 ${book.focusChars.length} 字。`
    );
  }
}

function refreshWorkbookHistoryState() {
  loadWorkbookHistory();
  renderScanBookOptions();
}

function patchActiveWorkbookConfigSnapshot() {
  if (!state.activeWorkbookId) {
    return false;
  }
  const book = getWorkbookRecordById(state.activeWorkbookId);
  if (!book) {
    return false;
  }
  const config = getWorksheetConfig();
  const patched = updateWorkbookRecord(book.id, {
    configSnapshot: {
      ...(book.configSnapshot || {}),
      gridType: config.gridType,
      columns: config.columns,
      cellSize: config.cellSize,
      repeatCount: config.repeatCount,
      showPinyin: Boolean(config.showPinyin),
      templateId: config.templateId || "custom",
      templateLabel: config.templateLabel || "自定义配置",
      writingTrack: config.writingTrack || "hanzi",
    },
  });
  renderWorkbookPreview(patched || book);
  return true;
}

function generateWorkbook(opts) {
  const form = getBookFormValues();
  const sourceBook = opts?.sourceBook || null;
  const record = createWorkbookRecord({
    ageGroup: sourceBook?.ageGroup || form.ageGroup,
    level: sourceBook?.level || form.level,
    targetCount: sourceBook?.targetCount || form.targetCount,
    repeatCount: sourceBook?.repeatCount || form.repeatCount,
    threshold: clampNumber(opts?.threshold, 50, 100, sourceBook?.threshold || form.threshold),
    prioritizeWeak: sourceBook ? true : form.prioritizeWeak,
    forceWeakChars: opts?.forceWeakChars || [],
    source: opts?.source || "grading_auto",
    sourceBookId: sourceBook?.id || "",
    cycle: sourceBook ? (sourceBook.cycle || 1) + 1 : 1,
  });
  if (!record) {
    setBookMeta("当前年龄段与分级下暂无可生成字帖本的汉字，请调整条件。");
    return null;
  }
  appendWorkbookRecord(record);
  refreshWorkbookHistoryState();
  renderWorkbookPreview(record);
  return record;
}

function evaluateWorkbookScan(book, scanMap, threshold) {
  const mastery = { ...(state.workbookMasteryMap || {}) };
  const chars = uniqueChars(book.chars || []);
  const weakChars = [];
  const masteredChars = [];
  const details = [];
  let totalScore = 0;
  let detectedCount = 0;
  chars.forEach((char) => {
    const prev = normalizeMasteryRow(mastery[char]);
    const hasInput = Number.isFinite(scanMap[char]);
    const rawScore = hasInput
      ? clampNumber(scanMap[char], 0, 100, 0)
      : prev.attempts > 0
      ? Math.max(0, Math.round(prev.score * 0.75))
      : 0;
    const nextScore = prev.attempts > 0 ? Math.round(prev.score * 0.35 + rawScore * 0.65) : Math.round(rawScore);
    const weak = !hasInput || nextScore < threshold;
    mastery[char] = {
      ...prev,
      score: nextScore,
      attempts: prev.attempts + 1,
      lastUpdatedAt: Date.now(),
      weakCount: prev.weakCount + (weak ? 1 : 0),
      passCount: prev.passCount + (weak ? 0 : 1),
      lastBookId: book.id,
    };
    if (weak) {
      weakChars.push(char);
    } else {
      masteredChars.push(char);
    }
    if (hasInput) {
      detectedCount += 1;
    }
    totalScore += nextScore;
    details.push({
      char,
      detected: hasInput,
      score: nextScore,
      weak,
    });
  });
  const averageScore = chars.length ? Math.round(totalScore / chars.length) : 0;
  const coverage = chars.length ? Math.round((detectedCount / chars.length) * 100) : 0;
  return {
    mastery,
    summary: {
      totalChars: chars.length,
      masteredCount: masteredChars.length,
      weakCount: weakChars.length,
      weakChars,
      masteredChars,
      averageScore,
      coverage,
      threshold,
      updatedAt: Date.now(),
    },
    details,
  };
}

function applyScanToSelectedBook() {
  const bookId = refs.scanBookSelect?.value || state.activeWorkbookId;
  const book = getWorkbookRecordById(bookId);
  if (!book) {
    setScanMeta("请先生成并选择一本字帖本。");
    return null;
  }
  const threshold = clampNumber(refs.scanThreshold?.value, 50, 100, book.threshold || 80);
  const parsed = parseScanResultText(refs.scanResultInput?.value || "");
  if (!parsed.rows.length) {
    setScanMeta("未识别到有效扫描数据，请按“汉字+分数”格式粘贴结果。");
    return null;
  }
  const result = evaluateWorkbookScan(book, parsed.map, threshold);
  saveWorkbookMasteryMap(result.mastery);
  const nextBook = updateWorkbookRecord(book.id, {
    threshold,
    scanSummary: {
      ...result.summary,
      parsedRows: parsed.rows.length,
    },
    scanDetails: result.details,
    focusChars: result.summary.weakChars,
    updatedAt: Date.now(),
  });
  if (store && typeof store.logActivity === "function") {
    store.logActivity("worksheet_workbook_scan", {
      bookId: book.id,
      weakCount: result.summary.weakCount,
      masteredCount: result.summary.masteredCount,
      threshold,
      source: "workbook_scan",
    });
  }
  refreshWorkbookHistoryState();
  renderCharTags(refs.scanWeakChars, result.summary.weakChars);
  renderCharTags(refs.bookFocusChars, result.summary.weakChars);
  setScanMeta(
    `扫描评估完成：达标 ${result.summary.masteredCount}/${result.summary.totalChars}，未达标 ${result.summary.weakCount}，识别覆盖 ${result.summary.coverage}%。`
  );
  if (nextBook) {
    renderWorkbookPreview(nextBook);
  }
  return nextBook || book;
}

function generateNextWorkbookFromSelected() {
  const bookId = refs.scanBookSelect?.value || state.activeWorkbookId;
  const book = getWorkbookRecordById(bookId);
  if (!book) {
    setScanMeta("请先选择一本字帖本并完成扫描评估。");
    return;
  }
  const weakChars = uniqueChars(book.scanSummary?.weakChars || book.focusChars || []);
  const next = generateWorkbook({
    sourceBook: book,
    threshold: refs.scanThreshold?.value,
    forceWeakChars: weakChars,
    source: "workbook_loop",
  });
  if (!next) {
    setScanMeta("下一本生成失败，请检查分级条件。");
    return;
  }
  if (store && typeof store.logActivity === "function") {
    store.logActivity("worksheet_workbook_loop_generate", {
      fromBookId: book.id,
      toBookId: next.id,
      weakCarry: weakChars.length,
      source: "workbook_loop",
    });
  }
  setScanMeta(`已生成下一册：第 ${next.cycle} 册，携带未达标字 ${weakChars.length} 个。`);
}

function consumeWorksheetQuota(source) {
  if (!store || typeof store.consumeFeatureUsage !== "function") {
    return true;
  }
  const result = store.consumeFeatureUsage("worksheet_print", 1, { source: source || "worksheet_print" });
  if (!result.ok) {
    const limitText = result.limit === null ? "不限" : `${result.limit} 次/天`;
    const shouldUpgrade = window.confirm(
      `当前套餐“${result.planName}”的字帖打印配额已用完（${limitText}）。\n是否前往订阅中心升级套餐？`
    );
    if (shouldUpgrade) {
      window.location.href = "./pricing.html";
    }
    refreshBillingTip();
    return false;
  }
  refreshBillingTip();
  return true;
}

function getPdfFileName() {
  const config = getWorksheetConfig();
  const date = new Date();
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  const modeLabel = isHanziMode() ? "汉字字帖" : "数学字帖";
  const templateLabel = (config.templateLabel || "自定义").replace(/[\\/:*?"<>|]/g, "_");
  return `${modeLabel}_${templateLabel}_${y}${m}${d}_${h}${min}.pdf`;
}

async function exportWorksheetPdf() {
  const pages = [...refs.worksheetPages.querySelectorAll(".worksheet-page")];
  if (!pages.length) {
    setStrokeMeta("当前没有可导出的字帖内容，请先生成字帖。");
    return;
  }
  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    window.alert("当前环境缺少 PDF 导出依赖，请检查网络后重试。");
    return;
  }
  if (!consumeWorksheetQuota("worksheet_export_pdf")) {
    return;
  }
  if (refs.exportPdfBtn) {
    refs.exportPdfBtn.disabled = true;
    refs.exportPdfBtn.textContent = "导出中...";
  }
  try {
    const PdfCtor = window.jspdf.jsPDF;
    const pdf = new PdfCtor({ orientation: "p", unit: "mm", format: "a4" });
    for (let index = 0; index < pages.length; index += 1) {
      const pageNode = pages[index];
      // 高分辨率截图后缩放到 A4，保证网格与描红线清晰。
      // eslint-disable-next-line no-await-in-loop
      const canvas = await window.html2canvas(pageNode, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imageData = canvas.toDataURL("image/png");
      if (index > 0) {
        pdf.addPage("a4", "portrait");
      }
      pdf.addImage(imageData, "PNG", 0, 0, 210, 297, "", "FAST");
    }
    pdf.save(getPdfFileName());
    if (store && typeof store.logActivity === "function") {
      store.logActivity("worksheet_export_pdf", {
        pages: pages.length,
        templateId: getWorksheetConfig().templateId || "custom",
        source: "worksheet_pdf_export",
      });
    }
    setStrokeMeta(`已导出 PDF，共 ${pages.length} 页。`);
  } catch (error) {
    window.alert(`PDF 导出失败：${error.message || "未知错误"}`);
  } finally {
    if (refs.exportPdfBtn) {
      refs.exportPdfBtn.disabled = false;
      refs.exportPdfBtn.textContent = "导出 PDF";
    }
  }
}

function tryPrintWorksheet(source) {
  if (!consumeWorksheetQuota(source || "worksheet_print")) {
    return;
  }
  window.print();
}

function buildCells(chars, config, opts) {
  const weakSet = opts?.weakSet instanceof Set ? opts.weakSet : new Set();
  const hanziMode = opts?.hanziMode !== false;
  const cells = [];
  chars.forEach((char) => {
    const pinyin = hanziMode ? getCharPinyin(char) : "";
    const displayText =
      hanziMode && config.writingTrack === "pinyin" ? (pinyin ? pinyin.replace(/\s+/g, "") : char) : char;
    for (let i = 0; i < config.repeatCount; i += 1) {
      let mode = "hidden";
      if (i === 0 && config.showGuide) {
        mode = "model";
      } else if (i > 0 && config.traceMode === "trace" && config.showGuide) {
        mode = "trace";
      }
      cells.push({
        char,
        displayText,
        pinyin,
        mode,
        weak: weakSet.has(char),
      });
    }
  });
  return cells;
}

function summarizeChars(chars) {
  if (!Array.isArray(chars) || !chars.length) {
    return "-";
  }
  const raw = chars.join("");
  if (raw.length <= 24) {
    return raw;
  }
  return `${raw.slice(0, 24)}…（共 ${chars.length} 字）`;
}

function renderWorksheet(chars, options) {
  refs.worksheetPages.innerHTML = "";
  const config = options?.configOverride || getWorksheetConfig();
  const hanziMode = isHanziMode();
  const headerMainText =
    options?.headerMainText ||
    `${hanziMode ? "练字内容" : "练习内容"}：${summarizeChars(chars)} ｜ 模板：${config.templateLabel || "自定义配置"}`;
  const weakSet = options?.weakSet instanceof Set ? options.weakSet : new Set();

  const cells = buildCells(chars, config, { weakSet, hanziMode });
  if (cells.length === 0) {
    refs.worksheetPages.innerHTML = `<div class="hint">${
      hanziMode ? "请输入至少一个汉字以生成字帖。" : "请输入至少一个数字或数学符号以生成字帖。"
    }</div>`;
    return;
  }

  const rowsPerPage = Math.max(8, Math.floor((940 - 36) / (config.cellSize + 4)));
  const cellsPerPage = rowsPerPage * config.columns;
  const pages = chunk(cells, cellsPerPage);

  pages.forEach((pageCells, index) => {
    const page = document.createElement("section");
    page.className = "worksheet-page";

    const header = document.createElement("div");
    header.className = "worksheet-header";
    header.innerHTML = `
      <span>${headerMainText}</span>
      <span>第 ${index + 1} / ${pages.length} 页</span>
    `;

    const grid = document.createElement("div");
    grid.className = "worksheet-grid";
    grid.style.gridTemplateColumns = `repeat(${config.columns}, var(--cell-size))`;
    grid.style.setProperty("--cell-size", `${config.cellSize}px`);

    pageCells.forEach((item) => {
      const cell = document.createElement("div");
      cell.className = `grid-cell ${config.gridType}${item.weak ? " weak" : ""}`;

      const charNode = document.createElement("span");
      charNode.className = `cell-char ${item.mode} ${hanziMode ? "hanzi" : "math"}`;
      if (hanziMode && config.writingTrack === "pinyin") {
        charNode.classList.add("pinyin-track");
      }
      if (item.weak && (item.mode === "model" || item.mode === "trace")) {
        charNode.classList.add("weak-target");
      }
      charNode.textContent = item.displayText || item.char;

      cell.appendChild(charNode);
      if (hanziMode && config.showPinyin && item.mode !== "hidden" && item.pinyin) {
        const pinyinNode = document.createElement("span");
        pinyinNode.className = `cell-pinyin${config.writingTrack === "pinyin" ? " compact" : ""}`;
        pinyinNode.textContent = item.pinyin;
        cell.appendChild(pinyinNode);
      }
      if (hanziMode && config.writingTrack === "pinyin" && item.mode !== "hidden") {
        const originNode = document.createElement("span");
        originNode.className = "cell-origin-char";
        originNode.textContent = item.char;
        cell.appendChild(originNode);
      }
      grid.appendChild(cell);
    });

    page.appendChild(header);
    page.appendChild(grid);
    refs.worksheetPages.appendChild(page);
  });
}

function renderCharPicker(chars) {
  refs.charPicker.innerHTML = "";
  if (!isHanziMode()) {
    refs.charPicker.innerHTML = `<span class="hint">数学数字模式下无需选择笔顺演示汉字。</span>`;
    return;
  }
  const unique = [...new Set(chars)];
  unique.forEach((char) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `char-pill${char === state.selectedChar ? " active" : ""}`;
    button.textContent = char;
    button.addEventListener("click", () => selectChar(char));
    refs.charPicker.appendChild(button);
  });
}

function setStrokeMeta(text) {
  refs.strokeMeta.textContent = text;
}

function clearStrokeHighlightPlayback() {
  if (state.strokeHighlightTimer) {
    clearInterval(state.strokeHighlightTimer);
    state.strokeHighlightTimer = null;
  }
  state.strokeHighlightIndex = -1;
  refs.strokeOrderList?.querySelectorAll("li").forEach((node) => {
    node.classList.remove("active");
  });
}

function highlightStrokeItem(index) {
  state.strokeHighlightIndex = index;
  refs.strokeOrderList?.querySelectorAll("li").forEach((node, nodeIndex) => {
    node.classList.toggle("active", nodeIndex === index);
  });
}

function startStrokeHighlightPlayback(loop) {
  const total = Array.isArray(state.strokePaths) ? state.strokePaths.length : 0;
  clearStrokeHighlightPlayback();
  if (!total) {
    return;
  }
  let index = 0;
  highlightStrokeItem(index);
  state.strokeHighlightTimer = setInterval(() => {
    index += 1;
    if (index >= total) {
      if (loop) {
        index = 0;
      } else {
        clearStrokeHighlightPlayback();
        return;
      }
    }
    highlightStrokeItem(index);
  }, STROKE_HIGHLIGHT_STEP_MS);
}

function clearStrokeList() {
  refs.strokeOrderList.innerHTML = "";
  state.strokePaths = [];
  clearStrokeHighlightPlayback();
}

function createStrokePreview(pathData) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 1024 1024");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "#0f172a");

  svg.appendChild(path);
  return svg;
}

function renderStrokeOrder(strokes) {
  clearStrokeList();
  if (!Array.isArray(strokes) || strokes.length === 0) {
    setStrokeMeta("暂未获取到笔画顺序数据。");
    return;
  }
  state.strokePaths = [...strokes];

  strokes.forEach((strokePath, index) => {
    const li = document.createElement("li");
    li.dataset.strokeIndex = String(index);
    const preview = document.createElement("span");
    preview.className = "stroke-preview";
    preview.appendChild(createStrokePreview(strokePath));

    const label = document.createElement("span");
    label.textContent = `第 ${index + 1} 笔`;

    li.appendChild(preview);
    li.appendChild(label);
    refs.strokeOrderList.appendChild(li);
  });
}

function createWriter(char) {
  if (typeof HanziWriter === "undefined") {
    setStrokeMeta("笔顺库未加载，请检查网络后刷新。");
    return;
  }
  clearStrokeHighlightPlayback();

  const side = Math.min(refs.writerTarget.clientWidth || 240, 240);
  refs.writerTarget.innerHTML = "";
  try {
    state.writer = HanziWriter.create("writerTarget", char, {
      width: side,
      height: side,
      padding: 8,
      strokeColor: "#111827",
      radicalColor: "#0ea5e9",
      outlineColor: "#94a3b8",
      delayBetweenStrokes: 220,
    });
  } catch (error) {
    state.writer = null;
    setStrokeMeta(`无法展示“${char}”的笔顺动画，请尝试其他汉字。`);
  }
}

async function loadStrokeData(char) {
  const reqId = ++state.strokeReqId;
  clearStrokeList();
  setStrokeMeta("正在加载笔画顺序数据...");

  const endpoints = [
    `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(char)}.json`,
    `https://unpkg.com/hanzi-writer-data@latest/${encodeURIComponent(char)}.json`,
  ];

  let data = null;
  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      data = await response.json();
      break;
    } catch (error) {
      // Try next endpoint.
    }
  }

  if (reqId !== state.strokeReqId) {
    return;
  }

  if (!data?.strokes?.length) {
    setStrokeMeta("未找到该字笔画数据，可尝试其他汉字。");
    return;
  }

  setStrokeMeta(`共 ${data.strokes.length} 笔，按 1 → ${data.strokes.length} 顺序书写。`);
  renderStrokeOrder(data.strokes);
  if (state.loopMode) {
    startStrokeHighlightPlayback(true);
  }
}

function updatePickerActive(char) {
  refs.charPicker.querySelectorAll(".char-pill").forEach((node) => {
    node.classList.toggle("active", node.textContent === char);
  });
}

function selectChar(char) {
  if (!isHanziMode()) {
    return;
  }
  stopFollowReading();
  clearStrokeHighlightPlayback();
  state.selectedChar = char;
  state.loopMode = false;
  refs.loopBtn.textContent = "循环演示：关";
  refs.currentChar.textContent = char;
  updatePickerActive(char);
  createWriter(char);
  loadStrokeData(char);
  resetFollowPanel(char);
}

function regenerate(options) {
  if (!options?.preserveWorkbook) {
    state.activeWorkbookId = "";
    renderCharTags(refs.bookFocusChars, []);
    renderCharTags(refs.scanWeakChars, []);
    setBookMeta("当前为自定义字帖模式。你也可以在下方生成年龄分级字帖本。");
  }
  const chars = extractInputChars(refs.textInput.value.trim());
  state.chars = chars;

  renderWorksheet(chars);
  renderCharPicker(chars);

  if (!isHanziMode()) {
    stopFollowReading();
    state.selectedChar = "";
    refs.currentChar.textContent = chars[0] || "-";
    refs.writerTarget.innerHTML = "";
    clearStrokeList();
    setStrokeMeta("数学数字模式下不提供汉字笔顺演示，可直接生成并打印字帖。");
    resetFollowPanel("");
    return;
  }

  if (chars.length === 0) {
    stopFollowReading();
    state.selectedChar = "";
    refs.currentChar.textContent = "-";
    refs.writerTarget.innerHTML = "";
    clearStrokeList();
    setStrokeMeta("请选择一个汉字查看笔画顺序。");
    resetFollowPanel("");
    return;
  }

  const preferred = chars.includes(state.selectedChar) ? state.selectedChar : chars[0];
  selectChar(preferred);
}

function toggleLoopMode() {
  if (!isHanziMode()) {
    return;
  }
  state.loopMode = !state.loopMode;
  refs.loopBtn.textContent = `循环演示：${state.loopMode ? "开" : "关"}`;

  if (!state.writer) {
    return;
  }

  if (state.loopMode) {
    startStrokeHighlightPlayback(true);
    if (typeof state.writer.loopCharacterAnimation === "function") {
      state.writer.loopCharacterAnimation();
    } else if (typeof state.writer.animateCharacter === "function") {
      state.writer.animateCharacter();
    }
  } else {
    clearStrokeHighlightPlayback();
    createWriter(state.selectedChar);
  }
}

function bindEvents() {
  refs.practiceModeSelect?.addEventListener("change", () => {
    state.practiceMode = refs.practiceModeSelect.value === "math" ? "math" : "hanzi";
    refreshPracticeModeUI();
    regenerate();
  });

  refs.gradeTemplateSelect?.addEventListener("change", () => {
    applyGradeTemplatePreset(refs.gradeTemplateSelect.value || "custom");
    if (!patchActiveWorkbookConfigSnapshot()) {
      regenerate({ preserveWorkbook: Boolean(state.activeWorkbookId) });
    }
  });

  refs.showPinyin?.addEventListener("change", () => {
    switchTemplateToCustomOnManualEdit();
    if (!patchActiveWorkbookConfigSnapshot()) {
      regenerate({ preserveWorkbook: Boolean(state.activeWorkbookId) });
    }
  });

  refs.generateBtn.addEventListener("click", regenerate);
  refs.printBtn.addEventListener("click", () => tryPrintWorksheet("worksheet_print_custom"));
  refs.exportPdfBtn?.addEventListener("click", () => {
    exportWorksheetPdf().catch((error) => {
      window.alert(`PDF 导出失败：${error.message || "未知错误"}`);
    });
  });
  refs.clearBtn.addEventListener("click", () => {
    refs.textInput.value = "";
    regenerate();
  });

  refs.animateBtn.addEventListener("click", () => {
    if (!isHanziMode() || !state.writer || !state.selectedChar) {
      return;
    }
    state.loopMode = false;
    refs.loopBtn.textContent = "循环演示：关";
    startStrokeHighlightPlayback(false);
    if (typeof state.writer.animateCharacter === "function") {
      state.writer.animateCharacter();
    }
  });

  refs.loopBtn.addEventListener("click", toggleLoopMode);

  refs.speakBtn?.addEventListener("click", () => {
    if (!isHanziMode() || !state.selectedChar) {
      return;
    }
    speakText(state.selectedChar);
  });

  refs.followBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    startFollowReading();
  });

  refs.addCurrentToCartBtn?.addEventListener("click", () => {
    if (!isHanziMode() || !state.selectedChar) {
      return;
    }
    addCharsToCart(state.selectedChar, "worksheet_current_char");
  });

  refs.useCartBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    const cart = getCartChars();
    if (!cart.length) {
      return;
    }
    refs.textInput.value = cart.join("");
    regenerate();
  });

  refs.mergeCartBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    const cart = getCartChars();
    if (!cart.length) {
      return;
    }
    const merged = [...new Set([...extractChineseChars(refs.textInput.value), ...cart])];
    refs.textInput.value = merged.join("");
    regenerate();
  });

  refs.clearCartBtn?.addEventListener("click", () => {
    if (!isHanziMode() || !store) {
      return;
    }
    store.clearWorksheetCart();
    refreshCartPanel();
  });

  refs.quizBtn.addEventListener("click", () => {
    if (!isHanziMode() || !state.writer || !state.selectedChar) {
      return;
    }
    state.loopMode = false;
    refs.loopBtn.textContent = "循环演示：关";
    if (typeof state.writer.quiz === "function") {
      state.writer.quiz({
        leniency: 1,
        showHintAfterMisses: 2,
        onComplete: () => setStrokeMeta(`"${state.selectedChar}" 练习完成，可继续书写。`),
      });
      setStrokeMeta("请在左侧网格中手写当前汉字笔画。");
    } else {
      setStrokeMeta("当前环境不支持手写练习模式。");
    }
  });

  refs.bookAgeGroup?.addEventListener("change", () => {
    const ageGroup = refs.bookAgeGroup.value;
    const level = refs.bookLevel?.value || "HSK1";
    refs.bookCharCount.value = String(getDefaultBookCharCount(ageGroup, level));
  });

  refs.bookLevel?.addEventListener("change", () => {
    const ageGroup = refs.bookAgeGroup?.value || "9-12";
    const level = refs.bookLevel.value;
    refs.bookCharCount.value = String(getDefaultBookCharCount(ageGroup, level));
  });

  refs.generateBookBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    const book = generateWorkbook({ source: "grading_auto" });
    if (book) {
      setScanMeta(`已生成 ${book.title}（第 ${book.cycle} 册），可直接整本打印。`);
    }
  });

  refs.printBookBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    if (!state.activeWorkbookId) {
      const book = generateWorkbook({ source: "grading_auto" });
      if (!book) {
        return;
      }
    }
    tryPrintWorksheet("worksheet_print_book");
  });

  refs.scanBookSelect?.addEventListener("change", () => {
    const book = getWorkbookRecordById(refs.scanBookSelect.value);
    if (!book) {
      return;
    }
    if (refs.scanThreshold) {
      refs.scanThreshold.value = String(clampNumber(book.threshold, 50, 100, 80));
    }
    renderWorkbookPreview(book);
    setScanMeta(
      book.scanSummary
        ? `已加载：达标 ${book.scanSummary.masteredCount}/${book.scanSummary.totalChars}，未达标 ${book.scanSummary.weakCount}。`
        : "已加载字帖本，请粘贴扫描结果后点击“应用扫描评估”。"
    );
  });

  refs.scanFileInput?.addEventListener("change", async (event) => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      refs.scanResultInput.value = text;
      setScanMeta(`已导入扫描文本：${file.name}，请点击“应用扫描评估”。`);
    } catch (error) {
      setScanMeta("扫描文本导入失败，请重试。");
    }
    refs.scanFileInput.value = "";
  });

  refs.applyScanBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    applyScanToSelectedBook();
  });

  refs.generateNextBookBtn?.addEventListener("click", () => {
    if (!isHanziMode()) {
      return;
    }
    generateNextWorkbookFromSelected();
  });

  [
    refs.gridType,
    refs.repeatCount,
    refs.columns,
    refs.cellSize,
    refs.traceMode,
    refs.showGuide,
  ].forEach((node) => {
    node.addEventListener("change", () => {
      switchTemplateToCustomOnManualEdit();
      if (state.chars.length) {
        if (patchActiveWorkbookConfigSnapshot()) {
          return;
        }
        renderWorksheet(state.chars);
      }
    });
  });

  window.addEventListener("focus", refreshBillingTip);
}

function bootstrap() {
  refreshSpeechVoice();
  if ("speechSynthesis" in window && typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", refreshSpeechVoice);
  }
  setupFollowReading();
  loadWorkbookHistory();
  loadWorkbookMasteryMap();
  initWorkbookSelectors();
  refreshWorkbookHistoryState();
  setBookMeta("当前为自定义字帖模式。你也可以在下方生成年龄分级字帖本。");
  setScanMeta("扫描后会自动标记未达标字，并可一键生成下一册强化字帖本。");
  const params = new URLSearchParams(window.location.search);
  state.practiceMode = params.get("mode") === "math" ? "math" : "hanzi";
  const templateFromQuery = params.get("template");
  const initialTemplate = GRADE_TEMPLATE_PRESETS[templateFromQuery] ? templateFromQuery : "custom";
  if (refs.practiceModeSelect) {
    refs.practiceModeSelect.value = state.practiceMode;
  }
  applyGradeTemplatePreset(initialTemplate);
  if (refs.showPinyin && params.get("pinyin") === "1") {
    refs.showPinyin.checked = true;
  }
  refreshPracticeModeUI();
  const presetSource =
    state.practiceMode === "math" ? params.get("expr") || params.get("chars") || "" : params.get("chars") || "";
  const presetChars = extractInputChars(presetSource);
  const cart = getCartChars();
  const fallback = state.practiceMode === "math" ? "1+2=3 8÷2=4" : "永和春风";
  refs.textInput.value = presetChars.length
    ? presetChars.join("")
    : isHanziMode() && cart.length
    ? cart.join("")
    : fallback;
  refreshCartPanel();
  refreshBillingTip();
  bindEvents();
  regenerate();
}

bootstrap();
