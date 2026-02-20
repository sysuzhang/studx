const refs = {
  searchInput: document.getElementById("searchInput"),
  ageFilter: document.getElementById("ageFilter"),
  levelFilter: document.getElementById("levelFilter"),
  sortBy: document.getElementById("sortBy"),
  withIdiomOnly: document.getElementById("withIdiomOnly"),
  withPictographOnly: document.getElementById("withPictographOnly"),
  showLearnedOnly: document.getElementById("showLearnedOnly"),
  statsGrid: document.getElementById("statsGrid"),
  tableMeta: document.getElementById("tableMeta"),
  tableBody: document.getElementById("tableBody"),
  detailBox: document.getElementById("detailBox"),
  openDictBtn: document.getElementById("openDictBtn"),
  openDictNavLink: document.getElementById("openDictNavLink"),
  dictDrawerMask: document.getElementById("dictDrawerMask"),
  dictDrawerPanel: document.getElementById("dictDrawerPanel"),
  closeDictBtn: document.getElementById("closeDictBtn"),
  dictSearchInput: document.getElementById("dictSearchInput"),
  dictSearchBtn: document.getElementById("dictSearchBtn"),
  dictSuggestList: document.getElementById("dictSuggestList"),
  dictDetailBox: document.getElementById("dictDetailBox"),
};

const STORAGE_KEY = "studyCalendarCompletionV1";
const store = window.LearningStore;

const state = {
  library: Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [],
  filtered: [],
  learnedChars: new Set(),
  selectedChar: "",
  dictionaryEntries: Array.isArray(window.XINHUA_DICTIONARY) ? window.XINHUA_DICTIONARY : [],
  dictionaryMap: new Map(),
  drawerOpen: false,
  selectedPronunciationByChar: {},
  pendingOpenDict: false,
  pendingDictChar: "",
};

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

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getEntryPronunciations(entry) {
  const fromData = toArray(entry?.pronunciations)
    .map((item) => {
      const meanings = toArray(item?.meanings).filter(Boolean);
      return {
        pinyin: String(item?.pinyin || "").trim(),
        tag: String(item?.tag || "").trim(),
        meanings: meanings.length ? meanings : toArray(entry?.meanings).filter(Boolean),
        words: toArray(item?.words),
        idioms: toArray(item?.idioms),
        examples: toArray(item?.examples),
      };
    })
    .filter((item) => item.pinyin || item.meanings.length || item.words.length || item.idioms.length);
  if (fromData.length) {
    return fromData;
  }
  return [
    {
      pinyin: String(entry?.pinyin || "").trim(),
      tag: "",
      meanings: toArray(entry?.meanings).filter(Boolean),
      words: toArray(entry?.words),
      idioms: toArray(entry?.idioms),
      examples: toArray(entry?.examples),
    },
  ];
}

function getEntryPinyinDisplay(entry) {
  const unique = [...new Set(getEntryPronunciations(entry).map((item) => item.pinyin).filter(Boolean))];
  return unique.join(" / ") || String(entry?.pinyin || "");
}

function fillSelect(selectNode, options, allLabel) {
  selectNode.innerHTML = `<option value="">${allLabel}</option>`;
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    selectNode.appendChild(option);
  });
}

function loadLearnedChars() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const chars = Object.keys(parsed)
      .filter((key) => parsed[key])
      .map((key) => String(key).split("|")[1])
      .filter(Boolean);
    state.learnedChars = new Set(chars);
  } catch (error) {
    state.learnedChars = new Set();
  }
}

function isLearnedChar(char) {
  return state.learnedChars.has(char);
}

function addCharToWorksheet(char, source) {
  if (!store || typeof store.addWorksheetChars !== "function") {
    return;
  }
  store.addWorksheetChars(char, source || "overview");
}

