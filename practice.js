const refs = {
  ageSelect: document.getElementById("ageSelect"),
  levelSelect: document.getElementById("levelSelect"),
  pinyinToggle: document.getElementById("pinyinToggle"),
  generateBtn: document.getElementById("generateBtn"),
  calendarLink: document.getElementById("calendarLink"),
  worksheetLink: document.getElementById("worksheetLink"),
  progressMeta: document.getElementById("progressMeta"),
  learnedCount: document.getElementById("learnedCount"),
  reviewCount: document.getElementById("reviewCount"),
  wrongCount: document.getElementById("wrongCount"),
  learnedPreview: document.getElementById("learnedPreview"),
  reviewPreview: document.getElementById("reviewPreview"),
  wrongPreview: document.getElementById("wrongPreview"),
  markLearnedBtn: document.getElementById("markLearnedBtn"),
  markReviewBtn: document.getElementById("markReviewBtn"),
  markWrongBtn: document.getElementById("markWrongBtn"),
  clearProgressBtn: document.getElementById("clearProgressBtn"),
  resultMeta: document.getElementById("resultMeta"),
  charList: document.getElementById("charList"),
  detailChar: document.getElementById("detailChar"),
  detailPinyin: document.getElementById("detailPinyin"),
  detailMeaning: document.getElementById("detailMeaning"),
  speakCurrentBtn: document.getElementById("speakCurrentBtn"),
  addToWorksheetBtn: document.getElementById("addToWorksheetBtn"),
  openWorksheetLink: document.getElementById("openWorksheetLink"),
  worksheetCartTip: document.getElementById("worksheetCartTip"),
  followStartBtn: document.getElementById("followStartBtn"),
  followStopBtn: document.getElementById("followStopBtn"),
  followStatus: document.getElementById("followStatus"),
  followResult: document.getElementById("followResult"),
  followCompare: document.getElementById("followCompare"),
  pictographScript: document.getElementById("pictographScript"),
  pictographImage: document.getElementById("pictographImage"),
  pictographNote: document.getElementById("pictographNote"),
  pictographSource: document.getElementById("pictographSource"),
  wordList: document.getElementById("wordList"),
  idiomList: document.getElementById("idiomList"),
  writerTarget: document.getElementById("writerTarget"),
  animateBtn: document.getElementById("animateBtn"),
  loopBtn: document.getElementById("loopBtn"),
  strokeMeta: document.getElementById("strokeMeta"),
  strokeOrderList: document.getElementById("strokeOrderList"),
  idiomStoryModal: document.getElementById("idiomStoryModal"),
  idiomStoryCloseBtn: document.getElementById("idiomStoryCloseBtn"),
  idiomStoryTitle: document.getElementById("idiomStoryTitle"),
  idiomStoryMeaning: document.getElementById("idiomStoryMeaning"),
  idiomStoryImage: document.getElementById("idiomStoryImage"),
  idiomStoryCaption: document.getElementById("idiomStoryCaption"),
  idiomStoryText: document.getElementById("idiomStoryText"),
  idiomSpeakNameBtn: document.getElementById("idiomSpeakNameBtn"),
  idiomSpeakStoryBtn: document.getElementById("idiomSpeakStoryBtn"),
};

const state = {
  filtered: [],
  selectedChar: "",
  queryChar: "",
  writer: null,
  loopMode: false,
  strokeReqId: 0,
  showPinyin: true,
  library: [],
  dimensions: {
    ageGroups: [],
    chineseLevels: [],
  },
  bankSourceLabel: "本地题库",
  progressSummary: {
    learnedCount: 0,
    reviewCount: 0,
    wrongCount: 0,
    learnedChars: [],
    reviewChars: [],
    wrongChars: [],
    updatedAt: 0,
  },
  idiomModal: {
    item: null,
    targetChar: "",
  },
};

const FALLBACK_LIBRARY = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const FALLBACK_DIMENSIONS = window.LEARNING_DIMENSIONS || { ageGroups: [], chineseLevels: [] };
const QUESTION_BANK_API_URLS = [
  "/api/question-bank",
  "/api/question-bank.json",
  "./api/question-bank",
];
const speechState = { voice: null };
const store = window.LearningStore;
const followState = {
  supported: false,
  listening: false,
  recognition: null,
};
const HANZI_WRITER_CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/hanzi-writer/dist/hanzi-writer.min.js",
  "https://unpkg.com/hanzi-writer@3.7.3/dist/hanzi-writer.min.js",
];

let writerLoadPromise = null;
const charPinyinMap = new Map();
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

let hanRegex;
try {
  hanRegex = /\p{Script=Han}/u;
} catch (error) {
  hanRegex = /[\u3400-\u9fff\uf900-\ufaff]/;
}

function fillSelect(selectNode, options) {
  if (!selectNode) {
    return;
  }
  selectNode.innerHTML = "";
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    selectNode.appendChild(option);
  });
}

