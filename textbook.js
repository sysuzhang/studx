const refs = {
  gradeSelect: document.getElementById("gradeSelect"),
  termSelect: document.getElementById("termSelect"),
  searchInput: document.getElementById("searchInput"),
  prevLessonBtn: document.getElementById("prevLessonBtn"),
  nextLessonBtn: document.getElementById("nextLessonBtn"),
  goWorksheetBtn: document.getElementById("goWorksheetBtn"),
  catalogMeta: document.getElementById("catalogMeta"),
  catalogList: document.getElementById("catalogList"),
  progressBox: document.getElementById("progressBox"),
  lessonTitle: document.getElementById("lessonTitle"),
  lessonMeta: document.getElementById("lessonMeta"),
  lessonScene: document.getElementById("lessonScene"),
  readBtn: document.getElementById("readBtn"),
  markDoneBtn: document.getElementById("markDoneBtn"),
  addCharsBtn: document.getElementById("addCharsBtn"),
  lessonText: document.getElementById("lessonText"),
  focusChars: document.getElementById("focusChars"),
  keywordList: document.getElementById("keywordList"),
  questionList: document.getElementById("questionList"),
  taskList: document.getElementById("taskList"),
  quizMeta: document.getElementById("quizMeta"),
  regenQuizBtn: document.getElementById("regenQuizBtn"),
  submitQuizBtn: document.getElementById("submitQuizBtn"),
  addQuizWrongBtn: document.getElementById("addQuizWrongBtn"),
  quizForm: document.getElementById("quizForm"),
  quizResult: document.getElementById("quizResult"),
  readingSupport: document.getElementById("readingSupport"),
  readingStartBtn: document.getElementById("readingStartBtn"),
  readingStopBtn: document.getElementById("readingStopBtn"),
  readingScoreBtn: document.getElementById("readingScoreBtn"),
  readingAddWeakBtn: document.getElementById("readingAddWeakBtn"),
  readingTranscriptInput: document.getElementById("readingTranscriptInput"),
  readingScoreMeta: document.getElementById("readingScoreMeta"),
  paragraphScoreMeta: document.getElementById("paragraphScoreMeta"),
  readingHeatmap: document.getElementById("readingHeatmap"),
  readingDiagnosis: document.getElementById("readingDiagnosis"),
  remedialMeta: document.getElementById("remedialMeta"),
  genRemedialBtn: document.getElementById("genRemedialBtn"),
  submitRemedialBtn: document.getElementById("submitRemedialBtn"),
  addRemedialCharsBtn: document.getElementById("addRemedialCharsBtn"),
  remedialForm: document.getElementById("remedialForm"),
  remedialResult: document.getElementById("remedialResult"),
  actionTip: document.getElementById("actionTip"),
};

const store = window.LearningStore;
const books = Array.isArray(window.PRIMARY_TEXTBOOK_LIBRARY) ? window.PRIMARY_TEXTBOOK_LIBRARY : [];
const sceneMetaSource = window.PRIMARY_TEXTBOOK_SCENE_META;
const sceneMetaMap =
  sceneMetaSource && typeof sceneMetaSource === "object" && !Array.isArray(sceneMetaSource)
    ? sceneMetaSource
    : {};
const hanziLib = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const PROGRESS_KEY = "primaryTextbookProgressV1";
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  grade: "",
  term: "",
  filteredLessons: [],
  selectedLessonId: "",
  progress: {
    completedLessons: {},
    taskChecks: {},
    quizScores: {},
    readingReports: {},
    remedialScores: {},
    updatedAt: 0,
  },
  quizBank: {},
  remedialBank: {},
  quizWeakChars: [],
  readingWeakChars: [],
  remedialWeakChars: [],
  reading: {
    supported: false,
    recognition: null,
    listening: false,
  },
};

const hanziMap = new Map(
  hanziLib
    .filter((item) => item && typeof item === "object" && item.char)
    .map((item) => [
      item.char,
      {
        pinyin: item.pinyin || "",
        meaning: item.meaning || "",
      },
    ])
);

const allLessons = books.flatMap((grade) =>
  (grade.terms || []).flatMap((term) =>
    (term.lessons || []).map((lesson) => {
      const lessonId = String(lesson?.id || "");
      const manualSceneMeta =
        sceneMetaMap[lessonId] && typeof sceneMetaMap[lessonId] === "object" ? sceneMetaMap[lessonId] : null;
      return {
        ...lesson,
        _gradeLabel: grade.label || `${grade.grade}年级`,
        _term: term.term || "",
        _unitTitle: term.unitTitle || "",
        _sceneMeta: manualSceneMeta,
      };
    })
  )
);

const allMeaningPool = [...new Set(allLessons.flatMap((lesson) => (lesson.keywords || []).map((item) => item.meaning || "")))].filter(
  Boolean
);
const allSentencePool = [...new Set(allLessons.flatMap((lesson) => lesson.text || []))].filter(Boolean);
const allPinyinPool = [...new Set([...hanziMap.values()].map((item) => item.pinyin || ""))].filter(Boolean);
const allKeywordWords = [...new Set(allLessons.flatMap((lesson) => (lesson.keywords || []).map((item) => item.word || "")))].filter(
  Boolean
);
const allHanziPool = [...new Set(hanziLib.map((item) => item?.char).filter((char) => isHanChar(char)))];
const LESSON_SCENE_THEMES = [
  {
    id: "campus",
    label: "校园课堂",
    tokens: ["校园", "教室", "老师", "值日", "值日生", "同学", "书包", "课堂", "合作", "积木"],
    skyA: "#dbeafe",
    skyB: "#eef6ff",
    ground: "#d1fae5",
    accent: "#60a5fa",
    decor: "school",
    outfit: "#2563eb",
  },
  {
    id: "park",
    label: "公园自然",
    tokens: ["春", "秋", "公园", "自然", "树", "花", "风筝", "种子", "传播", "叶"],
    skyA: "#d9f99d",
    skyB: "#e7f8cf",
    ground: "#bbf7d0",
    accent: "#65a30d",
    decor: "park",
    outfit: "#16a34a",
  },
  {
    id: "home",
    label: "家庭生活",
    tokens: ["家", "妈妈", "爸爸", "早饭", "早餐", "早晨", "家庭"],
    skyA: "#fef3c7",
    skyB: "#fff7df",
    ground: "#fde68a",
    accent: "#f59e0b",
    decor: "home",
    outfit: "#f97316",
  },
  {
    id: "sports",
    label: "操场活动",
    tokens: ["操场", "跑步", "跳绳", "比赛", "运动"],
    skyA: "#bfdbfe",
    skyB: "#e7f1ff",
    ground: "#bae6fd",
    accent: "#0284c7",
    decor: "sports",
    outfit: "#0369a1",
  },
  {
    id: "night",
    label: "夜空想象",
    tokens: ["月亮", "夜晚", "星", "故事"],
    skyA: "#1e3a8a",
    skyB: "#172554",
    ground: "#1e293b",
    accent: "#facc15",
    decor: "night",
    outfit: "#facc15",
  },
  {
    id: "culture",
    label: "文化表达",
    tokens: ["阅读", "写作", "观点", "礼貌", "诚信", "合作", "节日", "成长", "毕业", "寄语", "未来", "讨论", "争论", "倾听", "表达", "条理", "感恩"],
    skyA: "#ddd6fe",
    skyB: "#ede9fe",
    ground: "#e9d5ff",
    accent: "#7c3aed",
    decor: "culture",
    outfit: "#7c3aed",
  },
  {
    id: "science",
    label: "科学观察",
    tokens: ["科学", "实验", "河流", "年轮", "观察", "记录", "日记", "声音"],
    skyA: "#cffafe",
    skyB: "#e6fcff",
    ground: "#bae6fd",
    accent: "#0ea5e9",
    decor: "science",
    outfit: "#0284c7",
  },
];

function isHanChar(char) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
}

function toHanChars(text) {
  return [...String(text || "")].filter((char) => isHanChar(char));
}

function uniqueArray(list) {
  return [...new Set((list || []).filter(Boolean))];
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomDistinct(list, count, excludes) {
  const excludeSet = excludes instanceof Set ? excludes : new Set(excludes || []);
  const source = list.filter((item) => item && !excludeSet.has(item));
  return shuffle(source).slice(0, Math.max(0, count));
}

function createProgressDefaults() {
  return {
    completedLessons: {},
    taskChecks: {},
    quizScores: {},
    readingReports: {},
    remedialScores: {},
    updatedAt: 0,
  };
}

function safeReadProgress() {
  const defaults = createProgressDefaults();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return {
      completedLessons:
        parsed?.completedLessons && typeof parsed.completedLessons === "object"
          ? parsed.completedLessons
          : defaults.completedLessons,
      taskChecks: parsed?.taskChecks && typeof parsed.taskChecks === "object" ? parsed.taskChecks : defaults.taskChecks,
      quizScores: parsed?.quizScores && typeof parsed.quizScores === "object" ? parsed.quizScores : defaults.quizScores,
      readingReports:
        parsed?.readingReports && typeof parsed.readingReports === "object"
          ? parsed.readingReports
          : defaults.readingReports,
      remedialScores:
        parsed?.remedialScores && typeof parsed.remedialScores === "object"
          ? parsed.remedialScores
          : defaults.remedialScores,
      updatedAt: Number.isFinite(parsed?.updatedAt) ? parsed.updatedAt : 0,
    };
  } catch (error) {
    return defaults;
  }
}

