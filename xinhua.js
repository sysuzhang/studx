const refs = {
  searchInput: document.getElementById("searchInput"),
  radicalFilter: document.getElementById("radicalFilter"),
  levelFilter: document.getElementById("levelFilter"),
  withIdiomOnly: document.getElementById("withIdiomOnly"),
  withPictographOnly: document.getElementById("withPictographOnly"),
  initialIndex: document.getElementById("initialIndex"),
  clearBtn: document.getElementById("clearBtn"),
  resultMeta: document.getElementById("resultMeta"),
  membershipMeta: document.getElementById("membershipMeta"),
  entryList: document.getElementById("entryList"),
  detailBox: document.getElementById("detailBox"),
};

const store = window.LearningStore;
const state = {
  entries: Array.isArray(window.XINHUA_DICTIONARY) ? window.XINHUA_DICTIONARY : [],
  filtered: [],
  selectedChar: "",
  initialFilter: "",
  availableInitials: new Set(),
  selectedPronunciationByChar: {},
};

const INITIAL_LETTERS = Array.from({ length: 26 }, (_, idx) => String.fromCharCode(65 + idx));

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

function fillSelect(node, options, allLabel) {
  node.innerHTML = `<option value="">${allLabel}</option>`;
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    node.appendChild(option);
  });
}

function speakText(text) {
  const content = String(text ?? "").trim();
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

function logLookup(char) {
  if (!store || typeof store.logActivity !== "function") {
    return;
  }
  store.logActivity("dictionary_lookup", { char, source: "xinhua" });
}

function hasDictionaryAdvancedAccess() {
  if (!store || typeof store.isFeatureEnabled !== "function") {
    return true;
  }
  return store.isFeatureEnabled("dictionary_advanced");
}

function renderMembershipMeta() {
  if (!refs.membershipMeta) {
    return;
  }
  if (!store || typeof store.getBillingSnapshot !== "function") {
    refs.membershipMeta.textContent = "";
    return;
  }
  const billing = store.getBillingSnapshot();
  const planName = billing?.plan?.name || "基础版";
  if (hasDictionaryAdvancedAccess()) {
    refs.membershipMeta.innerHTML = `当前套餐：<strong>${planName}</strong>，已解锁字典进阶释义。`;
    return;
  }
  refs.membershipMeta.innerHTML = `当前套餐：<strong>${planName}</strong>。基础释义可免费使用，进阶释义可在 <a href="./pricing.html">订阅中心</a> 解锁。`;
}

function normalizePinyinText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[āáǎà]/g, "a")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "v");
}