function normalizeDimensionOptions(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => ({
      value: String(item?.value || "").trim(),
      label: String(item?.label || item?.value || "").trim(),
    }))
    .filter((item) => item.value);
}

function normalizeDimensionsPayload(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    ageGroups: normalizeDimensionOptions(source.ageGroups),
    chineseLevels: normalizeDimensionOptions(source.chineseLevels),
  };
}

function normalizeWordRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((item) => ({
      word: String(item?.word || "").trim(),
      meaning: String(item?.meaning || "").trim(),
    }))
    .filter((item) => item.word);
}

function normalizeIdiomRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((item) => ({
      name: String(item?.name || "").trim(),
      meaning: String(item?.meaning || "").trim(),
      story: String(item?.story || "").trim(),
      image: String(item?.image || "").trim(),
      imageCaption: String(item?.imageCaption || "").trim(),
    }))
    .filter((item) => item.name);
}

function normalizeLibraryRows(rows) {
  const pictographMap = window.HANZI_PICTOGRAPH_MAP || {};
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((item) => {
      const char = String(item?.char || "").trim();
      if (!char) {
        return null;
      }
      const ages = Array.isArray(item?.ages)
        ? item.ages.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const levels = Array.isArray(item?.levels)
        ? item.levels.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const pictograph =
        item?.pictograph && typeof item.pictograph === "object"
          ? item.pictograph
          : pictographMap[char] || null;
      return {
        char,
        pinyin: String(item?.pinyin || "").trim(),
        meaning: String(item?.meaning || "").trim(),
        ages,
        levels,
        words: normalizeWordRows(item?.words),
        idioms: normalizeIdiomRows(item?.idioms),
        pictograph,
      };
    })
    .filter(Boolean);
}

function rebuildCharPinyinMap(rows) {
  charPinyinMap.clear();
  rows.forEach((item) => {
    if (!item?.char) {
      return;
    }
    charPinyinMap.set(item.char, item.pinyin || "");
  });
}

function applyQuestionBank(rows, dimensions, sourceLabel) {
  const normalizedRows = normalizeLibraryRows(rows);
  const normalizedDimensions = normalizeDimensionsPayload(dimensions);
  const safeDimensions = {
    ageGroups: normalizedDimensions.ageGroups.length
      ? normalizedDimensions.ageGroups
      : normalizeDimensionOptions(FALLBACK_DIMENSIONS.ageGroups),
    chineseLevels: normalizedDimensions.chineseLevels.length
      ? normalizedDimensions.chineseLevels
      : normalizeDimensionOptions(FALLBACK_DIMENSIONS.chineseLevels),
  };
  state.library = normalizedRows.length ? normalizedRows : normalizeLibraryRows(FALLBACK_LIBRARY);
  state.dimensions = safeDimensions;
  state.bankSourceLabel = sourceLabel || "本地题库";
  rebuildCharPinyinMap(state.library);
}

function normalizeQuestionBankPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.library)
    ? payload.library
    : Array.isArray(payload.items)
    ? payload.items
    : null;
  const dimensions = payload.dimensions || payload.meta?.dimensions || null;
  if (!rows || !rows.length) {
    return null;
  }
  return { rows, dimensions };
}

async function loadQuestionBankFromApi() {
  for (const url of QUESTION_BANK_API_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      const normalized = normalizeQuestionBankPayload(payload);
      if (!normalized) {
        continue;
      }
      applyQuestionBank(normalized.rows, normalized.dimensions, "云端题库 API");
      return true;
    } catch (error) {
      // Try next fallback endpoint.
    }
  }
  return false;
}

async function initQuestionBank() {
  const loaded = await loadQuestionBankFromApi();
  if (!loaded) {
    applyQuestionBank(FALLBACK_LIBRARY, FALLBACK_DIMENSIONS, "内置题库");
  }
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const node = document.createElement("script");
    node.src = src;
    node.async = true;
    node.onload = () => resolve(true);
    node.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(node);
  });
}