function saveProgress() {
  try {
    state.progress.updatedAt = Date.now();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
  } catch (error) {
    // ignore storage errors
  }
}

function textIncludes(text, keyword) {
  return String(text || "").toLowerCase().includes(keyword);
}

function normalizeKeyword(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

function normalizeSceneRoleType(roleType) {
  const value = String(roleType || "")
    .trim()
    .toLowerCase();
  if (value === "teacher" || value === "family") {
    return value;
  }
  return "student";
}

function getSceneRoleLabel(roleType) {
  if (roleType === "teacher") {
    return "老师";
  }
  if (roleType === "family") {
    return "家人";
  }
  return "学生";
}

function getLessonSceneKeywords(lesson) {
  const fromMeta = Array.isArray(lesson?._sceneMeta?.themeKeywords)
    ? lesson._sceneMeta.themeKeywords
    : [];
  return uniqueArray(
    fromMeta
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
}

function matchThemeByKeywords(keywords) {
  const list = uniqueArray((keywords || []).map((item) => String(item || "").trim()).filter(Boolean));
  if (!list.length) {
    return null;
  }
  return (
    LESSON_SCENE_THEMES.find((theme) =>
      list.some((keyword) => (theme.tokens || []).some((token) => keyword.includes(token) || token.includes(keyword)))
    ) || null
  );
}

function escapeSvgText(text) {
  return String(text || "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return map[char] || char;
  });
}

function resolveLessonSceneTheme(lesson) {
  const manualKeywords = getLessonSceneKeywords(lesson);
  const fromManual = matchThemeByKeywords(manualKeywords);
  if (fromManual) {
    return fromManual;
  }
  const corpus = [
    lesson?.title || "",
    ...(lesson?.text || []),
    ...(lesson?.tasks || []),
    ...(lesson?.keywords || []).map((item) => item.word || ""),
  ]
    .join(" ")
    .trim();
  const matched = LESSON_SCENE_THEMES.find((theme) => (theme.tokens || []).some((token) => token && corpus.includes(token)));
  return matched || LESSON_SCENE_THEMES[0];
}

function buildSceneDecor(theme) {
  if (!theme) {
    return "";
  }
  if (theme.decor === "school") {
    return `
      <rect x="80" y="180" width="260" height="170" rx="14" fill="#ffffff" stroke="#93c5fd" stroke-width="4"/>
      <rect x="102" y="210" width="48" height="36" fill="#bfdbfe"/>
      <rect x="166" y="210" width="48" height="36" fill="#bfdbfe"/>
      <rect x="230" y="210" width="48" height="36" fill="#bfdbfe"/>
      <rect x="158" y="268" width="96" height="82" rx="8" fill="#60a5fa"/>
      <rect x="176" y="120" width="62" height="48" rx="8" fill="#2563eb"/>
    `;
  }
  if (theme.decor === "home") {
    return `
      <polygon points="120,250 250,150 380,250" fill="#fb923c" />
      <rect x="140" y="248" width="220" height="110" rx="10" fill="#fff7ed" stroke="#fdba74" stroke-width="4"/>
      <rect x="232" y="286" width="52" height="72" rx="8" fill="#f59e0b"/>
      <rect x="168" y="272" width="44" height="34" fill="#fde68a"/>
      <rect x="302" y="272" width="44" height="34" fill="#fde68a"/>
    `;
  }
  if (theme.decor === "sports") {
    return `
      <rect x="78" y="286" width="350" height="70" rx="12" fill="#dcfce7" stroke="#4ade80" stroke-width="3"/>
      <line x1="90" y1="322" x2="410" y2="322" stroke="#22c55e" stroke-width="4"/>
      <circle cx="132" cy="252" r="20" fill="#ffffff" stroke="#38bdf8" stroke-width="4"/>
      <circle cx="188" cy="252" r="20" fill="#ffffff" stroke="#38bdf8" stroke-width="4"/>
      <circle cx="244" cy="252" r="20" fill="#ffffff" stroke="#38bdf8" stroke-width="4"/>
    `;
  }
  if (theme.decor === "night") {
    return `
      <circle cx="190" cy="132" r="50" fill="#fde68a"/>
      <circle cx="208" cy="124" r="46" fill="#1e3a8a"/>
      <circle cx="120" cy="76" r="6" fill="#fef08a"/>
      <circle cx="276" cy="84" r="5" fill="#fef08a"/>
      <circle cx="334" cy="128" r="4" fill="#fef08a"/>
      <rect x="80" y="268" width="300" height="88" rx="12" fill="#1f2937" opacity="0.8"/>
    `;
  }
  if (theme.decor === "science") {
    return `
      <path d="M70 318 Q160 282 254 316 T430 316" fill="none" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
      <circle cx="126" cy="248" r="30" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="4"/>
      <rect x="194" y="214" width="64" height="98" rx="14" fill="#f0f9ff" stroke="#38bdf8" stroke-width="4"/>
      <circle cx="300" cy="248" r="22" fill="#cffafe" stroke="#06b6d4" stroke-width="4"/>
    `;
  }
  if (theme.decor === "culture") {
    return `
      <rect x="88" y="208" width="300" height="148" rx="12" fill="#faf5ff" stroke="#a78bfa" stroke-width="4"/>
      <rect x="108" y="230" width="120" height="110" rx="8" fill="#ffffff" stroke="#c4b5fd" stroke-width="3"/>
      <line x1="124" y1="260" x2="208" y2="260" stroke="#c4b5fd" stroke-width="3"/>
      <line x1="124" y1="284" x2="206" y2="284" stroke="#c4b5fd" stroke-width="3"/>
      <rect x="252" y="232" width="118" height="50" rx="10" fill="#ddd6fe"/>
      <rect x="252" y="292" width="118" height="48" rx="10" fill="#c4b5fd"/>
    `;
  }
  return `
    <circle cx="118" cy="168" r="42" fill="#fcd34d"/>
    <rect x="76" y="282" width="340" height="74" rx="12" fill="#bbf7d0" stroke="#86efac" stroke-width="3"/>
    <circle cx="180" cy="244" r="32" fill="#dcfce7" stroke="#4ade80" stroke-width="3"/>
    <circle cx="286" cy="244" r="26" fill="#dcfce7" stroke="#4ade80" stroke-width="3"/>
  `;
}

function buildCartoonRole(theme, roleType) {
  const role = normalizeSceneRoleType(roleType);
  if (role === "teacher") {
    return `
      <g transform="translate(638,190)">
        <ellipse cx="112" cy="224" rx="92" ry="20" fill="#94a3b8" opacity="0.22"/>
        <circle cx="112" cy="88" r="44" fill="#fde68a" stroke="#f59e0b" stroke-width="4"/>
        <circle cx="98" cy="80" r="5" fill="#0f172a"/>
        <circle cx="126" cy="80" r="5" fill="#0f172a"/>
        <rect x="90" y="70" width="16" height="2" fill="#0f172a"/>
        <rect x="120" y="70" width="16" height="2" fill="#0f172a"/>
        <path d="M94 106 Q112 120 130 106" fill="none" stroke="#7c2d12" stroke-width="4" stroke-linecap="round"/>
        <rect x="66" y="130" width="92" height="110" rx="20" fill="${theme.outfit}"/>
        <rect x="58" y="150" width="22" height="78" rx="11" fill="${theme.outfit}"/>
        <rect x="144" y="148" width="22" height="68" rx="11" fill="${theme.outfit}"/>
        <rect x="156" y="120" width="6" height="36" rx="3" fill="#f8fafc"/>
        <rect x="76" y="236" width="24" height="54" rx="10" fill="#334155"/>
        <rect x="124" y="236" width="24" height="54" rx="10" fill="#334155"/>
      </g>
    `;
  }
  if (role === "family") {
    return `
      <g transform="translate(610,202)">
        <ellipse cx="148" cy="220" rx="126" ry="20" fill="#94a3b8" opacity="0.2"/>
        <circle cx="112" cy="92" r="40" fill="#fde68a" stroke="#f59e0b" stroke-width="4"/>
        <circle cx="102" cy="86" r="4.5" fill="#0f172a"/>
        <circle cx="124" cy="86" r="4.5" fill="#0f172a"/>
        <path d="M98 106 Q112 116 126 106" fill="none" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="74" y="126" width="76" height="102" rx="18" fill="${theme.outfit}"/>
        <rect x="82" y="226" width="20" height="54" rx="10" fill="#334155"/>
        <rect x="124" y="226" width="20" height="54" rx="10" fill="#334155"/>

        <circle cx="188" cy="118" r="30" fill="#fde68a" stroke="#f59e0b" stroke-width="3"/>
        <circle cx="180" cy="112" r="4" fill="#0f172a"/>
        <circle cx="197" cy="112" r="4" fill="#0f172a"/>
        <path d="M178 130 Q188 138 198 130" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>
        <rect x="160" y="146" width="58" height="76" rx="16" fill="#f97316"/>
        <rect x="166" y="220" width="16" height="44" rx="8" fill="#475569"/>
        <rect x="196" y="220" width="16" height="44" rx="8" fill="#475569"/>
      </g>
    `;
  }
  return `
    <g transform="translate(650,205)">
      <ellipse cx="98" cy="208" rx="88" ry="20" fill="#94a3b8" opacity="0.25"/>
      <circle cx="98" cy="84" r="44" fill="#fde68a" stroke="#f59e0b" stroke-width="4"/>
      <circle cx="84" cy="76" r="5" fill="#0f172a"/>
      <circle cx="112" cy="76" r="5" fill="#0f172a"/>
      <path d="M80 98 Q98 112 116 98" fill="none" stroke="#7c2d12" stroke-width="4" stroke-linecap="round"/>
      <rect x="52" y="128" width="92" height="108" rx="22" fill="${theme.outfit}"/>
      <rect x="44" y="146" width="22" height="70" rx="11" fill="${theme.outfit}"/>
      <rect x="130" y="146" width="22" height="70" rx="11" fill="${theme.outfit}"/>
      <rect x="62" y="232" width="24" height="52" rx="10" fill="#334155"/>
      <rect x="112" y="232" width="24" height="52" rx="10" fill="#334155"/>
      <rect x="58" y="282" width="32" height="12" rx="6" fill="#111827"/>
      <rect x="108" y="282" width="32" height="12" rx="6" fill="#111827"/>
    </g>
  `;
}

function buildLessonSceneAsset(lesson) {
  if (!lesson) {
    return null;
  }
  const manualKeywords = getLessonSceneKeywords(lesson);
  const roleType = normalizeSceneRoleType(lesson?._sceneMeta?.roleType);
  const roleLabel = getSceneRoleLabel(roleType);
  if (lesson.sceneImage) {
    const defaultKeyword = manualKeywords[0] || lesson.keywords?.[0]?.word || lesson._unitTitle || "课文场景";
    return {
      src: String(lesson.sceneImage),
      alt: lesson.sceneAlt || `${lesson.title} 场景图`,
      caption: `场景关键词：${defaultKeyword}｜角色：${roleLabel}（课程定制图）`,
    };
  }
  const theme = resolveLessonSceneTheme(lesson);
  const keyword = manualKeywords[0] || lesson.keywords?.[0]?.word || lesson._unitTitle || "学习场景";
  const keywordLabel = manualKeywords.length ? manualKeywords.join("、") : keyword;
  const titleText = escapeSvgText(lesson.title || "课文场景");
  const metaText = escapeSvgText(`${theme.label} · ${keyword} · ${roleLabel}`);
  const deco = buildSceneDecor(theme);
  const cartoon = buildCartoonRole(theme, roleType);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 560" role="img" aria-label="${titleText}">
      <defs>
        <linearGradient id="sky_${theme.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${theme.skyA}"/>
          <stop offset="100%" stop-color="${theme.skyB}"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="560" fill="url(#sky_${theme.id})"/>
      <rect y="360" width="1000" height="200" fill="${theme.ground}" opacity="0.95"/>
      ${deco}
      ${cartoon}
      <rect x="34" y="28" width="472" height="84" rx="14" fill="#ffffff" opacity="0.86"/>
      <text x="54" y="64" font-size="32" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif" fill="#0f172a">${titleText}</text>
      <text x="54" y="94" font-size="20" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif" fill="#334155">${metaText}</text>
    </svg>
  `;
  return {
    src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    alt: `${lesson.title} 场景图（含卡通人物）`,
    caption: `场景：${theme.label}｜关键词：${keywordLabel}｜角色：${roleLabel}`,
  };
}

function renderLessonScene(lesson) {
  if (!refs.lessonScene) {
    return;
  }
  if (!lesson) {
    refs.lessonScene.innerHTML = `<p class="meta">请选择课文后显示配图。</p>`;
    return;
  }
  const asset = buildLessonSceneAsset(lesson);
  if (!asset?.src) {
    refs.lessonScene.innerHTML = `<p class="meta">当前课文暂无场景图。</p>`;
    return;
  }
  refs.lessonScene.innerHTML = `
    <figure class="scene-figure">
      <img src="${asset.src}" alt="${asset.alt}" loading="lazy" />
      <figcaption>${asset.caption}</figcaption>
    </figure>
  `;
}

function getGradeBook(gradeValue) {
  return books.find((item) => String(item.grade) === String(gradeValue)) || null;
}

function getCurrentLessons() {
  const gradeBook = getGradeBook(state.grade);
  if (!gradeBook) {
    return [];
  }
  const termRows = Array.isArray(gradeBook.terms) ? gradeBook.terms : [];
  const targetTerm = termRows.find((term) => term.term === state.term) || termRows[0];
  if (!targetTerm) {
    return [];
  }
  const search = normalizeKeyword(refs.searchInput.value);
  const rows = (targetTerm.lessons || [])
    .filter((lesson) => lesson && typeof lesson === "object")
    .map((lesson, index) => ({
      ...lesson,
      _unitTitle: targetTerm.unitTitle || "",
      _term: targetTerm.term || "",
      _order: index + 1,
      _gradeLabel: gradeBook.label || `${gradeBook.grade}年级`,
      _sceneMeta:
        sceneMetaMap[String(lesson.id || "")] && typeof sceneMetaMap[String(lesson.id || "")] === "object"
          ? sceneMetaMap[String(lesson.id || "")]
          : null,
    }));
  if (!search) {
    return rows;
  }
  return rows.filter((lesson) => {
    const keywordCorpus = [
      lesson.title,
      ...(lesson.text || []),
      ...(lesson.focusChars || []),
      ...(lesson.keywords || []).map((item) => `${item.word || ""}${item.meaning || ""}`),
    ]
      .join(" ")
      .toLowerCase();
    return textIncludes(keywordCorpus, search);
  });
}

function collectLessonChars(lesson) {
  const chars = Array.isArray(lesson?.focusChars) ? lesson.focusChars : [];
  return uniqueArray(chars.filter((char) => isHanChar(char)));
}

function getSelectedLesson() {
  return state.filteredLessons.find((item) => item.id === state.selectedLessonId) || null;
}

function isLessonDone(lessonId) {
  return Boolean(state.progress.completedLessons[String(lessonId || "")]);
}

function setLessonDone(lessonId, done) {
  const key = String(lessonId || "");
  if (!key) {
    return;
  }
  if (done) {
    state.progress.completedLessons[key] = true;
  } else {
    delete state.progress.completedLessons[key];
  }
  saveProgress();
}

function getTaskCheckedMap(lessonId) {
  const key = String(lessonId || "");
  const map = state.progress.taskChecks[key];
  return map && typeof map === "object" ? map : {};
}

function setTaskChecked(lessonId, taskIndex, checked) {
  const lessonKey = String(lessonId || "");
  const indexKey = String(taskIndex);
  if (!lessonKey) {
    return;
  }
  const current = getTaskCheckedMap(lessonKey);
  if (checked) {
    current[indexKey] = true;
  } else {
    delete current[indexKey];
  }
  state.progress.taskChecks[lessonKey] = current;
  saveProgress();
}

function logTextbookActivity(type, payload) {
  if (!store || typeof store.logActivity !== "function") {
    return;
  }
  store.logActivity(type, payload || {});
}

function renderSelectors() {
  refs.gradeSelect.innerHTML = books
    .map((item) => `<option value="${item.grade}">${item.label || `${item.grade}年级`}</option>`)
    .join("");
  if (!books.length) {
    refs.termSelect.innerHTML = `<option value="">暂无课本</option>`;
    return;
  }
  if (!state.grade) {
    state.grade = String(books[0].grade);
  }
  refs.gradeSelect.value = state.grade;

  const gradeBook = getGradeBook(state.grade);
  const terms = gradeBook?.terms || [];
  refs.termSelect.innerHTML = terms.map((item) => `<option value="${item.term}">${item.term}</option>`).join("");
  if (!state.term || !terms.some((item) => item.term === state.term)) {
    state.term = terms[0]?.term || "";
  }
  refs.termSelect.value = state.term;
}

function renderCatalog() {
  refs.catalogList.innerHTML = "";
  state.filteredLessons = getCurrentLessons();
  if (!state.filteredLessons.length) {
    refs.catalogMeta.textContent = "当前筛选下暂无课文。";
    refs.catalogList.innerHTML = `<p class="meta">请调整年级、学期或关键词。</p>`;
    return;
  }
  refs.catalogMeta.textContent = `共 ${state.filteredLessons.length} 课`;

  if (!state.filteredLessons.some((item) => item.id === state.selectedLessonId)) {
    state.selectedLessonId = state.filteredLessons[0].id;
  }

  state.filteredLessons.forEach((lesson, idx) => {
    const node = document.createElement("div");
    node.className = `catalog-item${lesson.id === state.selectedLessonId ? " active" : ""}`;
    const doneText = isLessonDone(lesson.id) ? "已掌握" : "待学习";
    node.innerHTML = `
      <p class="catalog-title">${idx + 1}. ${lesson.title}</p>
      <p class="catalog-sub">${lesson._term} · ${lesson._unitTitle || "语文单元"} · ${doneText}</p>
    `;
    node.addEventListener("click", () => {
      if (state.reading.listening) {
        stopReadingRecord();
      }
      state.selectedLessonId = lesson.id;
      renderAll();
    });
    refs.catalogList.appendChild(node);
  });
}

function renderProgress() {
  const gradeBook = getGradeBook(state.grade);
  const allGradeLessons = (gradeBook?.terms || []).flatMap((term) => term.lessons || []);
  const doneCount = allGradeLessons.filter((item) => isLessonDone(item.id)).length;
  const total = allGradeLessons.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  const currentTermDone = state.filteredLessons.filter((item) => isLessonDone(item.id)).length;
  const quizRows = Object.values(state.progress.quizScores || {}).filter((item) => item && item.passed).length;
  const readingRows = Object.values(state.progress.readingReports || {}).filter((item) => item && Number(item.score) >= 80).length;
  const remedialRows = Object.values(state.progress.remedialScores || {}).filter((item) => item && item.passed).length;
  const latestTs = Number(state.progress.updatedAt) || 0;
  refs.progressBox.innerHTML = `
    <p>当前年级：<strong>${gradeBook?.label || "-"}</strong></p>
    <p>年级完成：<strong class="${percent >= 70 ? "ok-text" : ""}">${doneCount}/${total}</strong>（${percent}%）</p>
    <p>当前学期完成：<strong>${currentTermDone}/${state.filteredLessons.length || 0}</strong></p>
    <p>小测达标课次：<strong>${quizRows}</strong></p>
    <p>朗读达标课次：<strong>${readingRows}</strong></p>
    <p>复习小卷达标课次：<strong>${remedialRows}</strong></p>
    <p>最近更新：${latestTs ? new Date(latestTs).toLocaleString("zh-CN") : "暂无"}</p>
  `;
}

function renderLessonText(lesson) {
  refs.lessonText.innerHTML = "";
  (lesson.text || []).forEach((line) => {
    const row = document.createElement("div");
    row.className = "tian-line";
    [...String(line || "")].forEach((char) => {
      const cell = document.createElement("span");
      cell.className = `tian-cell ${isHanChar(char) ? "han" : "punc"}`;
      cell.textContent = char;
      row.appendChild(cell);
    });
    refs.lessonText.appendChild(row);
  });
}

function renderFocusChars(lesson) {
  refs.focusChars.innerHTML = "";
  const chars = collectLessonChars(lesson);
  if (!chars.length) {
    refs.focusChars.innerHTML = `<span class="meta">暂无生字。</span>`;
    return;
  }
  chars.forEach((char) => {
    const meta = hanziMap.get(char) || {};
    const card = document.createElement("div");
    card.className = "char-card";
    card.innerHTML = `
      <div class="char">${char}</div>
      <div class="pinyin">${meta.pinyin || "-"}</div>
      <div class="meaning">${meta.meaning ? meta.meaning.slice(0, 12) : "课本生字"}</div>
    `;
    refs.focusChars.appendChild(card);
  });
}

function renderKeywords(lesson) {
  refs.keywordList.innerHTML = "";
  const rows = Array.isArray(lesson.keywords) ? lesson.keywords : [];
  if (!rows.length) {
    refs.keywordList.innerHTML = `<li class="meta">暂无重点词语。</li>`;
    return;
  }
  rows.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.word || ""}：${item.meaning || ""}`;
    refs.keywordList.appendChild(li);
  });
}