function getPinyinInitial(text) {
  const normalized = normalizePinyinText(text).replace(/[^a-z]/g, "");
  const first = normalized.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
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

function getEntryInitialSet(entry) {
  const set = new Set();
  getEntryPronunciations(entry).forEach((item) => {
    const initial = getPinyinInitial(item.pinyin);
    if (/^[A-Z]$/.test(initial)) {
      set.add(initial);
    }
  });
  if (!set.size) {
    const fallback = getPinyinInitial(entry?.pinyin);
    if (/^[A-Z]$/.test(fallback)) {
      set.add(fallback);
    }
  }
  return set;
}

function getEntryPinyinDisplay(entry) {
  const unique = [...new Set(getEntryPronunciations(entry).map((item) => item.pinyin).filter(Boolean))];
  return unique.join(" / ") || String(entry?.pinyin || "");
}

function buildEntryCorpus(entry) {
  const pronunciations = getEntryPronunciations(entry);
  const pronunciationCorpus = pronunciations.flatMap((item) => [
    item.pinyin,
    ...toArray(item.meanings),
    ...toArray(item.examples),
    ...toArray(item.words).map((word) => `${word.word || ""} ${word.meaning || ""}`),
    ...toArray(item.idioms).map((idiom) => `${idiom.name || ""} ${idiom.meaning || ""} ${idiom.story || ""}`),
  ]);
  return [
    entry.char,
    entry.pinyin,
    getEntryPinyinDisplay(entry),
    entry.radical,
    ...(entry.meanings || []),
    ...(entry.words || []).map((item) => `${item.word} ${item.meaning}`),
    ...(entry.idioms || []).map((item) => `${item.name} ${item.meaning}`),
    ...pronunciationCorpus,
  ]
    .join(" ")
    .toLowerCase();
}

function renderInitialIndex() {
  if (!refs.initialIndex) {
    return;
  }
  const buttons = [{ value: "", label: "全部" }, ...INITIAL_LETTERS.map((letter) => ({ value: letter, label: letter }))];
  refs.initialIndex.innerHTML = buttons
    .map(({ value, label }) => {
      const active = state.initialFilter === value;
      const disabled = value && !state.availableInitials.has(value) && !active;
      return `<button type="button" class="initial-btn${active ? " active" : ""}" data-initial="${value}" ${
        disabled ? "disabled" : ""
      }>${label}</button>`;
    })
    .join("");
}

function levelText(levels) {
  return (levels || []).join(" / ") || "未标注";
}

function parseQueryChar() {
  const params = new URLSearchParams(window.location.search);
  return params.get("char") || "";
}

function entryCardHtml(entry, active) {
  const pinyinText = getEntryPinyinDisplay(entry);
  const firstMeaning = getEntryPronunciations(entry)[0]?.meanings?.[0] || entry.meanings?.[0] || "暂无释义";
  const polyphoneBadge =
    getEntryPronunciations(entry).length > 1 ? `<span class="poly-badge">多音</span>` : "";
  return `
    <article class="entry-item ${active ? "active" : ""}" data-char="${escapeHtml(entry.char)}">
      <div class="entry-main">
        <span class="entry-char">${escapeHtml(entry.char)}</span>
        <div>
          <p class="detail-pinyin">${escapeHtml(pinyinText)}${polyphoneBadge}</p>
          <p class="entry-meta">部首 ${escapeHtml(entry.radical)} · ${escapeHtml(entry.strokes || "-")} 画</p>
        </div>
      </div>
      <p class="entry-meta">释义：${escapeHtml(firstMeaning)}</p>
    </article>
  `;
}

function renderEntryList() {
  refs.entryList.innerHTML = "";
  if (!state.filtered.length) {
    refs.entryList.innerHTML = `<p class="empty">没有匹配的词条，请调整检索条件。</p>`;
    refs.detailBox.innerHTML = `<p class="empty">暂无可展示词条。</p>`;
    return;
  }
  state.filtered.forEach((entry) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = entryCardHtml(entry, entry.char === state.selectedChar);
    const card = wrap.firstElementChild;
    card.addEventListener("click", () => {
      selectChar(entry.char, { meter: true });
    });
    refs.entryList.appendChild(card);
  });
}