async function ensureHanziWriterReady() {
  if (typeof window.HanziWriter !== "undefined") {
    return true;
  }
  if (writerLoadPromise) {
    return writerLoadPromise;
  }
  writerLoadPromise = (async () => {
    for (const src of HANZI_WRITER_CDN_URLS) {
      try {
        await loadExternalScript(src);
      } catch (error) {
        // Try next CDN endpoint.
      }
      if (typeof window.HanziWriter !== "undefined") {
        return true;
      }
    }
    return false;
  })();
  const loaded = await writerLoadPromise;
  if (!loaded) {
    writerLoadPromise = null;
  }
  return loaded;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function buildRubyHtml(char, pinyin) {
  return `<ruby class="hz-ruby"><rb>${escapeHtml(char)}</rb><rt>${escapeHtml(
    pinyin
  )}</rt></ruby>`;
}

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

function previewChars(chars) {
  if (!Array.isArray(chars) || !chars.length) {
    return "暂无";
  }
  return chars.slice(0, 10).join(" ") + (chars.length > 10 ? " ..." : "");
}

function refreshProgressPanel() {
  const summary =
    store && typeof store.getPracticeProgressSummary === "function"
      ? store.getPracticeProgressSummary(20)
      : {
          learnedCount: 0,
          reviewCount: 0,
          wrongCount: 0,
          learnedChars: [],
          reviewChars: [],
          wrongChars: [],
          updatedAt: 0,
        };
  state.progressSummary = summary;
  if (refs.learnedCount) {
    refs.learnedCount.textContent = String(summary.learnedCount || 0);
  }
  if (refs.reviewCount) {
    refs.reviewCount.textContent = String(summary.reviewCount || 0);
  }
  if (refs.wrongCount) {
    refs.wrongCount.textContent = String(summary.wrongCount || 0);
  }
  if (refs.learnedPreview) {
    refs.learnedPreview.textContent = previewChars(summary.learnedChars);
  }
  if (refs.reviewPreview) {
    refs.reviewPreview.textContent = previewChars(summary.reviewChars);
  }
  if (refs.wrongPreview) {
    refs.wrongPreview.textContent = previewChars(summary.wrongChars);
  }
  if (refs.progressMeta) {
    refs.progressMeta.textContent = `已学 ${summary.learnedCount || 0} / 复习 ${
      summary.reviewCount || 0
    } / 错题 ${summary.wrongCount || 0}（本地存储）`;
  }
}

function markSelectedCharProgress(bucket, payload) {
  if (!state.selectedChar || !store) {
    return false;
  }
  if (bucket === "learned" && typeof store.markPracticeCharLearned === "function") {
    store.markPracticeCharLearned(state.selectedChar, payload || {});
  } else if (bucket === "review" && typeof store.markPracticeCharForReview === "function") {
    store.markPracticeCharForReview(state.selectedChar, payload || {});
  } else if (bucket === "wrong" && typeof store.markPracticeWrongChar === "function") {
    store.markPracticeWrongChar(state.selectedChar, payload || {});
  } else {
    return false;
  }
  refreshProgressPanel();
  renderCharList(state.filtered);
  updateActiveCard();
  return true;
}

function applyFollowProgress(char, level, transcript) {
  if (!char || !store) {
    return;
  }
  if (level === "ok" && typeof store.markPracticeCharLearned === "function") {
    store.markPracticeCharLearned(char, {
      source: "practice_follow",
      reason: "follow_ok",
      clearReview: true,
    });
  } else if (level === "warn" && typeof store.markPracticeCharForReview === "function") {
    store.markPracticeCharForReview(char, {
      source: "practice_follow",
      reason: "follow_warn",
    });
  } else if (level === "bad") {
    if (typeof store.markPracticeWrongChar === "function") {
      store.markPracticeWrongChar(char, {
        source: "practice_follow",
        reason: "follow_bad",
        transcript: String(transcript || ""),
      });
    }
    if (typeof store.markPracticeCharForReview === "function") {
      store.markPracticeCharForReview(char, {
        source: "practice_follow",
        reason: "follow_bad",
      });
    }
  }
  refreshProgressPanel();
  renderCharList(state.filtered);
  updateActiveCard();
}

function getCharProgressBadges(char) {
  const status =
    store && typeof store.getPracticeCharProgress === "function"
      ? store.getPracticeCharProgress(char)
      : { learned: false, inReview: false, wrongCount: 0 };
  const badges = [];
  if (status.learned) {
    badges.push({ type: "learned", text: "已学" });
  }
  if (status.inReview) {
    badges.push({ type: "review", text: "复习" });
  }
  if (status.wrongCount > 0) {
    badges.push({ type: "wrong", text: `错题 ${status.wrongCount}` });
  }
  return badges;
}

function getCartChars() {
  return store && typeof store.getWorksheetCart === "function" ? store.getWorksheetCart() : [];
}

function refreshWorksheetCartTip() {
  if (!refs.worksheetCartTip) {
    return;
  }
  const cart = getCartChars();
  refs.worksheetCartTip.textContent = `字帖收藏：${cart.length} 字`;
  if (refs.openWorksheetLink) {
    const fallbackChars = state.selectedChar ? state.selectedChar : "";
    const targetChars = cart.length ? cart.join("") : fallbackChars;
    refs.openWorksheetLink.href = targetChars
      ? `./worksheet.html?chars=${encodeURIComponent(targetChars)}`
      : "./worksheet.html";
  }
}

function addCharsToWorksheet(chars, source) {
  if (!store || !chars || typeof store.addWorksheetChars !== "function") {
    return;
  }
  store.addWorksheetChars(chars, source || "practice");
  refreshWorksheetCartTip();
}

function normalizePinyin(pinyin) {
  return String(pinyin ?? "")
    .toLowerCase()
    .replace(/[āáǎà]/g, "a")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "v")
    .replace(/[^a-zv]/g, "");
}

function firstHanChar(text) {
  return [...String(text ?? "")].find((char) => hanRegex.test(char)) || "";
}