function renderQuestions(lesson) {
  refs.questionList.innerHTML = "";
  const rows = Array.isArray(lesson.questions) ? lesson.questions : [];
  if (!rows.length) {
    refs.questionList.innerHTML = `<li class="meta">暂无思考题。</li>`;
    return;
  }
  rows.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    refs.questionList.appendChild(li);
  });
}

function renderTasks(lesson) {
  refs.taskList.innerHTML = "";
  const rows = Array.isArray(lesson.tasks) ? lesson.tasks : [];
  if (!rows.length) {
    refs.taskList.innerHTML = `<p class="meta">暂无任务。</p>`;
    return;
  }
  const checkedMap = getTaskCheckedMap(lesson.id);
  rows.forEach((task, index) => {
    const checked = Boolean(checkedMap[String(index)]);
    const row = document.createElement("div");
    row.className = `task-item${checked ? " done" : ""}`;
    row.innerHTML = `
      <input id="task_${lesson.id}_${index}" type="checkbox" ${checked ? "checked" : ""} />
      <label for="task_${lesson.id}_${index}">${task}</label>
    `;
    row.querySelector("input").addEventListener("change", (event) => {
      const next = Boolean(event.target.checked);
      setTaskChecked(lesson.id, index, next);
      renderTasks(lesson);
      logTextbookActivity("textbook_task_update", {
        lessonId: lesson.id,
        taskIndex: index,
        checked: next,
        grade: state.grade,
      });
    });
    refs.taskList.appendChild(row);
  });
}

