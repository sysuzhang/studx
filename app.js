const refs = {
  textInput: document.getElementById("textInput"),
  gridType: document.getElementById("gridType"),
  repeatCount: document.getElementById("repeatCount"),
  columns: document.getElementById("columns"),
  cellSize: document.getElementById("cellSize"),
  traceMode: document.getElementById("traceMode"),
  showGuide: document.getElementById("showGuide"),
  generateBtn: document.getElementById("generateBtn"),
  printBtn: document.getElementById("printBtn"),
  clearBtn: document.getElementById("clearBtn"),
  charPicker: document.getElementById("charPicker"),
  worksheetPages: document.getElementById("worksheetPages"),
  currentChar: document.getElementById("currentChar"),
  writerTarget: document.getElementById("writerTarget"),
  animateBtn: document.getElementById("animateBtn"),
  loopBtn: document.getElementById("loopBtn"),
  quizBtn: document.getElementById("quizBtn"),
  strokeMeta: document.getElementById("strokeMeta"),
  strokeOrderList: document.getElementById("strokeOrderList"),
};

const state = {
  chars: [],
  selectedChar: "",
  writer: null,
  loopMode: false,
  strokeReqId: 0,
};

let hanRegex;
try {
  hanRegex = /\p{Script=Han}/u;
} catch (error) {
  hanRegex = /[\u3400-\u9fff\uf900-\ufaff]/;
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

  const cells = buildCells(chars, config);
  if (cells.length === 0) {
    refs.worksheetPages.innerHTML = `<div class="hint">请输入至少一个汉字以生成字帖。</div>`;
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
      <span>练字内容：${chars.join("")}</span>
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
      charNode.className = `cell-char ${item.mode}`;
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
  state.selectedChar = char;
  state.loopMode = false;
  refs.loopBtn.textContent = "循环演示：关";
  refs.currentChar.textContent = char;
  updatePickerActive(char);
  createWriter(char);
  loadStrokeData(char);
}

function regenerate() {
  const chars = extractChineseChars(refs.textInput.value.trim());
  state.chars = chars;

  renderWorksheet(chars);
  renderCharPicker(chars);

  if (chars.length === 0) {
    state.selectedChar = "";
    refs.currentChar.textContent = "-";
    refs.writerTarget.innerHTML = "";
    clearStrokeList();
    setStrokeMeta("请选择一个汉字查看笔画顺序。");
    return;
  }

  const preferred = chars.includes(state.selectedChar) ? state.selectedChar : chars[0];
  selectChar(preferred);
}

function toggleLoopMode() {
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
  refs.generateBtn.addEventListener("click", regenerate);
  refs.printBtn.addEventListener("click", () => window.print());
  refs.clearBtn.addEventListener("click", () => {
    refs.textInput.value = "";
    regenerate();
  });

  refs.animateBtn.addEventListener("click", () => {
    if (!state.writer || !state.selectedChar) {
      return;
    }
    state.loopMode = false;
    refs.loopBtn.textContent = "循环演示：关";
    if (typeof state.writer.animateCharacter === "function") {
      state.writer.animateCharacter();
    }
  });

  refs.loopBtn.addEventListener("click", toggleLoopMode);

  refs.quizBtn.addEventListener("click", () => {
    if (!state.writer || !state.selectedChar) {
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
}

function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const presetChars = extractChineseChars(params.get("chars") || "");
  refs.textInput.value = presetChars.length ? presetChars.join("") : "永和春风";
  bindEvents();
  regenerate();
}

bootstrap();