function detailHtml(entry, pronunciationIndex, advancedEnabled) {
  const pronunciations = getEntryPronunciations(entry);
  const safeIndex = Math.max(0, Math.min(pronunciations.length - 1, pronunciationIndex || 0));
  const activePronunciation = pronunciations[safeIndex] || pronunciations[0];
  const words = activePronunciation?.words || [];
  const idioms = activePronunciation?.idioms || [];
  const examples = activePronunciation?.examples?.length
    ? activePronunciation.examples
    : entry.examples || [];
  const visibleIdioms = advancedEnabled ? idioms : idioms.slice(0, 2);
  const visibleExamples = advancedEnabled ? examples : examples.slice(0, 1);
  const synonymText = (entry.synonyms || []).join("、") || "暂无";
  const antonymText = (entry.antonyms || []).join("、") || "暂无";
  const pronunciationSwitch =
    pronunciations.length > 1
      ? `
    <div class="pronunciation-switch">
      <p class="meta">多音字词条切换：当前读音 ${escapeHtml(activePronunciation.pinyin || "-")}</p>
      <div class="pron-tabs">
        ${pronunciations
          .map((item, index) => {
            const activeClass = index === safeIndex ? " active" : "";
            const tagText = item.tag ? `（${item.tag}）` : "";
            return `<button type="button" class="pron-tab${activeClass}" data-pron-index="${index}">${escapeHtml(
              item.pinyin || "-"
            )}${escapeHtml(tagText)}</button>`;
          })
          .join("")}
      </div>
    </div>
  `
      : "";
  const upgradeBlock = `
    <div class="upgrade-box">
      <p>进阶释义属于会员功能：可查看完整近反义、完整成语故事、完整例句与象形资料。</p>
      <a class="link-btn" href="./pricing.html">前往订阅中心</a>
    </div>
  `;

  return `
    <div class="detail-head">
      <span class="detail-char">${escapeHtml(entry.char)}</span>
      <div>
        <p class="detail-pinyin">${escapeHtml(activePronunciation?.pinyin || entry.pinyin)}</p>
        <p class="detail-tags">
          部首：${escapeHtml(entry.radical)} · 笔画：${escapeHtml(entry.strokes || "-")} · 结构：${escapeHtml(
    entry.structure
  )}
        </p>
        <p class="detail-tags">级别：${escapeHtml(levelText(entry.levels))}</p>
        <p class="detail-tags">繁体：${escapeHtml(entry.variant || "—")}</p>
      </div>
    </div>

    <div class="detail-actions">
      <button id="speakBtn" type="button">朗读汉字</button>
      <button id="addCartBtn" type="button" class="ghost">加入字帖</button>
      <a class="link-btn" href="./practice.html?char=${encodeURIComponent(entry.char)}">去练习</a>
      <a class="link-btn" href="./calendar.html?chars=${encodeURIComponent(entry.char)}">入日历</a>
      <a class="link-btn" href="./overview.html">回总览</a>
    </div>
    ${pronunciationSwitch}

    <h3>基本释义</h3>
    <ol class="detail-list">
      ${(activePronunciation?.meanings || entry.meanings || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ol>

    <h3>近义 / 反义${advancedEnabled ? "" : "（会员）"}</h3>
    ${
      advancedEnabled
        ? `
      <div class="chip-row">
        <span class="chip">近义：${escapeHtml(synonymText)}</span>
        <span class="chip">反义：${escapeHtml(antonymText)}</span>
      </div>
    `
        : upgradeBlock
    }

    <h3>常用词组（${words.length}）</h3>
    ${
      words.length
        ? words
            .map(
              (entryWord) => `
          <div class="word-item">
            <p><strong>${escapeHtml(entryWord.word)}</strong>：${escapeHtml(entryWord.meaning)}</p>
          </div>
        `
            )
            .join("")
        : `<p class="empty">暂无词组。</p>`
    }

    <h3>成语（${visibleIdioms.length}${advancedEnabled ? "" : ` / ${idioms.length}`}）</h3>
    ${
      visibleIdioms.length
        ? visibleIdioms
            .map(
              (entryIdiom) => `
          <div class="word-item">
            <p><strong>${escapeHtml(entryIdiom.name)}</strong>：${escapeHtml(entryIdiom.meaning)}</p>
            ${advancedEnabled && entryIdiom.story ? `<p>${escapeHtml(entryIdiom.story)}</p>` : ""}
          </div>
        `
            )
            .join("")
        : `<p class="empty">暂无成语。</p>`
    }
    ${!advancedEnabled && idioms.length > visibleIdioms.length ? `<p class="meta">更多成语故事已折叠，开通会员后可查看全部。</p>` : ""}

    <h3>例句参考${advancedEnabled ? "" : "（会员可看完整）"}</h3>
    <ul class="detail-list">
      ${visibleExamples.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ul>
    ${!advancedEnabled && examples.length > visibleExamples.length ? `<p class="meta">已展示 1 条示例，会员可查看完整例句。</p>` : ""}

    <h3>象形图参考${advancedEnabled ? "" : "（会员）"}</h3>
    ${
      advancedEnabled && entry.pictograph?.image
        ? `<div class="word-item">
            <p><strong>${escapeHtml(entry.pictograph.script || "字形")}</strong></p>
            <p>${escapeHtml(entry.pictograph.note || "用于辅助字源理解。")}</p>
            <p><a class="link-btn" href="${escapeHtml(entry.pictograph.source || "#")}" target="_blank" rel="noopener noreferrer">查看来源</a></p>
          </div>`
        : advancedEnabled
        ? `<p class="empty">暂无象形图。</p>`
        : upgradeBlock
    }

    <p class="detail-note">
      说明：该频道为教学版“新华字典”，用于学习检索与理解，不替代正式出版字典全文。
    </p>
  `;
}