function updateActionTip(lesson) {
  const doneText = isLessonDone(lesson.id) ? "当前状态：已掌握 ✅" : "当前状态：待掌握";
  refs.actionTip.textContent = `${lesson._gradeLabel} ${lesson._term} · ${doneText}。建议：先朗读田字格课文，再看段落热力图定位薄弱段，最后完成错字专属复习小卷。`;
}

function makeChoiceQuestion(base) {
  const optionRows = shuffle(base.options.map((text, index) => ({ text, originIndex: index })));
  const answerIndex = optionRows.findIndex((item) => item.originIndex === base.answerIndex);
  return {
    ...base,
    options: optionRows.map((item) => item.text),
    answerIndex,
  };
}

function buildSentenceQuestion(lesson, suffixId) {
  const ownLines = (lesson.text || []).filter(Boolean);
  if (!ownLines.length) {
    return null;
  }
  const correct = ownLines[Math.floor(Math.random() * ownLines.length)];
  const distractors = pickRandomDistinct(allSentencePool, 3, new Set(ownLines.concat([correct])));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `${lesson.id}_sentence_${suffixId}`,
    type: "sentence",
    prompt: "下列哪一句出自本课课文？",
    options: [correct, ...distractors],
    answerIndex: 0,
    relatedChars: collectLessonChars(lesson),
    explain: `正确句：${correct}`,
  });
}

function buildKeywordMeaningQuestion(lesson, keyword, index) {
  if (!keyword?.word || !keyword?.meaning) {
    return null;
  }
  const distractors = pickRandomDistinct(allMeaningPool, 3, new Set([keyword.meaning]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `${lesson.id}_keyword_${index}`,
    type: "keyword",
    prompt: `“${keyword.word}”在本课中的意思最接近哪一项？`,
    options: [keyword.meaning, ...distractors],
    answerIndex: 0,
    relatedChars: uniqueArray(toHanChars(keyword.word)),
    explain: `正确释义：${keyword.meaning}`,
  });
}

function buildPinyinQuestion(lesson, char, index) {
  const pinyin = hanziMap.get(char)?.pinyin || "";
  if (!pinyin) {
    return null;
  }
  const distractors = pickRandomDistinct(allPinyinPool, 3, new Set([pinyin]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `${lesson.id}_pinyin_${index}`,
    type: "pinyin",
    prompt: `“${char}”的正确拼音是：`,
    options: [pinyin, ...distractors],
    answerIndex: 0,
    relatedChars: [char],
    explain: `正确拼音：${char}（${pinyin}）`,
  });
}

