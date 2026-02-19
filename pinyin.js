const refs = {
  initialList: document.getElementById("initialList"),
  finalList: document.getElementById("finalList"),
  toneCards: document.getElementById("toneCards"),
  composeInitial: document.getElementById("composeInitial"),
  composeFinal: document.getElementById("composeFinal"),
  composeTone: document.getElementById("composeTone"),
  syllableResult: document.getElementById("syllableResult"),
  syllableExample: document.getElementById("syllableExample"),
  generateBtn: document.getElementById("generateBtn"),
  speakBtn: document.getElementById("speakBtn"),
};

const initials = [
  { symbol: "b", tip: "双唇不送气", example: "爸 bà", speak: "爸爸" },
  { symbol: "p", tip: "双唇送气", example: "坡 pō", speak: "山坡" },
  { symbol: "m", tip: "双唇鼻音", example: "妈 mā", speak: "妈妈" },
  { symbol: "f", tip: "唇齿音", example: "风 fēng", speak: "风" },
  { symbol: "d", tip: "舌尖中不送气", example: "的 dì", speak: "目的" },
  { symbol: "t", tip: "舌尖中送气", example: "他 tā", speak: "他" },
  { symbol: "n", tip: "舌尖中鼻音", example: "你 nǐ", speak: "你" },
  { symbol: "l", tip: "舌尖边音", example: "乐 lè", speak: "快乐" },
  { symbol: "g", tip: "舌根不送气", example: "哥 gē", speak: "哥哥" },
  { symbol: "k", tip: "舌根送气", example: "科 kē", speak: "科学" },
  { symbol: "h", tip: "舌根擦音", example: "喝 hē", speak: "喝水" },
  { symbol: "j", tip: "舌面音", example: "鸡 jī", speak: "公鸡" },
  { symbol: "q", tip: "舌面送气", example: "七 qī", speak: "七" },
  { symbol: "x", tip: "舌面擦音", example: "西 xī", speak: "东西" },
  { symbol: "zh", tip: "卷舌不送气", example: "知 zhī", speak: "知道" },
  { symbol: "ch", tip: "卷舌送气", example: "吃 chī", speak: "吃饭" },
  { symbol: "sh", tip: "卷舌擦音", example: "诗 shī", speak: "诗歌" },
  { symbol: "r", tip: "卷舌近音", example: "日 rì", speak: "日子" },
  { symbol: "z", tip: "舌尖前不送气", example: "走 zǒu", speak: "走路" },
  { symbol: "c", tip: "舌尖前送气", example: "草 cǎo", speak: "小草" },
  { symbol: "s", tip: "舌尖前擦音", example: "思 sī", speak: "思考" },
  { symbol: "y", tip: "半元音", example: "衣 yī", speak: "衣服" },
  { symbol: "w", tip: "半元音", example: "我 wǒ", speak: "我们" },
];

const finals = [
  { symbol: "a", tip: "开口呼", example: "啊 a", speak: "啊" },
  { symbol: "o", tip: "圆唇后元音", example: "喔 ō", speak: "喔" },
  { symbol: "e", tip: "央元音", example: "鹅 é", speak: "鹅" },
  { symbol: "i", tip: "高前元音", example: "一 yī", speak: "一" },
  { symbol: "u", tip: "高后圆唇", example: "乌 wū", speak: "乌鸦" },
  { symbol: "ü", tip: "撮口呼", example: "鱼 yú", speak: "小鱼" },
  { symbol: "ai", tip: "复韵母", example: "爱 ài", speak: "可爱" },
  { symbol: "ei", tip: "复韵母", example: "杯 bēi", speak: "杯子" },
  { symbol: "ao", tip: "复韵母", example: "猫 māo", speak: "小猫" },
  { symbol: "ou", tip: "复韵母", example: "口 kǒu", speak: "口" },
  { symbol: "an", tip: "前鼻韵母", example: "安 ān", speak: "安全" },
  { symbol: "en", tip: "前鼻韵母", example: "本 běn", speak: "本子" },
  { symbol: "ang", tip: "后鼻韵母", example: "长 cháng", speak: "成长" },
  { symbol: "eng", tip: "后鼻韵母", example: "风 fēng", speak: "风" },
  { symbol: "ong", tip: "后鼻韵母", example: "中 zhōng", speak: "中国" },
];

const tones = [
  { value: 1, label: "第一声", shape: "55（高平）", example: "妈 mā" },
  { value: 2, label: "第二声", shape: "35（上扬）", example: "麻 má" },
  { value: 3, label: "第三声", shape: "214（先降后升）", example: "马 mǎ" },
  { value: 4, label: "第四声", shape: "51（全降）", example: "骂 mà" },
  { value: 5, label: "轻声", shape: "弱读", example: "吗 ma" },
];

