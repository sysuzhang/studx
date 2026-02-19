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
  gridType: document.getElementById("gridType"),
  repeatCount: document.getElementById("repeatCount"),
  columns: document.getElementById("columns"),
  cellSize: document.getElementById("cellSize"),
  traceMode: document.getElementById("traceMode"),
  showGuide: document.getElementById("showGuide"),
  generateBtn: document.getElementById("generateBtn"),
  printBtn: document.getElementById("printBtn"),
  clearBtn: document.getElementById("clearBtn"),
  billingTip: document.getElementById("billingTip"),
  charPickerSection: document.getElementById("charPickerSection"),
  charPickerTitle: document.getElementById("charPickerTitle"),
  charPicker: document.getElementById("charPicker"),
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
  return {
    gridType: refs.gridType.value,
    repeatCount: Math.min(Math.max(toInt(refs.repeatCount.value, 10), 2), 24),
    columns: Math.min(Math.max(toInt(refs.columns.value, 10), 4), 20),
    cellSize: Math.min(Math.max(toInt(refs.cellSize.value, 60), 40), 90),
    traceMode: refs.traceMode.value,
    showGuide: refs.showGuide.checked,
  };
}

function buildCells(chars, config) {
  const cells = [];
  chars.forEach((char) => {
    for (let i = 0; i < config.repeatCount; i += 1) {
      let mode = "hidden";
      if (i === 0 && config.showGuide) {
        mode = "model";
      } else if (i > 0 && config.traceMode === "trace" && config.showGuide) {
        mode = "trace";
      }
      cells.push({ char, mode });
    }
  });
  return cells;
}

function renderWorksheet(chars) {
  refs.worksheetPages.innerHTML = "";
  const config = getWorksheetConfig();
  const hanziMode = isHanziMode();

  const cells = buildCells(chars, config);
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
      <span>${hanziMode ? "练字内容" : "练习内容"}：${chars.join("")}</span>
      <span>第 ${index + 1} / ${pages.length} 页</span>
    `;

    const grid = document.createElement("div");
    grid.className = "worksheet-grid";
    grid.style.gridTemplateColumns = `repeat(${config.columns}, var(--cell-size))`;
    grid.style.setProperty("--cell-size", `${config.cellSize}px`);

    pageCells.forEach((item) => {
      const cell = document.createElement("div");
      cell.className = `grid-cell ${config.gridType}`;

      const charNode = document.createElement("span");
      charNode.className = `cell-char ${item.mode} ${hanziMode ? "hanzi" : "math"}`;
      charNode.textContent = item.char;

      cell.appendChild(charNode);
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

function clearStrokeList() {
  refs.strokeOrderList.innerHTML = "";
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

  strokes.forEach((strokePath, index) => {
    const li = document.createElement("li");
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
  state.selectedChar = char;
  state.loopMode = false;
  refs.loopBtn.textContent = "循环演示：关";
  refs.currentChar.textContent = char;
  updatePickerActive(char);
  createWriter(char);
  loadStrokeData(char);
  resetFollowPanel(char);
}

function regenerate() {
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
    if (typeof state.writer.loopCharacterAnimation === "function") {
      state.writer.loopCharacterAnimation();
    } else if (typeof state.writer.animateCharacter === "function") {
      state.writer.animateCharacter();
    }
  } else {
    createWriter(state.selectedChar);
  }
}

function bindEvents() {
  refs.practiceModeSelect?.addEventListener("change", () => {
    state.practiceMode = refs.practiceModeSelect.value === "math" ? "math" : "hanzi";
    refreshPracticeModeUI();
    regenerate();
  });

  refs.generateBtn.addEventListener("click", regenerate);
  refs.printBtn.addEventListener("click", () => {
    if (!store || typeof store.consumeFeatureUsage !== "function") {
      window.print();
      return;
    }
    const result = store.consumeFeatureUsage("worksheet_print", 1, { source: "worksheet_print" });
    if (!result.ok) {
      const limitText = result.limit === null ? "不限" : `${result.limit} 次/天`;
      const shouldUpgrade = window.confirm(
        `当前套餐“${result.planName}”的字帖打印配额已用完（${limitText}）。\n是否前往订阅中心升级套餐？`
      );
      if (shouldUpgrade) {
        window.location.href = "./pricing.html";
      }
      refreshBillingTip();
      return;
    }
    refreshBillingTip();
    window.print();
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

  [
    refs.gridType,
    refs.repeatCount,
    refs.columns,
    refs.cellSize,
    refs.traceMode,
    refs.showGuide,
  ].forEach((node) => {
    node.addEventListener("change", () => {
      if (state.chars.length) {
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
  const params = new URLSearchParams(window.location.search);
  state.practiceMode = params.get("mode") === "math" ? "math" : "hanzi";
  if (refs.practiceModeSelect) {
    refs.practiceModeSelect.value = state.practiceMode;
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