function buildLessonQuiz(lesson) {
  const questions = [];
  const sentenceQ = buildSentenceQuestion(lesson, 1);
  if (sentenceQ) {
    questions.push(sentenceQ);
  }
  (lesson.keywords || [])
    .slice(0, 3)
    .forEach((keyword, index) => {
      const q = buildKeywordMeaningQuestion(lesson, keyword, index + 1);
      if (q) {
        questions.push(q);
      }
    });
  collectLessonChars(lesson)
    .slice(0, 2)
    .forEach((char, index) => {
      const q = buildPinyinQuestion(lesson, char, index + 1);
      if (q) {
        questions.push(q);
      }
    });

  let extraIndex = 2;
  while (questions.length < 5) {
    const extra = buildSentenceQuestion(lesson, extraIndex);
    extraIndex += 1;
    if (!extra) {
      break;
    }
    questions.push(extra);
  }
  return questions.slice(0, 6);
}

function getQuizForLesson(lesson, forceNew) {
  if (!lesson) {
    return [];
  }
  if (!forceNew && Array.isArray(state.quizBank[lesson.id]) && state.quizBank[lesson.id].length) {
    return state.quizBank[lesson.id];
  }
  const quiz = buildLessonQuiz(lesson);
  state.quizBank[lesson.id] = quiz;
  return quiz;
}

function renderQuiz(lesson) {
  refs.quizForm.innerHTML = "";
  const quiz = getQuizForLesson(lesson, false);
  if (!quiz.length) {
    refs.quizMeta.textContent = "暂无可生成的小测题。";
    refs.quizResult.textContent = "测评结果：本课题目不足，暂不支持自动判分。";
    return;
  }
  refs.quizMeta.textContent = `本课共 ${quiz.length} 题，提交后自动判分（80 分及以上为达标）。`;
  quiz.forEach((q, idx) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "quiz-item";
    fieldset.dataset.qindex = `${idx}`;
    const optionsHtml = q.options
      .map(
        (option, optionIndex) => `
          <label>
            <input type="radio" name="quiz_${lesson.id}_${idx}" value="${optionIndex}" />
            <span>${option}</span>
          </label>
        `
      )
      .join("");
    fieldset.innerHTML = `
      <legend>${idx + 1}. ${q.prompt}</legend>
      <div class="quiz-options">${optionsHtml}</div>
      <p class="quiz-analysis"></p>
    `;
    refs.quizForm.appendChild(fieldset);
  });
  const last = state.progress.quizScores?.[lesson.id];
  if (last && Number.isFinite(last.score)) {
    refs.quizResult.textContent = `上次成绩：${last.score} 分（${last.correct}/${last.total}），${last.passed ? "已达标" : "待提升"}。`;
  } else {
    refs.quizResult.textContent = "测评结果：待提交。";
  }
}

function submitQuiz() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const quiz = getQuizForLesson(lesson, false);
  if (!quiz.length) {
    return;
  }
  let answered = 0;
  let correct = 0;
  const wrongChars = new Set();
  quiz.forEach((q, idx) => {
    const name = `quiz_${lesson.id}_${idx}`;
    const selected = refs.quizForm.querySelector(`input[name="${name}"]:checked`);
    const fieldset = refs.quizForm.querySelector(`[data-qindex="${idx}"]`);
    const analysis = fieldset?.querySelector(".quiz-analysis");
    fieldset?.classList.remove("correct", "wrong");
    if (!selected) {
      if (analysis) {
        analysis.textContent = `未作答。${q.explain || ""}`;
      }
      fieldset?.classList.add("wrong");
      (q.relatedChars || []).forEach((char) => wrongChars.add(char));
      return;
    }
    answered += 1;
    const selectedIndex = Number.parseInt(selected.value, 10);
    if (selectedIndex === q.answerIndex) {
      correct += 1;
      fieldset?.classList.add("correct");
      if (analysis) {
        analysis.textContent = "回答正确。";
      }
      return;
    }
    fieldset?.classList.add("wrong");
    (q.relatedChars || []).forEach((char) => wrongChars.add(char));
    if (analysis) {
      const right = q.options[q.answerIndex] || "";
      analysis.textContent = `回答错误，正确答案：${right}。`;
    }
  });
  const score = Math.round((correct / quiz.length) * 100);
  const passed = score >= 80;
  state.quizWeakChars = uniqueArray([...wrongChars].filter((char) => isHanChar(char)));
  state.progress.quizScores[lesson.id] = {
    score,
    total: quiz.length,
    correct,
    answered,
    passed,
    weakChars: state.quizWeakChars,
    ts: Date.now(),
  };
  saveProgress();
  refs.quizResult.textContent = `测评结果：${score} 分（答对 ${correct}/${quiz.length}，作答 ${answered}/${quiz.length}）${
    passed ? "，已达标 ✅" : "，建议复习后再测"
  }${state.quizWeakChars.length ? `；错题关联字：${state.quizWeakChars.join("")}` : ""}`;
  logTextbookActivity("textbook_quiz_submit", {
    lessonId: lesson.id,
    grade: state.grade,
    term: state.term,
    score,
    correct,
    total: quiz.length,
    passed,
    weakCount: state.quizWeakChars.length,
  });
  generateRemedialSheet({ source: "quiz_auto" });
  updateActionTip(lesson);
  renderProgress();
}

function addQuizWrongCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const fallback = state.progress.quizScores?.[lesson.id]?.weakChars || [];
  const chars = uniqueArray((state.quizWeakChars.length ? state.quizWeakChars : fallback).filter((char) => isHanChar(char)));
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "当前小测暂无错题字可加入字帖。";
    return;
  }
  const result = store.addWorksheetChars(chars, "textbook_quiz_wrong");
  refs.actionTip.textContent = `已将小测错题字加入字帖：${result.added.join("") || chars.join("")}`;
  logTextbookActivity("textbook_quiz_wrong_to_worksheet", {
    lessonId: lesson.id,
    chars,
    count: chars.length,
  });
}

function renderChipList(items, emptyText) {
  const list = uniqueArray(items);
  if (!list.length) {
    return `<p>${emptyText}</p>`;
  }
  return `<div class="chip-list">${list.map((item) => `<span class="chip">${item}</span>`).join("")}</div>`;
}

function getLessonParagraphRows(lesson) {
  const rows = (lesson.text || [])
    .map((line, index) => {
      const text = String(line || "");
      return {
        index,
        text,
        chars: toHanChars(text),
      };
    })
    .filter((item) => item.chars.length);
  if (rows.length) {
    return rows;
  }
  const fallbackText = String((lesson.text || []).join(""));
  const fallbackChars = toHanChars(fallbackText);
  return fallbackChars.length
    ? [
        {
          index: 0,
          text: fallbackText || "课文段落",
          chars: fallbackChars,
        },
      ]
    : [];
}

function locateParagraphIndexByExpectedPos(boundaries, expectedPos) {
  if (!boundaries.length) {
    return -1;
  }
  const maxPos = Math.max(0, boundaries[boundaries.length - 1].end - 1);
  const target = Math.min(Math.max(0, expectedPos), maxPos);
  for (let i = 0; i < boundaries.length; i += 1) {
    if (target < boundaries[i].end) {
      return i;
    }
  }
  return boundaries.length - 1;
}

function computeParagraphScores(paragraphRows, ops) {
  if (!paragraphRows.length) {
    return [];
  }
  let cursor = 0;
  const boundaries = paragraphRows.map((row) => {
    const start = cursor;
    cursor += row.chars.length;
    return {
      start,
      end: cursor,
    };
  });
  const scores = paragraphRows.map((row, index) => ({
    index,
    text: row.text,
    expectedCount: row.chars.length,
    matched: 0,
    missing: 0,
    substitutions: 0,
    extra: 0,
    weakChars: [],
    problemCount: 0,
    problemRate: 0,
    score: 0,
    coverage: 0,
  }));
  let expectedPos = 0;
  (ops || []).forEach((op) => {
    if (op.type === "ins") {
      const idx = locateParagraphIndexByExpectedPos(boundaries, expectedPos);
      if (idx >= 0) {
        scores[idx].extra += 1;
      }
      return;
    }
    const idx = locateParagraphIndexByExpectedPos(boundaries, expectedPos);
    if (idx >= 0) {
      if (op.type === "equal") {
        scores[idx].matched += 1;
      } else if (op.type === "del") {
        scores[idx].missing += 1;
        if (isHanChar(op.expected)) {
          scores[idx].weakChars.push(op.expected);
        }
      } else if (op.type === "sub") {
        scores[idx].substitutions += 1;
        if (isHanChar(op.expected)) {
          scores[idx].weakChars.push(op.expected);
        }
      }
    }
    expectedPos += 1;
  });
  return scores.map((item) => {
    const problemCount = item.missing + item.substitutions + item.extra;
    const penalty = item.substitutions * 0.35 + item.extra * 0.2;
    const score = Math.max(0, Math.min(100, Math.round(((item.matched - penalty) / Math.max(1, item.expectedCount)) * 100)));
    const heardCount = item.matched + item.substitutions + item.extra;
    const coverage = Math.max(0, Math.round((heardCount / Math.max(1, item.expectedCount)) * 100));
    return {
      ...item,
      score,
      coverage,
      problemCount,
      problemRate: Number((problemCount / Math.max(1, item.expectedCount)).toFixed(3)),
      weakChars: uniqueArray(item.weakChars),
    };
  });
}

