const refs = {
  ageSelect: document.getElementById("ageSelect"),
  levelSelect: document.getElementById("levelSelect"),
  generateBtn: document.getElementById("generateBtn"),
  worksheetLink: document.getElementById("worksheetLink"),
  resultMeta: document.getElementById("resultMeta"),
  charList: document.getElementById("charList"),
  detailChar: document.getElementById("detailChar"),
  detailPinyin: document.getElementById("detailPinyin"),
  detailMeaning: document.getElementById("detailMeaning"),
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
  writer: null,
  loopMode: false,
  strokeReqId: 0,
};

const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const dimensions = window.LEARNING_DIMENSIONS || { ageGroups: [], chineseLevels: [] };

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
    return;
  }
  refs.worksheetLink.href = `./worksheet.html?chars=${encodeURIComponent(text.slice(0, 60))}`;
}

function renderCharList(list) {
  refs.charList.innerHTML = "";
  if (!list.length) {
    refs.charList.innerHTML = `<p class="meta">当前筛选维度暂无直接匹配，可调整年龄段或级别后再试。</p>`;
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `char-card${item.char === state.selectedChar ? " active" : ""}`;

    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.alt = `${item.char} 象形图案`;
    thumb.loading = "lazy";
    setImageWithFallback(thumb, item.pictograph?.image, item.char);

    const charNode = document.createElement("div");
    charNode.className = "char";
    charNode.textContent = item.char;

    const mini = document.createElement("div");
    mini.className = "mini";
    mini.textContent = item.pinyin;

    card.appendChild(thumb);
    card.appendChild(charNode);
    card.appendChild(mini);
    card.addEventListener("click", () => selectChar(item.char));
    refs.charList.appendChild(card);
  });
}

function updateActiveCard() {
  refs.charList.querySelectorAll(".char-card").forEach((card) => {
    const text = card.querySelector(".char")?.textContent;
    card.classList.toggle("active", text === state.selectedChar);
  });
}

function setStrokeMeta(text) {
  refs.strokeMeta.textContent = text;
}

function renderWords(words) {
  refs.wordList.innerHTML = "";
  if (!words.length) {
    refs.wordList.innerHTML = "<li>暂无词组</li>";
    return;
  }
  words.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="word">${escapeHtml(item.word)}</span>：${escapeHtml(item.meaning)}`;
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

function renderIdioms(idioms) {
  refs.idiomList.innerHTML = "";
  if (!idioms.length) {
    refs.idiomList.innerHTML = `<p class="empty">该字暂无收录成语故事，可继续选择其他汉字。</p>`;
    return;
  }
  idioms.forEach((item) => {
    const article = document.createElement("article");
    article.className = "idiom";
    article.innerHTML = `
      <h3>${escapeHtml(item.name)}</h3>
      <p>释义：${escapeHtml(item.meaning)}</p>
      <p class="story">故事：${escapeHtml(item.story)}</p>
    `;
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

function renderCharDetail(item) {
  refs.detailChar.textContent = item.char;
  refs.detailPinyin.textContent = item.pinyin;
  refs.detailMeaning.textContent = item.meaning;
  renderPictograph(item);
  renderWords(item.words || []);
  renderIdioms(item.idioms || []);
  createWriter(item.char);
  loadStrokeData(item.char);
}

function selectChar(char) {
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
    state.selectedChar = "";
    refs.detailChar.textContent = "-";
    refs.detailPinyin.textContent = "-";
    refs.detailMeaning.textContent = "当前维度暂无汉字，请调整筛选条件。";
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
  selectChar(prefer.char);
}

function bindEvents() {
  refs.generateBtn.addEventListener("click", filterLibrary);
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
  if (age && dimensions.ageGroups.some((item) => item.value === age)) {
    refs.ageSelect.value = age;
  }
  if (level && dimensions.chineseLevels.some((item) => item.value === level)) {
    refs.levelSelect.value = level;
  }
}

function bootstrap() {
  fillSelect(refs.ageSelect, dimensions.ageGroups);
  fillSelect(refs.levelSelect, dimensions.chineseLevels);
  if (!dimensions.ageGroups.length || !dimensions.chineseLevels.length) {
    refs.resultMeta.textContent = "字库维度配置异常，请检查数据文件。";
    return;
  }
  refs.ageSelect.value = "9-12";
  refs.levelSelect.value = "HSK2";
  initSelectByQuery();
  bindEvents();
  filterLibrary();
}

bootstrap();