function speakText(text) {
  const content = String(text || "").trim();
  if (!content || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = "zh-CN";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function initDictionaryMap() {
  state.dictionaryMap = new Map(
    state.dictionaryEntries
      .filter((entry) => entry && typeof entry === "object" && entry.char)
      .map((entry) => [entry.char, entry])
  );
}

function getDictionaryEntry(char) {
  const key = String(char || "").trim();
  if (!key) {
    return null;
  }
  return state.dictionaryMap.get(key) || null;
}

function dictionaryFallbackEntry(char) {
  const item = state.library.find((entry) => entry.char === char);
  if (!item) {
    return null;
  }
  return {
    char: item.char,
    pinyin: item.pinyin || "",
    radical: "未标注",
    strokes: "-",
    structure: "未标注",
    variant: "",
    levels: item.levels || [],
    meanings: [item.meaning || "暂无释义"],
    words: item.words || [],
    idioms: item.idioms || [],
    examples: [],
    pictograph: item.pictograph || null,
  };
}

function logDictionaryLookup(char) {
  if (!store || typeof store.logActivity !== "function") {
    return;
  }
  store.logActivity("dictionary_lookup", { char, source: "overview_drawer" });
}

function dictionaryDetailHtml(entry, pronunciationIndex) {
  const pronunciations = getEntryPronunciations(entry);
  const safeIndex = Math.max(0, Math.min(pronunciations.length - 1, pronunciationIndex || 0));
  const activePronunciation = pronunciations[safeIndex] || pronunciations[0];
  const words = toArray(activePronunciation?.words).length ? toArray(activePronunciation?.words) : toArray(entry.words);
  const idioms = toArray(activePronunciation?.idioms).length ? toArray(activePronunciation?.idioms) : toArray(entry.idioms);
  const examples = toArray(activePronunciation?.examples).length
    ? toArray(activePronunciation?.examples)
    : toArray(entry.examples);
  const pronTabs =
    pronunciations.length > 1
      ? `
      <div class="detail-sub">
        <h3>多音字切换</h3>
        <div>${pronunciations
          .map((item, index) => {
            const activeClass = index === safeIndex ? " active" : "";
            const tagText = item.tag ? `（${item.tag}）` : "";
            return `<button type="button" class="ghost-btn dict-pron-tab${activeClass}" data-pron-index="${index}">${escapeHtml(
              item.pinyin || "-"
            )}${escapeHtml(tagText)}</button>`;
          })
          .join("")}</div>
      </div>
    `
      : "";
  const wordHtml = words.length
    ? `<ul>${words
        .slice(0, 8)
        .map((row) => `<li><strong>${escapeHtml(row.word || "")}</strong>：${escapeHtml(row.meaning || "")}</li>`)
        .join("")}</ul>`
    : `<p class="empty">暂无词组。</p>`;
  const idiomHtml = idioms.length
    ? `<ul>${idioms
        .slice(0, 6)
        .map((row) => `<li><strong>${escapeHtml(row.name || "")}</strong>：${escapeHtml(row.meaning || "")}</li>`)
        .join("")}</ul>`
    : `<p class="empty">暂无成语。</p>`;
  const exampleHtml = examples.length
    ? `<ul>${examples.slice(0, 4).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : `<p class="empty">暂无例句。</p>`;
  const picHtml = entry.pictograph?.image
    ? `
      <div class="pictograph-wrap">
        <img src="${escapeHtml(entry.pictograph.image)}" alt="${escapeHtml(entry.char)} 象形图" loading="lazy" />
        <div>
          <p>${escapeHtml(entry.pictograph.script || "字形图")}：${escapeHtml(entry.pictograph.note || "用于辅助字源理解。")}</p>
          ${
            entry.pictograph.source
              ? `<a href="${escapeHtml(entry.pictograph.source)}" target="_blank" rel="noopener noreferrer">查看来源</a>`
              : ""
          }
        </div>
      </div>
    `
    : `<p class="empty">暂无象形图。</p>`;
  return `
    <div class="dict-char-head">
      <span class="dict-char">${escapeHtml(entry.char)}</span>
      <div>
        <p class="detail-pinyin">${escapeHtml(activePronunciation?.pinyin || entry.pinyin || "-")}</p>
        <p class="detail-meaning">部首：${escapeHtml(entry.radical || "未标注")} · 笔画：${escapeHtml(entry.strokes || "-")} · 结构：${escapeHtml(
    entry.structure || "未标注"
  )}</p>
        <p class="detail-meaning">级别：${escapeHtml(levelText(entry.levels))}</p>
      </div>
    </div>
    <div class="detail-sub">
      <h3>基本释义</h3>
      <ul>${toArray(activePronunciation?.meanings || entry.meanings || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </div>
    ${pronTabs}
    <div class="detail-sub">
      <h3>常用词组</h3>
      ${wordHtml}
    </div>
    <div class="detail-sub">
      <h3>关联成语</h3>
      ${idiomHtml}
    </div>
    <div class="detail-sub">
      <h3>例句参考</h3>
      ${exampleHtml}
    </div>
    <div class="detail-sub">
      <h3>象形图参考</h3>
      ${picHtml}
    </div>
    <div class="detail-sub">
      <button id="dictSpeakBtn" type="button" class="ghost-btn">朗读汉字</button>
      <button id="dictAddCartBtn" type="button" class="ghost-btn">加入字帖</button>
    </div>
  `;
}

function renderDictionarySuggestions(keyword) {
  if (!refs.dictSuggestList) {
    return;
  }
  const q = String(keyword || "").trim();
  const source = q
    ? state.dictionaryEntries.filter((entry) => String(entry?.char || "").includes(q)).slice(0, 12)
    : state.dictionaryEntries.slice(0, 18);
  if (!source.length) {
    refs.dictSuggestList.innerHTML = `<span class="meta">暂无匹配词条。</span>`;
    return;
  }
  refs.dictSuggestList.innerHTML = source
    .map((entry) => `<button type="button" class="dict-chip" data-dict-char="${escapeHtml(entry.char)}">${escapeHtml(entry.char)}</button>`)
    .join("");
}

function renderDictionaryDetailByChar(char, options) {
  if (!refs.dictDetailBox) {
    return;
  }
  const key = String(char || "").trim();
  const opts = options && typeof options === "object" ? options : {};
  if (!key) {
    refs.dictDetailBox.innerHTML = `<p class="empty">请输入一个汉字，或点击上方词条查看字典详情。</p>`;
    return;
  }
  const entry = getDictionaryEntry(key) || dictionaryFallbackEntry(key);
  if (!entry) {
    refs.dictDetailBox.innerHTML = `<p class="empty">未找到“${escapeHtml(key)}”的词条。</p>`;
    return;
  }
  const fromOption = Number.isFinite(opts.pronunciationIndex) ? Math.floor(opts.pronunciationIndex) : NaN;
  const fromMemory = Number.isFinite(state.selectedPronunciationByChar[key]) ? state.selectedPronunciationByChar[key] : 0;
  const targetIndex = Number.isFinite(fromOption) ? fromOption : fromMemory;
  state.selectedPronunciationByChar[key] = targetIndex;
  refs.dictDetailBox.innerHTML = dictionaryDetailHtml(entry, targetIndex);
  refs.dictDetailBox.querySelectorAll("[data-pron-index]").forEach((node) => {
    node.addEventListener("click", () => {
      const idx = Number.parseInt(node.dataset.pronIndex, 10);
      renderDictionaryDetailByChar(key, { pronunciationIndex: Number.isFinite(idx) ? idx : 0, silentLog: true });
    });
  });
  document.getElementById("dictSpeakBtn")?.addEventListener("click", () => speakText(key));
  document.getElementById("dictAddCartBtn")?.addEventListener("click", () => {
    addCharToWorksheet(key, "overview_dict_drawer");
    renderStats();
  });
  if (refs.dictSearchInput) {
    refs.dictSearchInput.value = key;
  }
  if (!opts.silentLog) {
    logDictionaryLookup(key);
  }
}

function getDefaultDictionaryChar() {
  const fromDict = state.dictionaryEntries.find((entry) => entry?.char)?.char;
  if (fromDict) {
    return String(fromDict);
  }
  const fromLibrary = state.library.find((entry) => entry?.char)?.char;
  return fromLibrary ? String(fromLibrary) : "";
}

function openDictionaryDrawer(char, options) {
  if (!refs.dictDrawerMask) {
    return;
  }
  state.drawerOpen = true;
  refs.dictDrawerMask.classList.add("open");
  refs.dictDrawerMask.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const targetChar = String(char || "").trim() || state.selectedChar || getDefaultDictionaryChar();
  renderDictionarySuggestions(targetChar);
  renderDictionaryDetailByChar(targetChar, options);
}

function closeDictionaryDrawer() {
  if (!refs.dictDrawerMask) {
    return;
  }
  state.drawerOpen = false;
  refs.dictDrawerMask.classList.remove("open");
  refs.dictDrawerMask.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function cardStat(label, value, extraClass = "") {
  return `
    <article class="stat">
      <p class="label">${escapeHtml(label)}</p>
      <p class="value ${extraClass}">${escapeHtml(value)}</p>
    </article>
  `;
}

function renderStats() {
  const total = state.library.length;
  const visible = state.filtered.length;
  const withWord = state.library.filter((item) => (item.words || []).length > 0).length;
  const withIdiom = state.library.filter((item) => (item.idioms || []).length > 0).length;
  const withPic = state.library.filter((item) => Boolean(item.pictograph?.image)).length;
  const learned = [...new Set(state.library.map((item) => item.char).filter((char) => isLearnedChar(char)))].length;
  const cart = store && typeof store.getWorksheetCart === "function" ? store.getWorksheetCart().length : 0;

  refs.statsGrid.innerHTML =
    cardStat("字库总汉字", total) +
    cardStat("当前筛选结果", visible) +
    cardStat("有词组汉字", withWord) +
    cardStat("有成语汉字", withIdiom) +
    cardStat("有象形图汉字", withPic) +
    cardStat("学习日历已打卡", learned, "status-done") +
    cardStat("字帖收藏汉字", cart);
}

function levelPills(levels) {
  return (levels || []).map((level) => `<span class="pill">${escapeHtml(level)}</span>`).join("");
}

function agePills(ages) {
  return (ages || []).map((age) => `<span class="pill">${escapeHtml(age)}</span>`).join("");
}

function detailHtml(item) {
  const words = item.words || [];
  const idioms = item.idioms || [];
  const pic = item.pictograph || null;
  const learned = isLearnedChar(item.char) ? "已打卡" : "未打卡";

  return `
    <div class="detail-main">
      <span class="detail-char">${escapeHtml(item.char)}</span>
      <div>
        <p class="detail-pinyin">${escapeHtml(item.pinyin)}</p>
        <p class="detail-meaning">${escapeHtml(item.meaning)}</p>
        <p class="detail-meaning">学习状态：${escapeHtml(learned)}</p>
      </div>
    </div>

    <div class="detail-sub">
      <h3>适配级别</h3>
      <div>${levelPills(item.levels)}</div>
      <h3>适配年龄</h3>
      <div>${agePills(item.ages)}</div>
    </div>

    <div class="detail-sub">
      <h3>常用词组（${words.length}）</h3>
      ${
        words.length
          ? `<ul>${words
              .map(
                (entry) =>
                  `<li><strong>${escapeHtml(entry.word)}</strong>：${escapeHtml(entry.meaning)}</li>`
              )
              .join("")}</ul>`
          : `<p class="empty">暂无词组。</p>`
      }
    </div>

    <div class="detail-sub">
      <h3>关联成语（${idioms.length}）</h3>
      ${
        idioms.length
          ? `<ul>${idioms
              .map(
                (entry) =>
                  `<li><strong>${escapeHtml(entry.name)}</strong>：${escapeHtml(entry.meaning)}</li>`
              )
              .join("")}</ul>`
          : `<p class="empty">暂无成语。</p>`
      }
    </div>

    <div class="detail-sub">
      <h3>象形图案</h3>
      ${
        pic?.image
          ? `<div class="pictograph-wrap">
              <img src="${escapeHtml(pic.image)}" alt="${escapeHtml(item.char)} 象形图" loading="lazy" />
              <div>
                <p>${escapeHtml(pic.script || "字形图")}：${escapeHtml(pic.note || "用于辅助字源理解。")}</p>
                ${
                  pic.source
                    ? `<a href="${escapeHtml(pic.source)}" target="_blank" rel="noopener noreferrer">查看来源</a>`
                    : ""
                }
              </div>
            </div>`
          : `<p class="empty">暂无象形图。</p>`
      }
    </div>

    <div class="detail-sub">
      <h3>快捷操作</h3>
      <div>
        <a class="action-link" href="./practice.html?age=${encodeURIComponent(
          item.ages?.[0] || ""
        )}&level=${encodeURIComponent(item.levels?.[0] || "")}&char=${encodeURIComponent(item.char)}">去练习</a>
        <a class="action-link" href="./calendar.html?chars=${encodeURIComponent(item.char)}">入日历</a>
        <button id="detailDictBtn" type="button" class="action-link-btn">查字典</button>
        <button id="detailAddCartBtn" type="button" class="action-link-btn">加入字帖</button>
      </div>
    </div>
  `;
}

function selectChar(char) {
  state.selectedChar = char;
  const item = state.library.find((entry) => entry.char === char);
  if (!item) {
    refs.detailBox.innerHTML = `<p class="empty">未找到该汉字详情。</p>`;
    return;
  }
  refs.detailBox.innerHTML = detailHtml(item);
  const addBtn = document.getElementById("detailAddCartBtn");
  const dictBtn = document.getElementById("detailDictBtn");
  addBtn?.addEventListener("click", () => {
    addCharToWorksheet(item.char, "overview_detail");
    renderStats();
  });
  dictBtn?.addEventListener("click", () => {
    openDictionaryDrawer(item.char);
  });
  refs.tableBody.querySelectorAll("tr").forEach((row) => {
    row.classList.toggle("active", row.dataset.char === char);
  });
}

function renderTable() {
  refs.tableBody.innerHTML = "";
  refs.tableMeta.textContent = `共 ${state.filtered.length} 个汉字`;

  if (!state.filtered.length) {
    refs.tableBody.innerHTML = `<tr><td colspan="9"><p class="empty">暂无匹配结果，请调整筛选条件。</p></td></tr>`;
    refs.detailBox.innerHTML = `<p class="empty">暂无可展示详情。</p>`;
    return;
  }

  state.filtered.forEach((item) => {
    const row = document.createElement("tr");
    row.dataset.char = item.char;
    row.innerHTML = `
      <td>
        <div class="char-cell">
          <span class="char-main">${escapeHtml(item.char)}</span>
          ${
            item.pictograph?.image
              ? `<img class="char-thumb" src="${escapeHtml(item.pictograph.image)}" alt="${escapeHtml(
                  item.char
                )} 象形图" loading="lazy" />`
              : ""
          }
        </div>
      </td>
      <td>${escapeHtml(item.pinyin)}</td>
      <td>${levelPills(item.levels)}</td>
      <td>${agePills(item.ages)}</td>
      <td>${(item.words || []).length}</td>
      <td>${(item.idioms || []).length}</td>
      <td>${item.pictograph?.image ? "有" : "无"}</td>
      <td>${isLearnedChar(item.char) ? `<span class="status-done">已打卡</span>` : "未打卡"}</td>
      <td>
        <a class="action-link" href="./practice.html?age=${encodeURIComponent(
          item.ages?.[0] || ""
        )}&level=${encodeURIComponent(item.levels?.[0] || "")}&char=${encodeURIComponent(item.char)}">练习</a>
        <a class="action-link" href="./calendar.html?chars=${encodeURIComponent(item.char)}">入日历</a>
        <a class="action-link open-dict-link" href="#" data-char="${escapeHtml(item.char)}">查字典</a>
        <a class="action-link add-cart-link" href="#">入字帖</a>
      </td>
    `;
    row.addEventListener("click", (event) => {
      if (event.target.closest(".open-dict-link")) {
        event.preventDefault();
        openDictionaryDrawer(item.char);
        return;
      }
      if (event.target.closest(".add-cart-link")) {
        event.preventDefault();
        addCharToWorksheet(item.char, "overview_table");
        renderStats();
        return;
      }
      if (event.target.closest("a")) {
        return;
      }
      selectChar(item.char);
    });
    refs.tableBody.appendChild(row);
  });

  const preferred = state.filtered.find((item) => item.char === state.selectedChar) || state.filtered[0];
  selectChar(preferred.char);
}

function applyFilters() {
  const search = refs.searchInput.value.trim().toLowerCase();
  const age = refs.ageFilter.value;
  const level = refs.levelFilter.value;
  const withIdiomOnly = refs.withIdiomOnly.checked;
  const withPictographOnly = refs.withPictographOnly.checked;
  const showLearnedOnly = refs.showLearnedOnly.checked;
  const sortBy = refs.sortBy.value;

  let list = [...state.library];

  list = list.filter((item) => {
    if (age && !item.ages?.includes(age)) {
      return false;
    }
    if (level && !item.levels?.includes(level)) {
      return false;
    }
    if (withIdiomOnly && !(item.idioms || []).length) {
      return false;
    }
    if (withPictographOnly && !item.pictograph?.image) {
      return false;
    }
    if (showLearnedOnly && !isLearnedChar(item.char)) {
      return false;
    }
    if (!search) {
      return true;
    }

    const corpus = [
      item.char,
      item.pinyin,
      item.meaning,
      ...(item.words || []).map((word) => `${word.word} ${word.meaning}`),
      ...(item.idioms || []).map((idiom) => `${idiom.name} ${idiom.meaning}`),
    ]
      .join(" ")
      .toLowerCase();

    return corpus.includes(search);
  });

  list.sort((a, b) => {
    if (sortBy === "pinyin") {
      return (a.pinyin || "").localeCompare(b.pinyin || "", "zh-Hans-CN");
    }
    if (sortBy === "wordCount") {
      return (b.words || []).length - (a.words || []).length || a.char.localeCompare(b.char, "zh-Hans-CN");
    }
    if (sortBy === "idiomCount") {
      return (b.idioms || []).length - (a.idioms || []).length || a.char.localeCompare(b.char, "zh-Hans-CN");
    }
    return a.char.localeCompare(b.char, "zh-Hans-CN");
  });

  state.filtered = list;
  renderStats();
  renderTable();
}

function bindEvents() {
  [
    refs.searchInput,
    refs.ageFilter,
    refs.levelFilter,
    refs.sortBy,
    refs.withIdiomOnly,
    refs.withPictographOnly,
    refs.showLearnedOnly,
  ].forEach((node) => node.addEventListener("input", applyFilters));
  [refs.ageFilter, refs.levelFilter, refs.sortBy].forEach((node) =>
    node.addEventListener("change", applyFilters)
  );
  refs.openDictBtn?.addEventListener("click", () => {
    openDictionaryDrawer(state.selectedChar);
  });
  refs.openDictNavLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openDictionaryDrawer(state.selectedChar);
  });
  refs.closeDictBtn?.addEventListener("click", closeDictionaryDrawer);
  refs.dictDrawerMask?.addEventListener("click", (event) => {
    if (event.target === refs.dictDrawerMask) {
      closeDictionaryDrawer();
    }
  });
  refs.dictSearchBtn?.addEventListener("click", () => {
    const text = String(refs.dictSearchInput?.value || "").trim();
    renderDictionarySuggestions(text);
    if (text) {
      renderDictionaryDetailByChar(text);
      return;
    }
    renderDictionaryDetailByChar(state.selectedChar);
  });
  refs.dictSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    refs.dictSearchBtn?.click();
  });
  refs.dictSearchInput?.addEventListener("input", (event) => {
    renderDictionarySuggestions(event.target.value);
  });
  refs.dictSuggestList?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-dict-char]");
    if (!btn) {
      return;
    }
    const char = btn.dataset.dictChar || "";
    if (!char) {
      return;
    }
    renderDictionaryDetailByChar(char);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawerOpen) {
      closeDictionaryDrawer();
    }
  });
}

function bootstrap() {
  const dimensions = window.LEARNING_DIMENSIONS || { ageGroups: [], chineseLevels: [] };
  fillSelect(refs.ageFilter, dimensions.ageGroups || [], "全部年龄段");
  fillSelect(refs.levelFilter, dimensions.chineseLevels || [], "全部级别");
  initDictionaryMap();
  const params = new URLSearchParams(window.location.search);
  state.pendingOpenDict = params.get("dict") === "1";
  state.pendingDictChar = String(params.get("char") || "").trim();
  if (state.pendingDictChar) {
    refs.searchInput.value = state.pendingDictChar;
    state.selectedChar = state.pendingDictChar;
  }
  loadLearnedChars();
  bindEvents();
  applyFilters();
  if (state.pendingOpenDict) {
    openDictionaryDrawer(state.pendingDictChar || state.selectedChar);
  }
}

bootstrap();