function setFollowCompareLine(level, text) {
  if (!refs.followCompare) {
    return;
  }
  refs.followCompare.className = `follow-line ${level}`.trim();
  refs.followCompare.textContent = text;
}

function resetFollowPanel(item) {
  if (!refs.followResult || !refs.followStatus || !refs.followCompare) {
    return;
  }
  refs.followResult.textContent = "识别结果：-";
  refs.followCompare.className = "follow-line";
  refs.followCompare.textContent = `对比结果：请朗读“${item.char}（${item.pinyin}）”`;
  refs.followStatus.textContent = followState.supported
    ? "点击“开始跟读”后，清晰朗读一次当前汉字。"
    : "当前浏览器暂不支持语音识别，可继续使用“朗读当前汉字”进行听读训练。";
}

function evaluateFollowReading(transcript, targetItem, confidence) {
  const cleaned = String(transcript ?? "").replace(/[，。！？、,.!?;；:：\s]/g, "");
  if (!cleaned) {
    return { level: "bad", text: "❌ 未识别到清晰内容，请靠近麦克风再试一次。" };
  }

  const confidenceText =
    Number.isFinite(confidence) && confidence > 0 ? `（识别置信度 ${Math.round(confidence * 100)}%）` : "";

  if (cleaned.includes(targetItem.char)) {
    return { level: "ok", text: `✅ 与标准读音匹配，你读出了“${targetItem.char}”${confidenceText}` };
  }

  const recognizedChar = firstHanChar(cleaned);
  const recognizedPinyin = normalizePinyin(charPinyinMap.get(recognizedChar));
  const targetPinyin = normalizePinyin(targetItem.pinyin);
  if (recognizedChar && recognizedPinyin && recognizedPinyin === targetPinyin) {
    return {
      level: "warn",
      text: `🟡 识别为“${recognizedChar}”，与目标字同音，发音接近${confidenceText}`,
    };
  }

  return {
    level: "bad",
    text: `❌ 识别为“${cleaned}”，与标准读音差异较大，建议放慢语速重读。${confidenceText}`,
  };
}

function stopFollowReading() {
  if (followState.recognition && followState.listening) {
    followState.recognition.stop();
  }
}

function startFollowReading() {
  if (!followState.supported || !followState.recognition || !state.selectedChar) {
    return;
  }
  if (followState.listening) {
    return;
  }
  refs.followResult.textContent = "识别结果：识别中...";
  setFollowCompareLine("warn", "对比结果：请朗读当前汉字...");
  try {
    followState.recognition.start();
  } catch (error) {
    refs.followStatus.textContent = "语音识别启动失败，请稍后再试。";
  }
}

function setupFollowReading() {
  followState.supported = Boolean(SpeechRecognitionCtor);
  if (!refs.followStartBtn || !refs.followStopBtn) {
    return;
  }

  if (!followState.supported) {
    refs.followStartBtn.disabled = true;
    refs.followStopBtn.disabled = true;
    return;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    followState.listening = true;
    refs.followStartBtn.textContent = "跟读中...";
    refs.followStatus.textContent = "正在收听，请读出当前汉字。";
  };

  recognition.onresult = (event) => {
    const result = event.results?.[0]?.[0];
    const transcript = result?.transcript?.trim() || "";
    const confidence = Number.isFinite(result?.confidence) ? result.confidence : NaN;
    refs.followResult.textContent = `识别结果：${transcript || "（未识别）"}`;

    const item = state.filtered.find((entry) => entry.char === state.selectedChar);
    if (!item) {
      return;
    }
    const compare = evaluateFollowReading(transcript, item, confidence);
    setFollowCompareLine(compare.level, compare.text);
    if (store && typeof store.appendFollowReadingRecord === "function") {
      store.appendFollowReadingRecord({
        char: item.char,
        level: compare.level,
        transcript,
        confidence,
        source: "practice",
      });
    }
    applyFollowProgress(item.char, compare.level, transcript);
  };

  recognition.onerror = (event) => {
    const msg = event?.error || "unknown";
    refs.followStatus.textContent = `语音识别异常：${msg}`;
    setFollowCompareLine("bad", "对比结果：本次识别失败，请再试一次。");
  };

  recognition.onend = () => {
    followState.listening = false;
    refs.followStartBtn.textContent = "开始跟读";
    if (!refs.followStatus.textContent.startsWith("语音识别异常")) {
      refs.followStatus.textContent = "可继续点击“开始跟读”进行下一次练习。";
    }
  };

  followState.recognition = recognition;
}

function annotateByTarget(text, targetChar, pinyin) {
  const raw = String(text ?? "");
  if (!state.showPinyin || !targetChar || !pinyin) {
    return escapeHtml(raw);
  }
  return [...raw]
    .map((char) => (char === targetChar ? buildRubyHtml(char, pinyin) : escapeHtml(char)))
    .join("");
}