function getParagraphHeatLevel(paragraphScore) {
  if (!paragraphScore) {
    return "cold";
  }
  if (paragraphScore.problemRate >= 0.45 || paragraphScore.score < 55) {
    return "hot";
  }
  if (paragraphScore.problemRate >= 0.25 || paragraphScore.score < 75) {
    return "warm";
  }
  return "cold";
}

function renderReadingHeatmap(paragraphScores) {
  if (!refs.paragraphScoreMeta || !refs.readingHeatmap) {
    return;
  }
  if (!Array.isArray(paragraphScores) || !paragraphScores.length) {
    refs.paragraphScoreMeta.textContent = "段落评分：暂无。";
    refs.readingHeatmap.innerHTML = `<p class="meta">热力图：请先进行一次朗读评分。</p>`;
    return;
  }
  const worst = [...paragraphScores].sort((a, b) => b.problemRate - a.problemRate || a.score - b.score)[0];
  refs.paragraphScoreMeta.textContent = `段落评分：问题最多为第 ${worst.index + 1} 段（问题 ${worst.problemCount} 项，得分 ${
    worst.score
  } 分）。`;
  refs.readingHeatmap.innerHTML = paragraphScores
    .map((item) => {
      const level = getParagraphHeatLevel(item);
      const width = Math.max(4, Math.min(100, Math.round(item.problemRate * 100)));
      return `
        <div class="heat-row ${level}">
          <span class="heat-label">第 ${item.index + 1} 段</span>
          <span class="heat-track"><span class="heat-fill" style="width:${width}%"></span></span>
          <span class="heat-meta">${item.score} 分 · 问题 ${item.problemCount}</span>
        </div>
      `;
    })
    .join("");
}

function alignChars(expectedChars, actualChars) {
  const m = expectedChars.length;
  const n = actualChars.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const same = expectedChars[i - 1] === actualChars[j - 1];
      const cost = same ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = expectedChars[i - 1] === actualChars[j - 1];
      const cost = same ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        if (same) {
          ops.push({ type: "equal", char: expectedChars[i - 1] });
        } else {
          ops.push({ type: "sub", expected: expectedChars[i - 1], actual: actualChars[j - 1] });
        }
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: "del", expected: expectedChars[i - 1] });
      i -= 1;
      continue;
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ type: "ins", actual: actualChars[j - 1] });
      j -= 1;
      continue;
    }
    if (i > 0 && j > 0) {
      ops.push({ type: "sub", expected: expectedChars[i - 1], actual: actualChars[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0) {
      ops.push({ type: "del", expected: expectedChars[i - 1] });
      i -= 1;
    } else if (j > 0) {
      ops.push({ type: "ins", actual: actualChars[j - 1] });
      j -= 1;
    }
  }
  ops.reverse();
  return { distance: dp[m][n], ops };
}

function evaluateReadingTranscript(lesson, transcript) {
  const paragraphRows = getLessonParagraphRows(lesson);
  const expectedChars = paragraphRows.flatMap((row) => row.chars);
  const actualChars = toHanChars(transcript || "");
  const aligned = alignChars(expectedChars, actualChars);
  const missing = aligned.ops.filter((op) => op.type === "del").map((op) => op.expected);
  const extra = aligned.ops.filter((op) => op.type === "ins").map((op) => op.actual);
  const substitutions = aligned.ops.filter((op) => op.type === "sub");
  const matched = aligned.ops.filter((op) => op.type === "equal").length;
  const paragraphScores = computeParagraphScores(paragraphRows, aligned.ops);
  const worstParagraph = paragraphScores.length
    ? [...paragraphScores].sort((a, b) => b.problemRate - a.problemRate || a.score - b.score)[0]
    : null;
  const weakChars = uniqueArray([...missing, ...substitutions.map((item) => item.expected)]).filter((char) => isHanChar(char));
  const expectedLen = expectedChars.length || 1;
  const penalty = substitutions.length * 0.35 + extra.length * 0.2;
  const score = Math.max(0, Math.min(100, Math.round(((matched - penalty) / expectedLen) * 100)));
  const coverage = Math.round((actualChars.length / expectedLen) * 100);
  return {
    score,
    expectedCount: expectedChars.length,
    actualCount: actualChars.length,
    matched,
    missing,
    extra,
    substitutions,
    weakChars,
    coverage: Number.isFinite(coverage) ? Math.max(0, coverage) : 0,
    paragraphScores,
    worstParagraph,
  };
}

function renderReadingReport(report) {
  if (!report) {
    refs.readingScoreMeta.textContent = "朗读评分：-";
    renderReadingHeatmap([]);
    refs.readingDiagnosis.innerHTML = `<p>诊断结果：待生成。</p>`;
    return;
  }
  refs.readingScoreMeta.textContent = `朗读评分：${report.score} 分（匹配 ${report.matched}/${report.expectedCount}，识别覆盖 ${report.coverage}%）${
    report.score >= 80 ? "，达标 ✅" : "，建议继续练习"
  }`;
  const subText = report.substitutions.slice(0, 8).map((item) => `${item.expected}→${item.actual}`);
  refs.readingDiagnosis.innerHTML = `
    <p>漏读字：${report.missing.length}</p>
    ${renderChipList(report.missing, "漏读字：无")}
    <p>误读字：${report.substitutions.length}</p>
    ${renderChipList(subText, "误读字：无")}
    <p>增读字：${report.extra.length}</p>
    ${renderChipList(report.extra, "增读字：无")}
  `;
  renderReadingHeatmap(report.paragraphScores || []);
}

function applyReadingScore() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const transcript = String(refs.readingTranscriptInput.value || "").trim();
  if (!transcript) {
    refs.readingScoreMeta.textContent = "朗读评分：请先录音或输入识别文本。";
    return;
  }
  const report = evaluateReadingTranscript(lesson, transcript);
  state.readingWeakChars = report.weakChars;
  state.progress.readingReports[lesson.id] = {
    ...report,
    weakChars: report.weakChars,
    transcript,
    ts: Date.now(),
  };
  saveProgress();
  renderReadingReport(report);
  logTextbookActivity("textbook_reading_assess", {
    lessonId: lesson.id,
    grade: state.grade,
    term: state.term,
    score: report.score,
    missing: report.missing.length,
    substitutions: report.substitutions.length,
    extra: report.extra.length,
    weakCount: report.weakChars.length,
    worstParagraphIndex: Number.isFinite(report.worstParagraph?.index) ? report.worstParagraph.index + 1 : 0,
    paragraphCount: report.paragraphScores?.length || 0,
  });
  generateRemedialSheet({ source: "reading_auto" });
  updateActionTip(lesson);
  renderProgress();
}

function addReadingWeakCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const fallback = state.progress.readingReports?.[lesson.id]?.weakChars || [];
  const chars = uniqueArray((state.readingWeakChars.length ? state.readingWeakChars : fallback).filter((char) => isHanChar(char)));
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "当前朗读暂无错字可加入字帖。";
    return;
  }
  const result = store.addWorksheetChars(chars, "textbook_reading_weak");
  refs.actionTip.textContent = `已将朗读错字加入字帖：${result.added.join("") || chars.join("")}`;
  logTextbookActivity("textbook_reading_weak_to_worksheet", {
    lessonId: lesson.id,
    chars,
    count: chars.length,
  });
}

function getLessonWeakChars(lesson) {
  if (!lesson) {
    return [];
  }
  const quizWeak = state.progress.quizScores?.[lesson.id]?.weakChars || [];
  const readingWeak = state.progress.readingReports?.[lesson.id]?.weakChars || [];
  return uniqueArray([...state.quizWeakChars, ...state.readingWeakChars, ...quizWeak, ...readingWeak].filter((char) => isHanChar(char)));
}

function buildRemedialPinyinQuestion(char, index) {
  const pinyin = hanziMap.get(char)?.pinyin || "";
  if (!pinyin) {
    return null;
  }
  const distractors = pickRandomDistinct(allPinyinPool, 3, new Set([pinyin]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `remedial_pinyin_${char}_${index}`,
    type: "remedial_pinyin",
    prompt: `“${char}”的正确拼音是：`,
    options: [pinyin, ...distractors],
    answerIndex: 0,
    relatedChars: [char],
    explain: `${char}：${pinyin}`,
  });
}

