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
};

const STORAGE_KEY = "studyCalendarCompletionV1";
const store = window.LearningStore;

const state = {
  library: Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [],
  filtered: [],
  learnedChars: new Set(),
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
  addBtn?.addEventListener("click", () => {
    addCharToWorksheet(item.char, "overview_detail");
    renderStats();
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
        <a class="action-link add-cart-link" href="#">入字帖</a>
      </td>
    `;
    row.addEventListener("click", (event) => {
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
}

function bootstrap() {
  const dimensions = window.LEARNING_DIMENSIONS || { ageGroups: [], chineseLevels: [] };
  fillSelect(refs.ageFilter, dimensions.ageGroups || [], "全部年龄段");
  fillSelect(refs.levelFilter, dimensions.chineseLevels || [], "全部级别");
  loadLearnedChars();
  bindEvents();
  applyFilters();
}

bootstrap();