function buildPictographFallback(char) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#eaf2ff" />
          <stop offset="100%" stop-color="#f8fbff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="118" height="118" rx="16" fill="url(#g)" stroke="#dbe7fb"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-size="54" fill="#334155" font-family="KaiTi, STKaiti, serif">${escapeHtml(char || "字")}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setImageWithFallback(imgNode, src, char) {
  const fallback = buildPictographFallback(char);
  imgNode.onerror = () => {
    if (imgNode.src !== fallback) {
      imgNode.src = fallback;
    }
  };
  imgNode.src = src || fallback;
}

function hashString(text) {
  let hash = 0;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildIdiomStoryImage(item, targetChar) {
  const themes = [
    { from: "#e0f2fe", to: "#bfdbfe", hill: "#60a5fa", sun: "#facc15" },
    { from: "#dcfce7", to: "#bbf7d0", hill: "#34d399", sun: "#fb923c" },
    { from: "#fef3c7", to: "#fde68a", hill: "#f59e0b", sun: "#f97316" },
    { from: "#ede9fe", to: "#ddd6fe", hill: "#8b5cf6", sun: "#f43f5e" },
  ];
  const theme = themes[hashString(item?.name || targetChar) % themes.length];
  const title = escapeHtml(String(item?.name || "成语故事").slice(0, 10));
  const subtitle = escapeHtml(`${targetChar || "汉字"} · 成语场景`);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.from}" />
          <stop offset="100%" stop-color="${theme.to}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="960" height="420" fill="url(#bg)" />
      <circle cx="820" cy="90" r="44" fill="${theme.sun}" opacity="0.9" />
      <path d="M0 320 Q160 250 320 300 T640 292 T960 330 V420 H0 Z" fill="${theme.hill}" opacity="0.62" />
      <path d="M0 350 Q210 286 420 334 T960 348 V420 H0 Z" fill="#ffffff" opacity="0.48" />
      <rect x="44" y="48" width="440" height="94" rx="16" fill="#ffffff" opacity="0.76" />
      <text x="72" y="108" fill="#1e293b" font-size="48" font-family="KaiTi, STKaiti, serif">${title}</text>
      <text x="72" y="152" fill="#334155" font-size="24" font-family="Noto Sans SC, sans-serif">${subtitle}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function closeIdiomStoryModal() {
  if (!refs.idiomStoryModal) {
    return;
  }
  refs.idiomStoryModal.classList.add("hidden");
  refs.idiomStoryModal.setAttribute("aria-hidden", "true");
  state.idiomModal = { item: null, targetChar: "" };
  document.body.style.overflow = "";
}

function openIdiomStoryModal(item, targetChar) {
  if (!refs.idiomStoryModal || !item) {
    return;
  }
  state.idiomModal = { item, targetChar };
  refs.idiomStoryTitle.textContent = item.name || "成语故事详情";
  refs.idiomStoryMeaning.textContent = `释义：${item.meaning || "暂无释义"}`;
  refs.idiomStoryText.textContent = item.story || "暂无故事内容";
  const imageSrc = item.image || buildIdiomStoryImage(item, targetChar);
  refs.idiomStoryImage.src = imageSrc;
  refs.idiomStoryImage.alt = `${item.name || "成语"} 配图`;
  refs.idiomStoryCaption.textContent = item.imageCaption || "配图：教学场景插图（支持后续替换真实素材）";

  refs.idiomSpeakNameBtn.onclick = () => speakText(item.name || "");
  refs.idiomSpeakStoryBtn.onclick = () =>
    speakText(`${item.name || "成语故事"}。${item.meaning || ""}。${item.story || ""}`);

  refs.idiomStoryModal.classList.remove("hidden");
  refs.idiomStoryModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function updateWorksheetLink(chars) {
  const text = chars.join("");
  if (!text) {
    refs.worksheetLink.href = "./worksheet.html";
    if (refs.calendarLink) {
      refs.calendarLink.href = "./calendar.html";
    }
    refreshWorksheetCartTip();
    return;
  }
  refs.worksheetLink.href = `./worksheet.html?chars=${encodeURIComponent(text.slice(0, 60))}`;
  if (refs.calendarLink) {
    refs.calendarLink.href = `./calendar.html?chars=${encodeURIComponent(text.slice(0, 120))}`;
  }
  refreshWorksheetCartTip();
}

function renderCharList(list) {
  refs.charList.innerHTML = "";
  if (!list.length) {
    refs.charList.innerHTML = `<p class="meta">当前筛选维度暂无直接匹配，可调整年龄段或级别后再试。</p>`;
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.dataset.char = item.char;
    card.className = `char-card${item.char === state.selectedChar ? " active" : ""}`;

    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.alt = `${item.char} 象形图案`;
    thumb.loading = "lazy";
    setImageWithFallback(thumb, item.pictograph?.image, item.char);

    const charNode = document.createElement("div");
    charNode.className = "char";
    charNode.innerHTML = state.showPinyin
      ? buildRubyHtml(item.char, item.pinyin)
      : escapeHtml(item.char);

    const mini = document.createElement("div");
    mini.className = "mini";
    mini.textContent = item.pinyin;

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "tiny-audio-btn";
    speakBtn.textContent = "朗读";
    speakBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      speakText(item.char);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tiny-add-btn";
    addBtn.textContent = "入帖";
    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      addCharsToWorksheet(item.char, "practice_char_card");
    });

    const miniRow = document.createElement("div");
    miniRow.className = "mini-row";
    miniRow.appendChild(mini);
    miniRow.appendChild(speakBtn);
    miniRow.appendChild(addBtn);

    const badges = getCharProgressBadges(item.char);
    let badgeRow = null;
    if (badges.length) {
      badgeRow = document.createElement("div");
      badgeRow.className = "progress-badges";
      badges.forEach((badge) => {
        const node = document.createElement("span");
        node.className = `progress-badge ${badge.type}`;
        node.textContent = badge.text;
        badgeRow.appendChild(node);
      });
    }

    card.appendChild(thumb);
    card.appendChild(charNode);
    card.appendChild(miniRow);
    if (badgeRow) {
      card.appendChild(badgeRow);
    }
    card.addEventListener("click", () => selectChar(item.char));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectChar(item.char);
      }
    });
    refs.charList.appendChild(card);
  });
}

