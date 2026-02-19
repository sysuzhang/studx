const refs = {
  ageSelect: document.getElementById("ageSelect"),
  levelSelect: document.getElementById("levelSelect"),
  pinyinToggle: document.getElementById("pinyinToggle"),
  generateBtn: document.getElementById("generateBtn"),
  calendarLink: document.getElementById("calendarLink"),
  worksheetLink: document.getElementById("worksheetLink"),
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
};

const state = {
  filtered: [],
  selectedChar: "",
  queryChar: "",
  writer: null,
  loopMode: false,
  strokeReqId: 0,
  showPinyin: true,
};

const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const dimensions = window.LEARNING_DIMENSIONS || { ageGroups: [], chineseLevels: [] };
const speechState = { voice: null };
const store = window.LearningStore;
const followState = {
  supported: false,
  listening: false,
  recognition: null,
};
const charPinyinMap = new Map(library.map((item) => [item.char, item.pinyin]));
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

let hanRegex;
try {
  hanRegex = /\p{Script=Han}/u;
} catch (error) {
  hanRegex = /[\u3400-\u9fff\uf900-\ufaff]/;
}

function fillSelect(selectNode, options) {
  selectNode.innerHTML = "";
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    selectNode.appendChild(option);
  });
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

    card.appendChild(thumb);
    card.appendChild(charNode);
    card.appendChild(miniRow);
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

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "inline-audio-btn";
    speakBtn.textContent = "朗读";
    speakBtn.addEventListener("click", () => speakText(item.name));

    const meaning = document.createElement("p");
    meaning.textContent = `释义：${item.meaning}`;

    const story = document.createElement("p");
    story.className = "story";
    story.textContent = `故事：${item.story}`;

    head.appendChild(title);
    head.appendChild(speakBtn);
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
  strokes.forEach((_, index) => {
    const li = document.createElement("li");
    li.textContent = `第 ${index + 1} 笔`;
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

function createWriter(char) {
  refs.writerTarget.innerHTML = "";
  if (typeof HanziWriter === "undefined") {
    setStrokeMeta("笔顺库加载失败，请刷新页面。");
    state.writer = null;
    return;
  }

  try {
    state.writer = HanziWriter.create("writerTarget", char, {
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
  const exact = library.filter(
    (item) => item.ages.includes(age) && item.levels.includes(level)
  );

  let result = exact;
  if (!result.length) {
    result = library.filter(
      (item) => item.ages.includes(age) || item.levels.includes(level)
    );
    refs.resultMeta.textContent = `未找到完全匹配项，已为你推荐 ${result.length} 个相近难度汉字。`;
  } else {
    refs.resultMeta.textContent = `共匹配到 ${result.length} 个汉字，点击卡片开始学习。`;
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
}

function initSelectByQuery() {
  const params = new URLSearchParams(window.location.search);
  const age = params.get("age");
  const level = params.get("level");
  const char = params.get("char");
  if (age && dimensions.ageGroups.some((item) => item.value === age)) {
    refs.ageSelect.value = age;
  }
  if (level && dimensions.chineseLevels.some((item) => item.value === level)) {
    refs.levelSelect.value = level;
  }
  if (char && library.some((item) => item.char === char)) {
    state.queryChar = char;
  }
}

function bootstrap() {
  refreshSpeechVoice();
  if ("speechSynthesis" in window && typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", refreshSpeechVoice);
  }
  setupFollowReading();
  fillSelect(refs.ageSelect, dimensions.ageGroups);
  fillSelect(refs.levelSelect, dimensions.chineseLevels);
  if (!dimensions.ageGroups.length || !dimensions.chineseLevels.length) {
    refs.resultMeta.textContent = "字库维度配置异常，请检查数据文件。";
    return;
  }
  refs.ageSelect.value = "9-12";
  refs.levelSelect.value = "HSK2";
  state.showPinyin = refs.pinyinToggle ? refs.pinyinToggle.checked : true;
  initSelectByQuery();
  refreshWorksheetCartTip();
  bindEvents();
  filterLibrary();
}

bootstrap();
