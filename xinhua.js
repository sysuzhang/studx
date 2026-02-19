const refs = {
  searchInput: document.getElementById("searchInput"),
  radicalFilter: document.getElementById("radicalFilter"),
  levelFilter: document.getElementById("levelFilter"),
  withIdiomOnly: document.getElementById("withIdiomOnly"),
  withPictographOnly: document.getElementById("withPictographOnly"),
  clearBtn: document.getElementById("clearBtn"),
  resultMeta: document.getElementById("resultMeta"),
  entryList: document.getElementById("entryList"),
  detailBox: document.getElementById("detailBox"),
};

const store = window.LearningStore;
const state = {
  entries: Array.isArray(window.XINHUA_DICTIONARY) ? window.XINHUA_DICTIONARY : [],
  filtered: [],
  selectedChar: "",
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

function levelText(levels) {
  return (levels || []).join(" / ") || "未标注";
}

function parseQueryChar() {
  const params = new URLSearchParams(window.location.search);
  return params.get("char") || "";
}

function entryCardHtml(entry, active) {
  return `
    <article class="entry-item ${active ? "active" : ""}" data-char="${escapeHtml(entry.char)}">
      <div class="entry-main">
        <span class="entry-char">${escapeHtml(entry.char)}</span>
        <div>
          <p class="detail-pinyin">${escapeHtml(entry.pinyin)}</p>
          <p class="entry-meta">部首 ${escapeHtml(entry.radical)} · ${escapeHtml(entry.strokes || "-")} 画</p>
        </div>
      </div>
      <p class="entry-meta">释义：${escapeHtml(entry.meanings?.[0] || "暂无释义")}</p>
    </article>
  `;
}

function renderEntryList() {
  refs.entryList.innerHTML = "";
  refs.resultMeta.textContent = `共 ${state.filtered.length} 条词条`;
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
      selectChar(entry.char);
    });
    refs.entryList.appendChild(card);
  });
}

function detailHtml(entry) {
  const words = entry.words || [];
  const idioms = entry.idioms || [];
  const examples = entry.examples || [];
  const synonymText = (entry.synonyms || []).join("、") || "暂无";
  const antonymText = (entry.antonyms || []).join("、") || "暂无";

  return `
    <div class="detail-head">
      <span class="detail-char">${escapeHtml(entry.char)}</span>
      <div>
        <p class="detail-pinyin">${escapeHtml(entry.pinyin)}</p>
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

    <h3>基本释义</h3>
    <ol class="detail-list">
      ${(entry.meanings || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ol>

    <h3>近义 / 反义</h3>
    <div class="chip-row">
      <span class="chip">近义：${escapeHtml(synonymText)}</span>
      <span class="chip">反义：${escapeHtml(antonymText)}</span>
    </div>

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

    <h3>成语（${idioms.length}）</h3>
    ${
      idioms.length
        ? idioms
            .map(
              (entryIdiom) => `
          <div class="word-item">
            <p><strong>${escapeHtml(entryIdiom.name)}</strong>：${escapeHtml(entryIdiom.meaning)}</p>
            ${entryIdiom.story ? `<p>${escapeHtml(entryIdiom.story)}</p>` : ""}
          </div>
        `
            )
            .join("")
        : `<p class="empty">暂无成语。</p>`
    }

    <h3>例句参考</h3>
    <ul class="detail-list">
      ${examples.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ul>

    <h3>象形图参考</h3>
    ${
      entry.pictograph?.image
        ? `<div class="word-item">
            <p><strong>${escapeHtml(entry.pictograph.script || "字形")}</strong></p>
            <p>${escapeHtml(entry.pictograph.note || "用于辅助字源理解。")}</p>
            <p><a class="link-btn" href="${escapeHtml(entry.pictograph.source || "#")}" target="_blank" rel="noopener noreferrer">查看来源</a></p>
          </div>`
        : `<p class="empty">暂无象形图。</p>`
    }

    <p class="detail-note">
      说明：该频道为教学版“新华字典”，用于学习检索与理解，不替代正式出版字典全文。
    </p>
  `;
}

function selectChar(char) {
  state.selectedChar = char;
  const entry = state.entries.find((item) => item.char === char);
  if (!entry) {
    refs.detailBox.innerHTML = `<p class="empty">未找到词条。</p>`;
    return;
  }
  refs.detailBox.innerHTML = detailHtml(entry);
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
  logLookup(char);
}

function applyFilters() {
  const search = refs.searchInput.value.trim().toLowerCase();
  const radical = refs.radicalFilter.value;
  const level = refs.levelFilter.value;
  const withIdiomOnly = refs.withIdiomOnly.checked;
  const withPictographOnly = refs.withPictographOnly.checked;

  let list = [...state.entries];
  list = list.filter((entry) => {
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
    const corpus = [
      entry.char,
      entry.pinyin,
      entry.radical,
      ...(entry.meanings || []),
      ...(entry.words || []).map((item) => `${item.word} ${item.meaning}`),
      ...(entry.idioms || []).map((item) => `${item.name} ${item.meaning}`),
    ]
      .join(" ")
      .toLowerCase();
    return corpus.includes(search);
  });

  list.sort((a, b) => a.char.localeCompare(b.char, "zh-Hans-CN"));
  state.filtered = list;
  renderEntryList();
  if (!list.length) {
    return;
  }
  const preferred = list.find((entry) => entry.char === state.selectedChar) || list[0];
  selectChar(preferred.char);
}

function resetFilters() {
  refs.searchInput.value = "";
  refs.radicalFilter.value = "";
  refs.levelFilter.value = "";
  refs.withIdiomOnly.checked = false;
  refs.withPictographOnly.checked = false;
  applyFilters();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", applyFilters);
  refs.radicalFilter.addEventListener("change", applyFilters);
  refs.levelFilter.addEventListener("change", applyFilters);
  refs.withIdiomOnly.addEventListener("input", applyFilters);
  refs.withPictographOnly.addEventListener("input", applyFilters);
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

  const char = parseQueryChar();
  if (char) {
    refs.searchInput.value = char;
    state.selectedChar = char;
  }
  applyFilters();
}

bootstrap();