function updateActiveCard() {
  refs.charList.querySelectorAll(".char-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.char === state.selectedChar);
  });
}

function setStrokeMeta(text) {
  refs.strokeMeta.textContent = text;
}

function renderWords(words, targetChar, targetPinyin) {
  refs.wordList.innerHTML = "";
  if (!words.length) {
    refs.wordList.innerHTML = "<li>暂无词组</li>";
    return;
  }
  words.forEach((item) => {
    const li = document.createElement("li");
    const wordNode = document.createElement("span");
    wordNode.className = "word annotated-text";
    wordNode.innerHTML = annotateByTarget(
      item.word,
      targetChar,
      targetPinyin
    );

    const meaningNode = document.createElement("span");
    meaningNode.textContent = `：${item.meaning}`;

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "inline-audio-btn";
    speakBtn.textContent = "朗读";
    speakBtn.addEventListener("click", () => speakText(item.word));

    li.appendChild(wordNode);
    li.appendChild(meaningNode);
    li.appendChild(speakBtn);
    refs.wordList.appendChild(li);
  });
}

function renderPictograph(item) {
  const pictograph = item.pictograph || {};
  refs.pictographScript.textContent = pictograph.script || "字形图";
  refs.pictographNote.textContent =
    pictograph.note || "图案用于辅助理解字源和形义关联。";
  refs.pictographImage.alt = `${item.char} ${pictograph.script || "字形"}图案`;
  setImageWithFallback(refs.pictographImage, pictograph.image, item.char);

  if (pictograph.source) {
    refs.pictographSource.href = pictograph.source;
    refs.pictographSource.classList.remove("hidden");
  } else {
    refs.pictographSource.href = "#";
    refs.pictographSource.classList.add("hidden");
  }
}

function renderIdioms(idioms, targetChar, targetPinyin) {
  refs.idiomList.innerHTML = "";
  if (!idioms.length) {
    refs.idiomList.innerHTML = `<p class="empty">该字暂无收录成语故事，可继续选择其他汉字。</p>`;
    return;
  }
  idioms.forEach((item) => {
    const article = document.createElement("article");
    article.className = "idiom";

    const head = document.createElement("div");
    head.className = "idiom-head";

    const title = document.createElement("h3");
    title.className = "annotated-text";
    title.innerHTML = annotateByTarget(item.name, targetChar, targetPinyin);

    const actions = document.createElement("div");
    actions.className = "idiom-actions";

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "inline-audio-btn";
    speakBtn.textContent = "朗读";
    speakBtn.addEventListener("click", () => speakText(item.name));

    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "inline-audio-btn";
    detailBtn.textContent = "详情";
    detailBtn.addEventListener("click", () => openIdiomStoryModal(item, targetChar));

    const meaning = document.createElement("p");
    meaning.textContent = `释义：${item.meaning}`;

    const story = document.createElement("p");
    story.className = "story";
    const preview = String(item.story || "").slice(0, 58);
    story.textContent = `故事：${preview}${String(item.story || "").length > 58 ? "..." : ""}`;

    actions.appendChild(speakBtn);
    actions.appendChild(detailBtn);

    head.appendChild(title);
    head.appendChild(actions);
    article.appendChild(head);
    article.appendChild(meaning);
    article.appendChild(story);
    refs.idiomList.appendChild(article);
  });
}

function renderStrokeOrder(strokes) {
  refs.strokeOrderList.innerHTML = "";
  if (!Array.isArray(strokes) || !strokes.length) {
    setStrokeMeta("暂未获取到笔画顺序数据。");
    return;
  }
  strokes.forEach((strokePath, index) => {
    const li = document.createElement("li");
    const preview = document.createElement("span");
    preview.className = "stroke-preview";
    preview.innerHTML = `
      <svg viewBox="0 0 1024 1024" aria-hidden="true">
        <path d="${escapeHtml(strokePath)}" fill="#0f172a"></path>
      </svg>
    `;
    const label = document.createElement("span");
    label.textContent = `第 ${index + 1} 笔`;
    li.appendChild(preview);
    li.appendChild(label);
    refs.strokeOrderList.appendChild(li);
  });
}