const sampleBySyllable = {
  ma: ["妈", "麻", "马", "骂", "吗"],
  ba: ["八", "拔", "把", "爸", "吧"],
  he: ["喝", "河", "很", "贺", "和"],
  shi: ["诗", "十", "使", "是", "事"],
  zhong: ["中", "重", "种", "众", "钟"],
  xue: ["靴", "学", "雪", "血", "学"],
  ren: ["人", "仁", "忍", "认", "人"],
  xin: ["新", "心", "信", "印", "呢"],
};

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-CN";
  utter.rate = 0.92;
  utter.pitch = 1.02;
  window.speechSynthesis.speak(utter);
}

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";
  card.innerHTML = `
    <div class="item-main">${item.symbol}</div>
    <div class="item-tip">${item.tip}</div>
    <div class="item-foot">
      <span class="item-example">${item.example}</span>
      <button type="button" class="speak-btn">播放</button>
    </div>
  `;
  const btn = card.querySelector(".speak-btn");
  btn.addEventListener("click", () => speakText(item.speak));
  return card;
}

function renderBasics() {
  refs.initialList.innerHTML = "";
  refs.finalList.innerHTML = "";
  refs.toneCards.innerHTML = "";

  initials.forEach((item) => refs.initialList.appendChild(createItemCard(item)));
  finals.forEach((item) => refs.finalList.appendChild(createItemCard(item)));

  tones.forEach((tone) => {
    const card = document.createElement("article");
    card.className = "tone-card";
    card.innerHTML = `
      <h3>${tone.label}</h3>
      <p class="tone-shape">调值：${tone.shape}</p>
      <p class="tone-example">${tone.example}</p>
    `;
    refs.toneCards.appendChild(card);
  });
}

function fillComposeSelects() {
  refs.composeInitial.innerHTML = `<option value="">（零声母）</option>`;
  initials.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.symbol;
    option.textContent = item.symbol;
    refs.composeInitial.appendChild(option);
  });

  refs.composeFinal.innerHTML = "";
  finals.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.symbol;
    option.textContent = item.symbol;
    refs.composeFinal.appendChild(option);
  });
}

function applyToneMark(rawSyllable, tone) {
  if (tone === 5) {
    return rawSyllable;
  }
  const marks = {
    a: ["ā", "á", "ǎ", "à"],
    o: ["ō", "ó", "ǒ", "ò"],
    e: ["ē", "é", "ě", "è"],
    i: ["ī", "í", "ǐ", "ì"],
    u: ["ū", "ú", "ǔ", "ù"],
    "ü": ["ǖ", "ǘ", "ǚ", "ǜ"],
    v: ["ǖ", "ǘ", "ǚ", "ǜ"],
  };

  const lower = rawSyllable.toLowerCase();
  let index = -1;
  const priority = ["a", "e"];
  for (const vowel of priority) {
    index = lower.indexOf(vowel);
    if (index !== -1) {
      break;
    }
  }
  if (index === -1 && lower.includes("ou")) {
    index = lower.indexOf("o");
  }
  if (index === -1) {
    for (let i = lower.length - 1; i >= 0; i -= 1) {
      if ("aeiouvü".includes(lower[i])) {
        index = i;
        break;
      }
    }
  }
  if (index === -1) {
    return rawSyllable;
  }

  const oldVowel = rawSyllable[index];
  const lookup = marks[oldVowel] || marks[oldVowel.toLowerCase()];
  if (!lookup) {
    return rawSyllable;
  }
  const newVowel = lookup[tone - 1];
  return `${rawSyllable.slice(0, index)}${newVowel}${rawSyllable.slice(index + 1)}`;
}

function getExampleChars(base, tone) {
  const key = base.toLowerCase();
  const examples = sampleBySyllable[key];
  if (!examples || !examples.length) {
    return "暂无固定示例，可先播放老师示例词练习。";
  }
  const char = examples[Math.max(0, Math.min(4, tone - 1))];
  return char || examples[0];
}

function generateSyllable() {
  const initial = refs.composeInitial.value;
  const final = refs.composeFinal.value;
  const tone = Number.parseInt(refs.composeTone.value, 10);
  const raw = `${initial}${final}`;
  const pinyin = applyToneMark(raw, tone);

  refs.syllableResult.textContent = pinyin || "-";
  refs.syllableExample.textContent = getExampleChars(raw, tone);
}

function bindEvents() {
  refs.generateBtn.addEventListener("click", generateSyllable);
  refs.speakBtn.addEventListener("click", () => {
    const text = refs.syllableExample.textContent;
    if (!text || text === "-") {
      return;
    }
    speakText(text);
  });
}

function bootstrap() {
  renderBasics();
  fillComposeSelects();
  refs.composeInitial.value = "m";
  refs.composeFinal.value = "a";
  refs.composeTone.value = "1";
  bindEvents();
  generateSyllable();
}

bootstrap();