function buildRemedialWordQuestion(lesson, char, index) {
  const lessonWords = (lesson.keywords || []).map((item) => item.word || "").filter((word) => word.includes(char));
  const globalWords = allKeywordWords.filter((word) => word.includes(char));
  const correct = lessonWords[0] || globalWords[0] || "";
  if (!correct) {
    return null;
  }
  const distractorPool = allKeywordWords.filter((word) => word && !word.includes(char));
  const distractors = pickRandomDistinct(distractorPool, 3, new Set([correct]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `remedial_word_${char}_${index}`,
    type: "remedial_word",
    prompt: `下列哪个词语包含“${char}”？`,
    options: [correct, ...distractors],
    answerIndex: 0,
    relatedChars: [char],
    explain: `正确词语：${correct}`,
  });
}

function buildRemedialShapeQuestion(char, index) {
  const distractors = pickRandomDistinct(allHanziPool, 3, new Set([char]));
  if (distractors.length < 2) {
    return null;
  }
  return makeChoiceQuestion({
    id: `remedial_shape_${char}_${index}`,
    type: "remedial_shape",
    prompt: `下列哪个字是“${char}”？`,
    options: [char, ...distractors],
    answerIndex: 0,
    relatedChars: [char],
    explain: `目标字：${char}`,
  });
}

function buildRemedialSheet(lesson, weakCharsInput) {
  const weakChars = uniqueArray((weakCharsInput || []).filter((char) => isHanChar(char))).slice(0, 10);
  const fallbackChars = collectLessonChars(lesson).slice(0, 6);
  const sourceChars = weakChars.length ? weakChars : fallbackChars;
  const questions = [];
  sourceChars.forEach((char, index) => {
    const q = buildRemedialPinyinQuestion(char, index + 1);
    if (q) {
      questions.push(q);
    }
  });
  sourceChars.forEach((char, index) => {
    const q = buildRemedialWordQuestion(lesson, char, index + 1);
    if (q) {
      questions.push(q);
    }
  });
  sourceChars.forEach((char, index) => {
    const q = buildRemedialShapeQuestion(char, index + 1);
    if (q) {
      questions.push(q);
    }
  });
  return {
    lessonId: lesson.id,
    createdAt: Date.now(),
    weakChars,
    sourceChars,
    questions: questions.slice(0, Math.min(12, Math.max(4, sourceChars.length * 2))),
  };
}

function getRemedialSheetForLesson(lesson, forceNew, weakCharsInput) {
  if (!lesson) {
    return null;
  }
  if (!forceNew && state.remedialBank[lesson.id]?.questions?.length) {
    return state.remedialBank[lesson.id];
  }
  const sheet = buildRemedialSheet(lesson, weakCharsInput);
  state.remedialBank[lesson.id] = sheet;
  return sheet;
}

function renderRemedialPanel(lesson) {
  refs.remedialForm.innerHTML = "";
  const weakChars = getLessonWeakChars(lesson);
  const sheet = getRemedialSheetForLesson(lesson, false, weakChars);
  if (!sheet || !sheet.questions.length) {
    refs.remedialMeta.textContent = "本课暂无可生成的复习小卷题目。";
    refs.remedialResult.textContent = "小卷结果：当前无法出题。";
    state.remedialWeakChars = [];
    return;
  }
  state.remedialWeakChars = uniqueArray((sheet.weakChars.length ? sheet.weakChars : sheet.sourceChars).filter((char) => isHanChar(char)));
  refs.remedialMeta.textContent = `小卷共 ${sheet.questions.length} 题，重点字：${
    sheet.sourceChars.join("") || "无"
  }（85 分及以上达标）。`;
  sheet.questions.forEach((q, idx) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "quiz-item";
    fieldset.dataset.rindex = `${idx}`;
    const optionsHtml = q.options
      .map(
        (option, optionIndex) => `
          <label>
            <input type="radio" name="remedial_${lesson.id}_${idx}" value="${optionIndex}" />
            <span>${option}</span>
          </label>
        `
      )
      .join("");
    fieldset.innerHTML = `
      <legend>${idx + 1}. ${q.prompt}</legend>
      <div class="quiz-options">${optionsHtml}</div>
      <p class="quiz-analysis"></p>
    `;
    refs.remedialForm.appendChild(fieldset);
  });
  const last = state.progress.remedialScores?.[lesson.id];
  if (last && Number.isFinite(last.score)) {
    refs.remedialResult.textContent = `上次小卷：${last.score} 分（${last.correct}/${last.total}），${last.passed ? "已达标" : "待提升"}。`;
  } else {
    refs.remedialResult.textContent = "小卷结果：待提交。";
  }
}

function generateRemedialSheet(options) {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return null;
  }
  const source = options?.source || "manual";
  const weakChars = getLessonWeakChars(lesson);
  const sheet = getRemedialSheetForLesson(lesson, true, weakChars);
  renderRemedialPanel(lesson);
  logTextbookActivity("textbook_remedial_generate", {
    lessonId: lesson.id,
    source,
    weakCount: weakChars.length,
    questionCount: sheet?.questions?.length || 0,
  });
  if (source === "manual") {
    refs.remedialResult.textContent = "小卷结果：已重新生成，请提交判分。";
  }
  return sheet;
}

function submitRemedialSheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const sheet = getRemedialSheetForLesson(lesson, false, getLessonWeakChars(lesson));
  if (!sheet?.questions?.length) {
    refs.remedialResult.textContent = "小卷结果：当前无题可判。";
    return;
  }
  let answered = 0;
  let correct = 0;
  const wrongChars = new Set();
  sheet.questions.forEach((q, idx) => {
    const name = `remedial_${lesson.id}_${idx}`;
    const selected = refs.remedialForm.querySelector(`input[name="${name}"]:checked`);
    const fieldset = refs.remedialForm.querySelector(`[data-rindex="${idx}"]`);
    const analysis = fieldset?.querySelector(".quiz-analysis");
    fieldset?.classList.remove("correct", "wrong");
    if (!selected) {
      fieldset?.classList.add("wrong");
      (q.relatedChars || []).forEach((char) => wrongChars.add(char));
      if (analysis) {
        analysis.textContent = `未作答。${q.explain || ""}`;
      }
      return;
    }
    answered += 1;
    const selectedIndex = Number.parseInt(selected.value, 10);
    if (selectedIndex === q.answerIndex) {
      correct += 1;
      fieldset?.classList.add("correct");
      if (analysis) {
        analysis.textContent = "回答正确。";
      }
    } else {
      fieldset?.classList.add("wrong");
      (q.relatedChars || []).forEach((char) => wrongChars.add(char));
      if (analysis) {
        analysis.textContent = `回答错误，正确答案：${q.options[q.answerIndex] || ""}`;
      }
    }
  });
  const total = sheet.questions.length;
  const score = Math.round((correct / Math.max(1, total)) * 100);
  const passed = score >= 85;
  state.remedialWeakChars = uniqueArray([...wrongChars].filter((char) => isHanChar(char)));
  state.progress.remedialScores[lesson.id] = {
    score,
    total,
    correct,
    answered,
    passed,
    wrongChars: state.remedialWeakChars,
    sourceChars: sheet.sourceChars,
    ts: Date.now(),
  };
  saveProgress();
  refs.remedialResult.textContent = `小卷结果：${score} 分（答对 ${correct}/${total}，作答 ${answered}/${total}）${
    passed ? "，已达标 ✅" : "，建议继续针对错字复习"
  }${state.remedialWeakChars.length ? `；错字：${state.remedialWeakChars.join("")}` : ""}`;
  logTextbookActivity("textbook_remedial_submit", {
    lessonId: lesson.id,
    score,
    total,
    correct,
    passed,
    wrongCount: state.remedialWeakChars.length,
  });
  renderProgress();
}

function addRemedialCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const fallback = state.progress.remedialScores?.[lesson.id]?.wrongChars || getLessonWeakChars(lesson);
  const chars = uniqueArray((state.remedialWeakChars.length ? state.remedialWeakChars : fallback).filter((char) => isHanChar(char)));
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "当前小卷暂无错字可加入字帖。";
    return;
  }
  const result = store.addWorksheetChars(chars, "textbook_remedial_weak");
  refs.actionTip.textContent = `已将小卷错字加入字帖：${result.added.join("") || chars.join("")}`;
  logTextbookActivity("textbook_remedial_to_worksheet", {
    lessonId: lesson.id,
    chars,
    count: chars.length,
  });
}