async function loadStrokeData(char) {
  const reqId = ++state.strokeReqId;
  setStrokeMeta("正在加载笔画顺序...");
  refs.strokeOrderList.innerHTML = "";

  const urls = [
    `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(char)}.json`,
    `https://unpkg.com/hanzi-writer-data@latest/${encodeURIComponent(char)}.json`,
  ];

  let payload = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        continue;
      }
      payload = await res.json();
      break;
    } catch (error) {
      // Continue fallback endpoint.
    }
  }

  if (reqId !== state.strokeReqId) {
    return;
  }

  if (!payload?.strokes?.length) {
    setStrokeMeta("该字暂无可用笔画数据。");
    return;
  }
  setStrokeMeta(`共 ${payload.strokes.length} 笔，建议按顺序临摹。`);
  renderStrokeOrder(payload.strokes);
}

async function createWriter(char) {
  refs.writerTarget.innerHTML = "";
  const ready = await ensureHanziWriterReady();
  if (!ready || typeof window.HanziWriter === "undefined") {
    setStrokeMeta("笔顺库加载失败，请刷新页面。");
    state.writer = null;
    return;
  }

  try {
    state.writer = window.HanziWriter.create("writerTarget", char, {
      width: 260,
      height: 260,
      padding: 8,
      strokeColor: "#0f172a",
      radicalColor: "#0ea5e9",
      outlineColor: "#94a3b8",
      delayBetweenStrokes: 220,
    });
  } catch (error) {
    state.writer = null;
    setStrokeMeta("该字暂不支持笔顺动画展示。");
  }
}

function renderDetailText(item) {
  refs.detailChar.innerHTML = state.showPinyin
    ? buildRubyHtml(item.char, item.pinyin)
    : escapeHtml(item.char);
  refs.detailPinyin.textContent = `拼音：${item.pinyin}`;
  refs.detailMeaning.textContent = item.meaning;
  resetFollowPanel(item);
  renderPictograph(item);
  renderWords(item.words || [], item.char, item.pinyin);
  renderIdioms(item.idioms || [], item.char, item.pinyin);
}

function renderCharDetail(item) {
  renderDetailText(item);
  createWriter(item.char);
  loadStrokeData(item.char);
}

function selectChar(char) {
  stopFollowReading();
  closeIdiomStoryModal();
  state.selectedChar = char;
  state.loopMode = false;
  refs.loopBtn.textContent = "循环：关";
  updateActiveCard();
  const item = state.filtered.find((entry) => entry.char === char);
  if (!item) {
    return;
  }
  renderCharDetail(item);
}

function filterLibrary() {
  const age = refs.ageSelect.value;
  const level = refs.levelSelect.value;
  const exact = state.library.filter(
    (item) => item.ages.includes(age) && item.levels.includes(level)
  );

  let result = exact;
  if (!result.length) {
    result = state.library.filter(
      (item) => item.ages.includes(age) || item.levels.includes(level)
    );
    refs.resultMeta.textContent = `未找到完全匹配项，已为你推荐 ${result.length} 个相近难度汉字（${state.bankSourceLabel}）。`;
  } else {
    refs.resultMeta.textContent = `共匹配到 ${result.length} 个汉字，点击卡片开始学习（${state.bankSourceLabel}）。`;
  }

  state.filtered = result;
  updateWorksheetLink(result.map((item) => item.char));
  renderCharList(result);

  if (!result.length) {
    stopFollowReading();
    state.selectedChar = "";
    refs.detailChar.textContent = "-";
    refs.detailPinyin.textContent = "-";
    refs.detailMeaning.textContent = "当前维度暂无汉字，请调整筛选条件。";
    if (refs.followStatus) {
      refs.followStatus.textContent = "请选择汉字后进行跟读练习。";
    }
    if (refs.followResult) {
      refs.followResult.textContent = "识别结果：-";
    }
    setFollowCompareLine("warn", "对比结果：等待选择练习汉字。");
    refs.pictographScript.textContent = "-";
    refs.pictographNote.textContent = "请选择汉字后查看对应象形图案。";
    refs.pictographSource.href = "#";
    refs.pictographSource.classList.add("hidden");
    setImageWithFallback(refs.pictographImage, "", "字");
    refs.wordList.innerHTML = "<li>暂无词组</li>";
    refs.idiomList.innerHTML = `<p class="empty">暂无成语故事。</p>`;
    refs.writerTarget.innerHTML = "";
    refs.strokeOrderList.innerHTML = "";
    setStrokeMeta("点击汉字卡片后可查看笔顺。");
    return;
  }

  const prefer = result.find((item) => item.char === state.selectedChar) || result[0];
  const queryPreferred = state.queryChar ? result.find((item) => item.char === state.queryChar) : null;
  if (queryPreferred) {
    state.queryChar = "";
    selectChar(queryPreferred.char);
    return;
  }
  selectChar(prefer.char);
}