function selectChar(char, options) {
  const opts = options && typeof options === "object" ? options : {};
  if (opts.meter && store && typeof store.consumeFeatureUsage === "function") {
    const quota = store.consumeFeatureUsage("dictionary_lookup", 1, { source: "xinhua_manual_lookup" });
    if (!quota.ok) {
      refs.detailBox.innerHTML = `
        <div class="upgrade-box">
          <p>今日词典检索次数已达上限（${quota.limit} 次）。</p>
          <p>你仍可浏览已打开词条，若需继续高频检索，可前往订阅中心升级。</p>
          <a class="link-btn" href="./pricing.html">去订阅中心</a>
        </div>
      `;
      renderMembershipMeta();
      return;
    }
  }
  state.selectedChar = char;
  const entry = state.entries.find((item) => item.char === char);
  if (!entry) {
    refs.detailBox.innerHTML = `<p class="empty">未找到词条。</p>`;
    return;
  }
  const pronunciations = getEntryPronunciations(entry);
  const fromOption = Number.isFinite(opts.pronunciationIndex) ? Math.floor(opts.pronunciationIndex) : NaN;
  const fromMemory = Number.isFinite(state.selectedPronunciationByChar[char])
    ? state.selectedPronunciationByChar[char]
    : 0;
  const targetIndex = Number.isFinite(fromOption) ? fromOption : fromMemory;
  const safePronunciationIndex = Math.max(0, Math.min(pronunciations.length - 1, targetIndex));
  state.selectedPronunciationByChar[char] = safePronunciationIndex;
  const advancedEnabled = hasDictionaryAdvancedAccess();
  refs.detailBox.innerHTML = detailHtml(entry, safePronunciationIndex, advancedEnabled);
  refs.entryList.querySelectorAll(".entry-item").forEach((node) => {
    node.classList.toggle("active", node.dataset.char === char);
  });
  document.getElementById("speakBtn")?.addEventListener("click", () => speakText(entry.char));
  document.getElementById("addCartBtn")?.addEventListener("click", () => {
    if (!store || typeof store.addWorksheetChars !== "function") {
      return;
    }
    store.addWorksheetChars(entry.char, "xinhua_detail");
  });
  refs.detailBox.querySelectorAll("[data-pron-index]").forEach((node) => {
    node.addEventListener("click", () => {
      const nextIndex = Number.parseInt(node.dataset.pronIndex, 10);
      selectChar(char, {
        meter: false,
        pronunciationIndex: Number.isFinite(nextIndex) ? nextIndex : 0,
        silentLog: true,
      });
    });
  });
  if (!opts.silentLog) {
    logLookup(char);
  }
  renderMembershipMeta();
}

function applyFilters() {
  const search = refs.searchInput.value.trim().toLowerCase();
  const radical = refs.radicalFilter.value;
  const level = refs.levelFilter.value;
  const withIdiomOnly = refs.withIdiomOnly.checked;
  const withPictographOnly = refs.withPictographOnly.checked;

  const baseList = [...state.entries].filter((entry) => {
    if (radical && entry.radical !== radical) {
      return false;
    }
    if (level && !entry.levels?.includes(level)) {
      return false;
    }
    if (withIdiomOnly && !(entry.idioms || []).length) {
      return false;
    }
    if (withPictographOnly && !entry.pictograph?.image) {
      return false;
    }
    if (!search) {
      return true;
    }
    const corpus = buildEntryCorpus(entry);
    return corpus.includes(search);
  });

  state.availableInitials = baseList.reduce((set, entry) => {
    getEntryInitialSet(entry).forEach((initial) => set.add(initial));
    return set;
  }, new Set());

  let list = state.initialFilter
    ? baseList.filter((entry) => getEntryInitialSet(entry).has(state.initialFilter))
    : baseList;

  list.sort((a, b) => a.char.localeCompare(b.char, "zh-Hans-CN"));
  state.filtered = list;
  refs.resultMeta.textContent = state.initialFilter
    ? `共 ${state.filtered.length} 条词条（首字母：${state.initialFilter}）`
    : `共 ${state.filtered.length} 条词条`;
  renderInitialIndex();
  renderEntryList();
  if (!list.length) {
    return;
  }
  const preferred = list.find((entry) => entry.char === state.selectedChar) || list[0];
  selectChar(preferred.char, { meter: false });
}

function resetFilters() {
  refs.searchInput.value = "";
  refs.radicalFilter.value = "";
  refs.levelFilter.value = "";
  refs.withIdiomOnly.checked = false;
  refs.withPictographOnly.checked = false;
  state.initialFilter = "";
  applyFilters();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", applyFilters);
  refs.radicalFilter.addEventListener("change", applyFilters);
  refs.levelFilter.addEventListener("change", applyFilters);
  refs.withIdiomOnly.addEventListener("input", applyFilters);
  refs.withPictographOnly.addEventListener("input", applyFilters);
  refs.initialIndex?.addEventListener("click", (event) => {
    const node = event.target.closest("button[data-initial]");
    if (!node || node.disabled) {
      return;
    }
    state.initialFilter = node.dataset.initial || "";
    applyFilters();
  });
  refs.clearBtn.addEventListener("click", resetFilters);
}

function bootstrap() {
  const radicals = [...new Set(state.entries.map((entry) => entry.radical).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );
  const levels = [...new Set(state.entries.flatMap((entry) => entry.levels || []))];
  fillSelect(refs.radicalFilter, radicals, "全部部首");
  fillSelect(refs.levelFilter, levels, "全部级别");
  bindEvents();
  renderMembershipMeta();

  const char = parseQueryChar();
  if (char) {
    refs.searchInput.value = char;
    state.selectedChar = char;
  }
  applyFilters();
}

bootstrap();