function setupReadingRecognition() {
  state.reading.supported = Boolean(SpeechRecognitionCtor);
  if (!state.reading.supported) {
    refs.readingSupport.textContent = "当前浏览器不支持语音识别。可手动粘贴朗读文本后点击“生成评分”。";
    refs.readingStartBtn.disabled = true;
    refs.readingStopBtn.disabled = true;
    return;
  }
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.reading.listening = true;
    refs.readingSupport.textContent = "录音中：请朗读当前课文，结束后点击“停止录音”。";
  };

  recognition.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i += 1) {
      const piece = event.results[i]?.[0]?.transcript || "";
      text += piece;
    }
    refs.readingTranscriptInput.value = text.trim();
  };

  recognition.onerror = (event) => {
    refs.readingSupport.textContent = `语音识别异常：${event?.error || "unknown"}。可手动粘贴文本进行评分。`;
  };

  recognition.onend = () => {
    state.reading.listening = false;
    refs.readingSupport.textContent = "录音已结束，可点击“生成评分”查看结果。";
  };

  state.reading.recognition = recognition;
  refs.readingSupport.textContent = "点击“开始录音”，朗读课文后系统将自动识别并进行评分诊断。";
}

function startReadingRecord() {
  if (!state.reading.supported || !state.reading.recognition) {
    refs.readingSupport.textContent = "当前浏览器不支持语音识别，请改用手动文本评分。";
    return;
  }
  if (state.reading.listening) {
    return;
  }
  refs.readingTranscriptInput.value = "";
  refs.readingScoreMeta.textContent = "朗读评分：录音中...";
  refs.readingDiagnosis.innerHTML = `<p>诊断结果：录音中，暂未生成。</p>`;
  try {
    state.reading.recognition.start();
  } catch (error) {
    refs.readingSupport.textContent = "语音识别启动失败，请稍后重试。";
  }
}

function stopReadingRecord() {
  if (!state.reading.listening || !state.reading.recognition) {
    return;
  }
  state.reading.recognition.stop();
}

function renderReadingPanel(lesson) {
  const report = state.progress.readingReports?.[lesson.id];
  state.readingWeakChars = uniqueArray(report?.weakChars || []);
  if (report) {
    refs.readingTranscriptInput.value = report.transcript || "";
  } else {
    refs.readingTranscriptInput.value = "";
  }
  renderReadingReport(report || null);
}

function renderQuizPanel(lesson) {
  state.quizWeakChars = uniqueArray(state.progress.quizScores?.[lesson.id]?.weakChars || []);
  renderQuiz(lesson);
}

function renderLessonDetail() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    refs.lessonTitle.textContent = "请选择课文";
    refs.lessonMeta.textContent = "-";
    if (refs.lessonScene) {
      refs.lessonScene.innerHTML = `<p class="meta">请选择课文后显示配图。</p>`;
    }
    refs.lessonText.innerHTML = `<p class="meta">暂无课文内容。</p>`;
    refs.focusChars.innerHTML = "";
    refs.keywordList.innerHTML = "";
    refs.questionList.innerHTML = "";
    refs.taskList.innerHTML = "";
    refs.quizForm.innerHTML = "";
    refs.quizResult.textContent = "测评结果：-";
    refs.readingScoreMeta.textContent = "朗读评分：-";
    refs.paragraphScoreMeta.textContent = "段落评分：-";
    refs.readingHeatmap.innerHTML = "";
    refs.readingDiagnosis.innerHTML = `<p>诊断结果：-</p>`;
    refs.remedialForm.innerHTML = "";
    refs.remedialMeta.textContent = "基于本课小测错题字与朗读错字自动生成专属复习小卷。";
    refs.remedialResult.textContent = "小卷结果：-";
    return;
  }
  refs.lessonTitle.textContent = lesson.title;
  refs.lessonMeta.textContent = `${lesson._gradeLabel} · ${lesson._term} · ${lesson._unitTitle || "语文单元"}`;
  refs.markDoneBtn.textContent = isLessonDone(lesson.id) ? "取消掌握标记" : "标记本课已掌握";

  renderLessonScene(lesson);
  renderLessonText(lesson);
  renderFocusChars(lesson);
  renderKeywords(lesson);
  renderQuestions(lesson);
  renderTasks(lesson);
  renderQuizPanel(lesson);
  renderReadingPanel(lesson);
  renderRemedialPanel(lesson);
  updateActionTip(lesson);
}

function speakLesson() {
  const lesson = getSelectedLesson();
  if (!lesson || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return;
  }
  const text = [...(lesson.text || []), ...(lesson.questions || []).map((item) => `思考：${item}`)].join(" ");
  if (!text.trim()) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.94;
  window.speechSynthesis.speak(utterance);
}

function toggleLessonDone() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const current = isLessonDone(lesson.id);
  setLessonDone(lesson.id, !current);
  logTextbookActivity("textbook_lesson_done", {
    lessonId: lesson.id,
    done: !current,
    grade: state.grade,
    term: state.term,
  });
  renderAll();
}

function addLessonCharsToWorksheet() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const chars = collectLessonChars(lesson);
  if (!chars.length || !store || typeof store.addWorksheetChars !== "function") {
    refs.actionTip.textContent = "本课暂无可加入字帖的生字。";
    return;
  }
  const result = store.addWorksheetChars(chars, "primary_textbook");
  refs.actionTip.textContent = `已加入字帖收藏：${result.added.join("") || chars.join("")}。可前往字帖工坊打印。`;
  logTextbookActivity("textbook_chars_to_worksheet", {
    lessonId: lesson.id,
    count: chars.length,
    chars,
  });
}

function openWorksheetByLesson() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  const chars = collectLessonChars(lesson);
  const href = chars.length
    ? `./worksheet.html?chars=${encodeURIComponent(chars.join(""))}&source=textbook`
    : "./worksheet.html";
  window.location.href = href;
}

function moveLesson(step) {
  if (!state.filteredLessons.length) {
    return;
  }
  if (state.reading.listening) {
    stopReadingRecord();
  }
  const index = Math.max(
    0,
    state.filteredLessons.findIndex((item) => item.id === state.selectedLessonId)
  );
  const nextIndex = Math.min(state.filteredLessons.length - 1, Math.max(0, index + step));
  state.selectedLessonId = state.filteredLessons[nextIndex].id;
  renderAll();
}

function regenerateQuiz() {
  const lesson = getSelectedLesson();
  if (!lesson) {
    return;
  }
  getQuizForLesson(lesson, true);
  renderQuizPanel(lesson);
  refs.quizResult.textContent = "测评结果：已重新生成题目，请提交判分。";
}

function renderAll() {
  renderCatalog();
  renderProgress();
  renderLessonDetail();
}

function bindEvents() {
  refs.gradeSelect.addEventListener("change", () => {
    state.grade = refs.gradeSelect.value;
    state.term = "";
    renderSelectors();
    renderAll();
  });

  refs.termSelect.addEventListener("change", () => {
    state.term = refs.termSelect.value;
    renderAll();
  });

  refs.searchInput.addEventListener("input", renderAll);
  refs.prevLessonBtn.addEventListener("click", () => moveLesson(-1));
  refs.nextLessonBtn.addEventListener("click", () => moveLesson(1));
  refs.readBtn.addEventListener("click", speakLesson);
  refs.markDoneBtn.addEventListener("click", toggleLessonDone);
  refs.addCharsBtn.addEventListener("click", addLessonCharsToWorksheet);
  refs.goWorksheetBtn.addEventListener("click", openWorksheetByLesson);
  refs.regenQuizBtn?.addEventListener("click", regenerateQuiz);
  refs.submitQuizBtn?.addEventListener("click", submitQuiz);
  refs.addQuizWrongBtn?.addEventListener("click", addQuizWrongCharsToWorksheet);
  refs.readingStartBtn?.addEventListener("click", startReadingRecord);
  refs.readingStopBtn?.addEventListener("click", stopReadingRecord);
  refs.readingScoreBtn?.addEventListener("click", applyReadingScore);
  refs.readingAddWeakBtn?.addEventListener("click", addReadingWeakCharsToWorksheet);
  refs.genRemedialBtn?.addEventListener("click", () => generateRemedialSheet({ source: "manual" }));
  refs.submitRemedialBtn?.addEventListener("click", submitRemedialSheet);
  refs.addRemedialCharsBtn?.addEventListener("click", addRemedialCharsToWorksheet);
}

function bootstrap() {
  state.progress = safeReadProgress();
  if (!books.length) {
    refs.catalogMeta.textContent = "课本数据未加载。";
    refs.catalogList.innerHTML = `<p class="meta">请检查 primary-textbook-data.js。</p>`;
    return;
  }
  state.grade = String(books[0].grade);
  state.term = books[0].terms?.[0]?.term || "";
  renderSelectors();
  setupReadingRecognition();
  bindEvents();
  renderAll();
}

bootstrap();