function bindEvents() {
  refs.generateBtn.addEventListener("click", filterLibrary);
  refs.speakCurrentBtn?.addEventListener("click", () => {
    if (state.selectedChar) {
      speakText(state.selectedChar);
    }
  });
  refs.addToWorksheetBtn?.addEventListener("click", () => {
    if (!state.selectedChar) {
      return;
    }
    addCharsToWorksheet(state.selectedChar, "practice_current_char");
  });
  refs.markLearnedBtn?.addEventListener("click", () => {
    if (!state.selectedChar) {
      return;
    }
    markSelectedCharProgress("learned", {
      source: "practice_manual",
      reason: "manual_mark_learned",
      clearReview: true,
    });
  });
  refs.markReviewBtn?.addEventListener("click", () => {
    if (!state.selectedChar) {
      return;
    }
    markSelectedCharProgress("review", {
      source: "practice_manual",
      reason: "manual_mark_review",
    });
  });
  refs.markWrongBtn?.addEventListener("click", () => {
    if (!state.selectedChar) {
      return;
    }
    markSelectedCharProgress("wrong", {
      source: "practice_manual",
      reason: "manual_mark_wrong",
    });
    markSelectedCharProgress("review", {
      source: "practice_manual",
      reason: "manual_mark_wrong",
    });
  });
  refs.clearProgressBtn?.addEventListener("click", () => {
    if (!store || typeof store.clearPracticeProgress !== "function") {
      return;
    }
    const ok = window.confirm("确认清空本地学习进度（已学/复习/错题字）吗？");
    if (!ok) {
      return;
    }
    store.clearPracticeProgress();
    refreshProgressPanel();
    renderCharList(state.filtered);
    updateActiveCard();
  });
  refs.followStartBtn?.addEventListener("click", startFollowReading);
  refs.followStopBtn?.addEventListener("click", stopFollowReading);
  refs.pinyinToggle?.addEventListener("change", () => {
    state.showPinyin = refs.pinyinToggle.checked;
    renderCharList(state.filtered);
    updateActiveCard();
    const item = state.filtered.find((entry) => entry.char === state.selectedChar);
    if (item) {
      renderDetailText(item);
    }
  });
  refs.animateBtn.addEventListener("click", () => {
    if (!state.writer) {
      return;
    }
    state.loopMode = false;
    refs.loopBtn.textContent = "循环：关";
    if (typeof state.writer.animateCharacter === "function") {
      state.writer.animateCharacter();
    }
  });
  refs.loopBtn.addEventListener("click", () => {
    if (!state.writer) {
      return;
    }
    state.loopMode = !state.loopMode;
    refs.loopBtn.textContent = `循环：${state.loopMode ? "开" : "关"}`;
    if (state.loopMode && typeof state.writer.loopCharacterAnimation === "function") {
      state.writer.loopCharacterAnimation();
      return;
    }
    createWriter(state.selectedChar);
  });
  refs.idiomStoryCloseBtn?.addEventListener("click", closeIdiomStoryModal);
  refs.idiomStoryModal?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.closeIdiomModal !== undefined) {
      closeIdiomStoryModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && refs.idiomStoryModal && !refs.idiomStoryModal.classList.contains("hidden")) {
      closeIdiomStoryModal();
    }
  });
}

function initSelectByQuery() {
  const params = new URLSearchParams(window.location.search);
  const age = params.get("age");
  const level = params.get("level");
  const char = params.get("char");
  if (age && state.dimensions.ageGroups.some((item) => item.value === age)) {
    refs.ageSelect.value = age;
  }
  if (level && state.dimensions.chineseLevels.some((item) => item.value === level)) {
    refs.levelSelect.value = level;
  }
  if (char && state.library.some((item) => item.char === char)) {
    state.queryChar = char;
  }
}

async function bootstrap() {
  refreshSpeechVoice();
  if ("speechSynthesis" in window && typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", refreshSpeechVoice);
  }
  setupFollowReading();
  refs.resultMeta.textContent = "正在加载分级题库...";
  await initQuestionBank();
  fillSelect(refs.ageSelect, state.dimensions.ageGroups);
  fillSelect(refs.levelSelect, state.dimensions.chineseLevels);
  if (!state.dimensions.ageGroups.length || !state.dimensions.chineseLevels.length) {
    refs.resultMeta.textContent = "字库维度配置异常，请检查数据文件。";
    return;
  }
  refs.ageSelect.value = "9-12";
  refs.levelSelect.value = "HSK2";
  state.showPinyin = refs.pinyinToggle ? refs.pinyinToggle.checked : true;
  initSelectByQuery();
  refreshWorksheetCartTip();
  refreshProgressPanel();
  bindEvents();
  filterLibrary();
}

bootstrap().catch(() => {
  refs.resultMeta.textContent = "题库加载失败，请稍后刷新重试。";
});
