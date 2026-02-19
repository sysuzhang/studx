const refs = {
  keySetSelect: document.getElementById("keySetSelect"),
  keyboardDurationSelect: document.getElementById("keyboardDurationSelect"),
  keyboardLevelSelect: document.getElementById("keyboardLevelSelect"),
  themeSelect: document.getElementById("themeSelect"),
  membershipTip: document.getElementById("membershipTip"),
  keyboardStartBtn: document.getElementById("keyboardStartBtn"),
  keyboardEndBtn: document.getElementById("keyboardEndBtn"),
  dailyTaskApplyBtn: document.getElementById("dailyTaskApplyBtn"),
  scoreValue: document.getElementById("scoreValue"),
  lifeValue: document.getElementById("lifeValue"),
  shieldValue: document.getElementById("shieldValue"),
  comboValue: document.getElementById("comboValue"),
  timerValue: document.getElementById("timerValue"),
  accuracyValue: document.getElementById("accuracyValue"),
  speedValue: document.getElementById("speedValue"),
  destroyedValue: document.getElementById("destroyedValue"),
  missionTitle: document.getElementById("missionTitle"),
  missionDesc: document.getElementById("missionDesc"),
  missionStatus: document.getElementById("missionStatus"),
  bossPanel: document.getElementById("bossPanel"),
  bossTitle: document.getElementById("bossTitle"),
  bossDesc: document.getElementById("bossDesc"),
  bossHp: document.getElementById("bossHp"),
  battlefield: document.getElementById("battlefield"),
  targetLayer: document.getElementById("targetLayer"),
  bulletLayer: document.getElementById("bulletLayer"),
  plane: document.getElementById("plane"),
  battleOverlay: document.getElementById("battleOverlay"),
  streakFx: document.getElementById("streakFx"),
  activeKeyStream: document.getElementById("activeKeyStream"),
  feedbackText: document.getElementById("feedbackText"),
  dailyTaskTitle: document.getElementById("dailyTaskTitle"),
  dailyTaskDesc: document.getElementById("dailyTaskDesc"),
  dailyTaskProgress: document.getElementById("dailyTaskProgress"),
  dailyTaskStatus: document.getElementById("dailyTaskStatus"),
  sessionSummary: document.getElementById("sessionSummary"),
  historyBody: document.getElementById("historyBody"),
  leaderboardBody: document.getElementById("leaderboardBody"),
};

const store = window.LearningStore;
const THEME_STORAGE_KEY = "arenaThemeV1";

const KEY_SETS = {
  home: ["a", "s", "d", "f", "j", "k", "l", ";"],
  pinyin: [..."abcdefghijklmnopqrstuvwxyz"],
  full: [..."abcdefghijklmnopqrstuvwxyz", ";"],
};

const KEY_SET_LABEL = {
  home: "基础键位",
  pinyin: "拼音高频字母",
  full: "全字母+分号",
};

const LEVEL_LABEL = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

const LEVEL_OPTION_LABEL = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

const LEVEL_CONFIG = {
  beginner: {
    spawnRate: 1.2,
    fallMin: 52,
    fallMax: 88,
    startLives: 5,
    hitPoint: 12,
    comboBonus: 1,
    missPenalty: 4,
  },
  intermediate: {
    spawnRate: 1.7,
    fallMin: 68,
    fallMax: 118,
    startLives: 4,
    hitPoint: 15,
    comboBonus: 2,
    missPenalty: 6,
  },
  advanced: {
    spawnRate: 2.15,
    fallMin: 85,
    fallMax: 145,
    startLives: 3,
    hitPoint: 18,
    comboBonus: 3,
    missPenalty: 8,
  },
};

const MISSION_POOL = {
  beginner: [
    {
      title: "连击试飞",
      desc: "单局连击峰值达到 8",
      reward: 70,
      finalOnly: false,
      check: (ctx) => ctx.maxCombo >= 8,
    },
    {
      title: "清障先锋",
      desc: "单局击碎 30 个障碍物",
      reward: 90,
      finalOnly: false,
      check: (ctx) => ctx.destroyed >= 30,
    },
    {
      title: "精准射手",
      desc: "结束时命中率不低于 82%（且击碎≥20）",
      reward: 110,
      finalOnly: true,
      check: (ctx) => ctx.destroyed >= 20 && ctx.accuracy >= 82,
    },
  ],
  intermediate: [
    {
      title: "王牌连击",
      desc: "单局连击峰值达到 14",
      reward: 100,
      finalOnly: false,
      check: (ctx) => ctx.maxCombo >= 14,
    },
    {
      title: "空域净化",
      desc: "单局击碎 55 个障碍物",
      reward: 130,
      finalOnly: false,
      check: (ctx) => ctx.destroyed >= 55,
    },
    {
      title: "极速射控",
      desc: "结束速度不低于 120 键/分",
      reward: 150,
      finalOnly: true,
      check: (ctx) => ctx.destroyed >= 35 && ctx.speed >= 120,
    },
  ],
  advanced: [
    {
      title: "风暴连锁",
      desc: "单局连击峰值达到 20",
      reward: 140,
      finalOnly: false,
      check: (ctx) => ctx.maxCombo >= 20,
    },
    {
      title: "顶级清障",
      desc: "单局击碎 80 个障碍物",
      reward: 180,
      finalOnly: false,
      check: (ctx) => ctx.destroyed >= 80,
    },
    {
      title: "神射之眼",
      desc: "结束命中率不低于 90%（且击碎≥55）",
      reward: 220,
      finalOnly: true,
      check: (ctx) => ctx.destroyed >= 55 && ctx.accuracy >= 90,
    },
  ],
};

const state = {
  running: false,
  timerId: null,
  rafId: null,
  lastFrameTs: 0,
  spawnBuffer: 0,
  keySet: "home",
  level: "beginner",
  duration: 60,
  timeLeft: 60,
  score: 0,
  lives: 5,
  shield: 0,
  combo: 0,
  maxCombo: 0,
  shots: 0,
  hits: 0,
  misses: 0,
  destroyed: 0,
  bonusCount: 0,
  planeX: 0,
  planeWidth: 64,
  lastShotTs: 0,
  rapidUntil: 0,
  freezeUntil: 0,
  mission: null,
  targetSeed: 1,
  bulletSeed: 1,
  bossTargetId: null,
  bossDefeated: 0,
  nextBossDestroyed: 24,
  targets: [],
  bullets: [],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function formatTime(ts) {
  const date = new Date(ts);
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${h}:${min}`;
}

function sanitizeTheme(theme) {
  const allowed = new Set(["default", "night", "neon", "sunset"]);
  return allowed.has(theme) ? theme : "default";
}

function applyTheme(theme, persist) {
  const safe = sanitizeTheme(theme);
  if (safe === "default") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.setAttribute("data-theme", safe);
  }
  if (refs.themeSelect) {
    refs.themeSelect.value = safe;
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, safe);
    } catch (error) {
      // Ignore.
    }
  }
}

function loadTheme() {
  let saved = "default";
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY) || "default";
  } catch (error) {
    saved = "default";
  }
  applyTheme(saved, false);
}

function showStreakFx(text) {
  if (!refs.streakFx) {
    return;
  }
  refs.streakFx.textContent = text;
  refs.streakFx.classList.remove("show");
  void refs.streakFx.offsetWidth;
  refs.streakFx.classList.add("show");
}

function renderBossPanel() {
  if (!refs.bossPanel || !refs.bossTitle || !refs.bossDesc || !refs.bossHp) {
    return;
  }
  if (!state.bossTargetId) {
    refs.bossPanel.classList.add("hidden");
    return;
  }
  const boss = state.targets.find((item) => item.id === state.bossTargetId);
  if (!boss) {
    refs.bossPanel.classList.add("hidden");
    return;
  }
  refs.bossPanel.classList.remove("hidden");
  refs.bossTitle.textContent = `Boss 第 ${state.bossDefeated + 1} 关：${formatKeyLabel(boss.char)}`;
  refs.bossDesc.textContent = `击败可获得高分奖励、时间补给与护盾。`;
  refs.bossHp.textContent = `护甲：${boss.hp}/${boss.maxHp || boss.hp}`;
}

function toDateKey(ts) {
  const date = new Date(Number.isFinite(ts) ? ts : Date.now());
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatKeyLabel(key) {
  return key === ";" ? ";" : String(key ?? "").toUpperCase();
}

function getLevelConfig(level = state.level) {
  return LEVEL_CONFIG[level] || LEVEL_CONFIG.beginner;
}

function getSetChars(setName = state.keySet) {
  return KEY_SETS[setName] || KEY_SETS.home;
}

function getSetLabel(setName) {
  return KEY_SET_LABEL[setName] || "键位练习";
}

function getLevelLabel(levelName) {
  return LEVEL_LABEL[levelName] || "初级";
}

function isAdvancedLevel(levelName) {
  return levelName === "intermediate" || levelName === "advanced";
}

function hasAdvancedLevelAccess() {
  if (!store || typeof store.isFeatureEnabled !== "function") {
    return true;
  }
  return store.isFeatureEnabled("keyboard_advanced_level");
}

function refreshMembershipTip() {
  if (!refs.membershipTip) {
    return;
  }
  if (!store || typeof store.getBillingSnapshot !== "function") {
    refs.membershipTip.textContent = "";
    return;
  }
  const billing = store.getBillingSnapshot();
  const planName = billing?.plan?.name || "基础版";
  if (hasAdvancedLevelAccess()) {
    refs.membershipTip.innerHTML = `当前套餐：<strong>${planName}</strong>，已解锁中级/高级关卡。<a href="./pricing.html">查看订阅方案</a>`;
    return;
  }
  refs.membershipTip.innerHTML = `当前套餐：<strong>${planName}</strong>。中级/高级关卡为进阶版权益，基础版可完整体验初级关卡。<a href="./pricing.html">升级解锁</a>`;
}

function refreshLevelOptions() {
  const enabled = hasAdvancedLevelAccess();
  [...refs.keyboardLevelSelect.options].forEach((option) => {
    const baseLabel = LEVEL_OPTION_LABEL[option.value] || option.textContent;
    if (option.value === "beginner") {
      option.disabled = false;
      option.textContent = baseLabel;
      return;
    }
    option.disabled = !enabled;
    option.textContent = enabled ? baseLabel : `${baseLabel}（会员）`;
  });
  if (!enabled && isAdvancedLevel(refs.keyboardLevelSelect.value)) {
    refs.keyboardLevelSelect.value = "beginner";
  }
}

function setFeedback(type, text) {
  refs.feedbackText.className = `feedback ${type}`.trim();
  refs.feedbackText.textContent = text;
}

function showOverlay(text) {
  refs.battleOverlay.textContent = text;
  refs.battleOverlay.style.display = "block";
}

function hideOverlay() {
  refs.battleOverlay.style.display = "none";
}

function computeStats() {
  const total = state.shots;
  const accuracy = total ? Math.round((state.hits / total) * 100) : 0;
  const elapsedSeconds = state.running
    ? Math.max(1, state.duration - state.timeLeft)
    : Math.max(1, state.duration);
  const speed = Math.round((state.hits / elapsedSeconds) * 60);
  return { total, accuracy, speed };
}

function refreshHud() {
  const { accuracy, speed } = computeStats();
  refs.scoreValue.textContent = `${state.score}`;
  refs.lifeValue.textContent = `${state.lives}`;
  refs.shieldValue.textContent = `${state.shield}`;
  refs.comboValue.textContent = `${state.combo}`;
  refs.timerValue.textContent = `${state.timeLeft}s`;
  refs.accuracyValue.textContent = `${accuracy}%`;
  refs.speedValue.textContent = `${speed}`;
  refs.destroyedValue.textContent = `${state.destroyed}`;
}

function updatePlanePosition() {
  refs.plane.style.left = `${state.planeX}px`;
}

function centerPlane() {
  const width = refs.battlefield.clientWidth || 800;
  state.planeX = (width - state.planeWidth) / 2;
  updatePlanePosition();
}

function movePlaneBy(delta) {
  const width = refs.battlefield.clientWidth || 800;
  state.planeX = clamp(state.planeX + delta, 8, width - state.planeWidth - 8);
  updatePlanePosition();
}

function movePlaneTo(clientX) {
  const rect = refs.battlefield.getBoundingClientRect();
  const width = refs.battlefield.clientWidth || 800;
  const nextX = clientX - rect.left - state.planeWidth / 2;
  state.planeX = clamp(nextX, 8, width - state.planeWidth - 8);
  updatePlanePosition();
}

function getMissionContext() {
  const { accuracy, speed } = computeStats();
  return {
    destroyed: state.destroyed,
    maxCombo: state.maxCombo,
    accuracy,
    speed,
    bonusCount: state.bonusCount,
  };
}

function createMission(level) {
  const pool = MISSION_POOL[level] || MISSION_POOL.beginner;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...picked,
    completed: false,
    awarded: false,
  };
}

function renderMissionPanel() {
  if (!state.mission) {
    refs.missionTitle.textContent = "趣味任务";
    refs.missionDesc.textContent = "-";
    refs.missionStatus.textContent = "状态：待开始";
    return;
  }
  refs.missionTitle.textContent = `${state.mission.title}（奖励 +${state.mission.reward}）`;
  refs.missionDesc.textContent = state.mission.desc;
  refs.missionStatus.textContent = state.mission.completed ? "状态：已完成" : "状态：进行中";
}

function tryCompleteMission(finalPhase) {
  if (!state.mission || state.mission.completed) {
    return;
  }
  if (state.mission.finalOnly && !finalPhase) {
    return;
  }
  if (!state.mission.check(getMissionContext())) {
    return;
  }
  state.mission.completed = true;
  if (!state.mission.awarded) {
    state.score += state.mission.reward;
    state.mission.awarded = true;
    refreshHud();
    setFeedback("ok", `完成趣味任务“${state.mission.title}”，奖励 +${state.mission.reward} 分`);
  }
  renderMissionPanel();
}

function renderTargetContent(target) {
  let tag = "";
  if (target.type === "boss") {
    tag = `Boss ${target.hp}`;
  } else if (target.type === "armored") {
    tag = `装甲${target.hp}`;
  } else if (target.type === "bonus") {
    tag = "加分";
  } else if (target.type === "time") {
    tag = "+时间";
  } else if (target.type === "heal") {
    tag = "+生命";
  } else if (target.type === "freeze") {
    tag = "减速";
  }
  return `<span class="char">${formatKeyLabel(target.char)}</span><span class="tag">${tag}</span>`;
}

function createTargetElement(target) {
  const el = document.createElement("div");
  el.className = `target ${target.type}`;
  el.innerHTML = renderTargetContent(target);
  el.style.width = `${target.size}px`;
  el.style.height = `${target.size}px`;
  return el;
}

function rebuildActiveKeys() {
  const map = new Map();
  state.targets.forEach((target) => {
    map.set(target.char, (map.get(target.char) || 0) + 1);
  });
  refs.activeKeyStream.innerHTML = "";
  if (!map.size) {
    refs.activeKeyStream.innerHTML = `<span class="active-key-chip">暂无</span>`;
    return;
  }
  [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([char, count]) => {
      const chip = document.createElement("span");
      chip.className = "active-key-chip";
      chip.textContent = `${formatKeyLabel(char)} ×${count}`;
      refs.activeKeyStream.appendChild(chip);
    });
}

function removeTargetById(targetId) {
  const idx = state.targets.findIndex((target) => target.id === targetId);
  if (idx < 0) {
    return null;
  }
  const [target] = state.targets.splice(idx, 1);
  if (state.bossTargetId === target.id) {
    state.bossTargetId = null;
    renderBossPanel();
  }
  target.el.remove();
  rebuildActiveKeys();
  return target;
}

function spawnTarget() {
  const set = getSetChars();
  if (!set.length) {
    return;
  }
  if (state.bossTargetId && Math.random() < 0.45) {
    return;
  }
  const conf = getLevelConfig();
  const rand = Math.random();
  let type = "normal";
  let hp = 1;
  if (rand < 0.08) {
    type = "bonus";
  } else if (rand < 0.15) {
    type = "time";
  } else if (rand < 0.22) {
    type = "heal";
  } else if (rand < 0.29) {
    type = "freeze";
  } else if (rand < 0.39) {
    type = "armored";
    hp = 2;
  }

  const char = set[Math.floor(Math.random() * set.length)];
  const size = 50;
  const maxX = Math.max(8, refs.battlefield.clientWidth - size - 8);
  const x = randomRange(8, maxX);
  const y = -56;
  const speed = randomRange(conf.fallMin, conf.fallMax);
  const target = {
    id: state.targetSeed++,
    char,
    type,
    hp,
    x,
    y,
    speed,
    size,
    el: null,
  };
  target.el = createTargetElement(target);
  target.el.style.transform = `translate(${target.x}px, ${target.y}px)`;
  refs.targetLayer.appendChild(target.el);
  state.targets.push(target);
  rebuildActiveKeys();
}

function spawnBossTarget() {
  if (state.bossTargetId || !state.running) {
    return;
  }
  const set = getSetChars();
  if (!set.length) {
    return;
  }
  const conf = getLevelConfig();
  const char = set[Math.floor(Math.random() * set.length)];
  const size = 82;
  const maxX = Math.max(8, refs.battlefield.clientWidth - size - 8);
  const x = randomRange(8, maxX);
  const hpBase = state.level === "advanced" ? 11 : state.level === "intermediate" ? 9 : 7;
  const hp = hpBase + Math.min(4, state.bossDefeated);
  const target = {
    id: state.targetSeed++,
    char,
    type: "boss",
    hp,
    maxHp: hp,
    x,
    y: -96,
    speed: Math.max(42, conf.fallMin * 0.6),
    size,
    el: null,
  };
  target.el = createTargetElement(target);
  target.el.style.transform = `translate(${target.x}px, ${target.y}px)`;
  refs.targetLayer.appendChild(target.el);
  state.targets.push(target);
  state.bossTargetId = target.id;
  rebuildActiveKeys();
  renderBossPanel();
  showStreakFx(`Boss 第${state.bossDefeated + 1}关`);
  setFeedback("warn", `Boss 来袭：击碎 ${formatKeyLabel(char)} 目标护甲 ${hp} 层！`);
}

function spawnBullet(char, offsetX = 0) {
  const y = refs.battlefield.clientHeight - 68;
  const x = state.planeX + state.planeWidth / 2 + offsetX;
  const bullet = {
    id: state.bulletSeed++,
    char,
    x,
    y,
    speed: Date.now() < state.rapidUntil ? 700 : 520,
    el: null,
  };
  const el = document.createElement("div");
  el.className = "bullet";
  el.textContent = formatKeyLabel(char);
  el.style.transform = `translate(${bullet.x}px, ${bullet.y}px)`;
  bullet.el = el;
  refs.bulletLayer.appendChild(el);
  state.bullets.push(bullet);
}

function removeBulletById(bulletId) {
  const idx = state.bullets.findIndex((bullet) => bullet.id === bulletId);
  if (idx < 0) {
    return;
  }
  const [bullet] = state.bullets.splice(idx, 1);
  bullet.el.remove();
}

function findTargetForBullet(char, bulletX, bulletY) {
  const candidates = state.targets.filter((target) => target.char === char);
  if (!candidates.length) {
    return null;
  }
  return candidates.reduce((best, target) => {
    const cx = target.x + target.size / 2;
    const cy = target.y + target.size / 2;
    const dist = Math.abs(cx - bulletX) + Math.abs(cy - bulletY);
    if (!best || dist < best.dist) {
      return { target, dist };
    }
    return best;
  }, null)?.target;
}

function isBulletHitTarget(bullet, target) {
  const tx = target.x + target.size / 2;
  const ty = target.y + target.size / 2;
  return Math.abs(bullet.x - tx) < target.size * 0.42 && Math.abs(bullet.y - ty) < target.size * 0.42;
}

function handleTargetDestroyed(target) {
  const conf = getLevelConfig();
  const pointMap = {
    normal: 12,
    armored: 18,
    bonus: 24,
    time: 16,
    heal: 16,
    freeze: 18,
    boss: 45,
  };
  state.hits += 1;
  state.destroyed += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += (pointMap[target.type] || 12) + state.combo * conf.comboBonus;
  if (state.combo >= 8 && state.combo % 8 === 0) {
    showStreakFx(`${state.combo} 连胜`);
  }

  if (target.type === "boss") {
    state.bossTargetId = null;
    state.bossDefeated += 1;
    const reward = 180 + state.bossDefeated * 25;
    state.score += reward;
    state.timeLeft += 8;
    state.shield = Math.min(3, state.shield + 1);
    state.nextBossDestroyed += 30;
    showStreakFx(`Boss 击破 +${reward}`);
    setFeedback("ok", `Boss 击破！奖励 +${reward}，时间 +8 秒，护盾 +1`);
    renderBossPanel();
  } else if (target.type === "bonus") {
    state.score += 30;
    state.rapidUntil = Date.now() + 6500;
    state.bonusCount += 1;
    setFeedback("ok", "击碎加分目标：开启 6 秒极速火力！");
  } else if (target.type === "time") {
    state.timeLeft += 5;
    setFeedback("ok", "击碎时间补给：+5 秒！");
  } else if (target.type === "heal") {
    state.lives = Math.min(8, state.lives + 1);
    setFeedback("ok", "击碎生命补给：生命 +1！");
  } else if (target.type === "freeze") {
    state.freezeUntil = Date.now() + 4200;
    setFeedback("ok", "击碎减速装置：障碍物减速 4 秒！");
  } else if (target.type === "armored") {
    setFeedback("ok", `装甲目标已击碎：${formatKeyLabel(target.char)}`);
  } else {
    setFeedback("ok", `命中目标：${formatKeyLabel(target.char)}，继续连击！`);
  }

  if (state.combo > 0 && state.combo % 10 === 0) {
    state.shield = Math.min(3, state.shield + 1);
    setFeedback("ok", `连击奖励：获得 1 层护盾（当前 ${state.shield}）`);
  }
  tryCompleteMission(false);
  if (!state.bossTargetId && state.destroyed >= state.nextBossDestroyed) {
    spawnBossTarget();
  }
}

function onBulletHit(targetId) {
  const target = state.targets.find((item) => item.id === targetId);
  if (!target) {
    return;
  }
  target.hp -= 1;
  if (target.hp > 0) {
    target.el.innerHTML = renderTargetContent(target);
    if (target.type === "boss") {
      setFeedback("warn", `Boss 命中：${formatKeyLabel(target.char)} 剩余护甲 ${target.hp}`);
      renderBossPanel();
    } else {
      setFeedback("warn", `命中装甲目标 ${formatKeyLabel(target.char)}，剩余护甲 ${target.hp}`);
    }
    return;
  }
  const removed = removeTargetById(targetId);
  if (removed) {
    handleTargetDestroyed(removed);
  }
}

function handleTargetBreach(targetId) {
  const removed = removeTargetById(targetId);
  if (!removed) {
    return;
  }
  if (removed.type === "boss") {
    state.bossTargetId = null;
    state.combo = 0;
    state.lives -= 2;
    state.nextBossDestroyed += 10;
    setFeedback("bad", `Boss 突破防线：生命 -2（${formatKeyLabel(removed.char)}）`);
    renderBossPanel();
    return;
  }
  state.combo = 0;
  if (state.shield > 0) {
    state.shield -= 1;
    setFeedback("warn", "障碍突破防线，但护盾已抵消伤害。");
    return;
  }
  state.lives -= 1;
  setFeedback("bad", `障碍物 ${formatKeyLabel(removed.char)} 突破，生命 -1`);
}

function updateTargets(delta) {
  const bottomLine = refs.battlefield.clientHeight - 70;
  const speedFactor = Date.now() < state.freezeUntil ? 0.62 : 1;
  for (let idx = state.targets.length - 1; idx >= 0; idx -= 1) {
    const target = state.targets[idx];
    target.y += target.speed * delta * speedFactor;
    target.el.style.transform = `translate(${target.x}px, ${target.y}px)`;
    if (target.y >= bottomLine) {
      handleTargetBreach(target.id);
    }
  }
}

function updateBullets(delta) {
  for (let idx = state.bullets.length - 1; idx >= 0; idx -= 1) {
    const bullet = state.bullets[idx];
    bullet.y -= bullet.speed * delta;

    const lockTarget = findTargetForBullet(bullet.char, bullet.x, bullet.y);
    if (lockTarget) {
      const centerX = lockTarget.x + lockTarget.size / 2;
      bullet.x += (centerX - bullet.x) * Math.min(1, delta * 10);
      if (isBulletHitTarget(bullet, lockTarget)) {
        onBulletHit(lockTarget.id);
        removeBulletById(bullet.id);
        continue;
      }
    }

    if (bullet.y < -24) {
      removeBulletById(bullet.id);
      continue;
    }
    bullet.el.style.transform = `translate(${bullet.x}px, ${bullet.y}px)`;
  }
}

function animate(ts) {
  if (!state.running) {
    return;
  }
  if (!state.lastFrameTs) {
    state.lastFrameTs = ts;
  }
  const delta = Math.min(0.05, (ts - state.lastFrameTs) / 1000);
  state.lastFrameTs = ts;

  const conf = getLevelConfig();
  state.spawnBuffer += delta * conf.spawnRate;
  while (state.spawnBuffer >= 1) {
    spawnTarget();
    state.spawnBuffer -= 1;
  }

  updateTargets(delta);
  updateBullets(delta);
  refreshHud();

  if (state.lives <= 0) {
    endGame("生命耗尽，飞机坠毁");
    return;
  }
  state.rafId = requestAnimationFrame(animate);
}

function getInputChar(rawKey) {
  const key = String(rawKey ?? "").toLowerCase();
  if (key === "；") {
    return ";";
  }
  if (key.length !== 1) {
    return "";
  }
  return /[a-z;]/.test(key) ? key : "";
}

function fireByKey(char) {
  const now = Date.now();
  if (now - state.lastShotTs < 70) {
    return;
  }
  state.lastShotTs = now;
  state.shots += 1;

  const matching = state.targets.filter((target) => target.char === char);
  if (!matching.length) {
    const conf = getLevelConfig();
    state.misses += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score - conf.missPenalty);
    setFeedback("bad", `场上暂无 ${formatKeyLabel(char)} 目标，扣 ${conf.missPenalty} 分`);
    refreshHud();
    return;
  }

  spawnBullet(char, 0);
  if (Date.now() < state.rapidUntil) {
    spawnBullet(char, -8);
    spawnBullet(char, 8);
  }
  setFeedback("warn", `锁定 ${formatKeyLabel(char)} 目标，发射中...`);
}

function endGame(reason) {
  if (!state.running) {
    return;
  }
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  state.bossTargetId = null;
  tryCompleteMission(true);
  const { total, accuracy, speed } = computeStats();
  const missCount = Math.max(0, total - state.hits);

  const record = {
    keySet: state.keySet,
    level: state.level,
    duration: state.duration,
    score: state.score,
    hits: state.hits,
    misses: missCount,
    total,
    accuracy,
    speed,
    maxStreak: state.maxCombo,
    source: "keyboard_air_shooter",
  };
  if (store && typeof store.appendKeyboardPracticeRecord === "function") {
    store.appendKeyboardPracticeRecord(record);
  }

  let dailyTask = null;
  if (store && typeof store.updateKeyboardDailyTaskProgress === "function") {
    dailyTask = store.updateKeyboardDailyTaskProgress(record, toDateKey());
    renderDailyTask(dailyTask);
  }

  refs.sessionSummary.innerHTML = `
    <p>关卡：${getLevelLabel(state.level)}（${getSetLabel(state.keySet)}）</p>
    <p>分数：${state.score}</p>
    <p>击发 / 命中：${total} / ${state.hits}</p>
    <p>击碎目标：${state.destroyed}</p>
    <p>命中率：${accuracy}%</p>
    <p>速度：${speed} 键/分</p>
    <p>连击峰值：${state.maxCombo}</p>
    <p>Boss 击破数：${state.bossDefeated}</p>
    <p>趣味任务：${state.mission?.completed ? "已完成" : "未完成"}</p>
    <p>每日任务：${dailyTask?.completed ? "已完成" : "未完成"}</p>
  `;

  renderHistory();
  renderLeaderboard();
  renderBossPanel();
  showOverlay(`本局结束：${state.score} 分`);
  setFeedback("warn", `${reason}。点击“开始空战”可再来一局。`);
}

function clearField() {
  state.targets.forEach((target) => target.el.remove());
  state.bullets.forEach((bullet) => bullet.el.remove());
  state.targets = [];
  state.bullets = [];
  state.bossTargetId = null;
  refs.targetLayer.innerHTML = "";
  refs.bulletLayer.innerHTML = "";
  rebuildActiveKeys();
  renderBossPanel();
}

function startGame() {
  if (state.running) {
    return;
  }
  state.keySet = refs.keySetSelect.value || "home";
  const desiredLevel = refs.keyboardLevelSelect.value || "beginner";
  if (isAdvancedLevel(desiredLevel) && !hasAdvancedLevelAccess()) {
    if (store && typeof store.consumeFeatureUsage === "function") {
      store.consumeFeatureUsage("keyboard_advanced_level", 1, {
        source: "keyboard_start_game",
      });
    }
    refs.keyboardLevelSelect.value = "beginner";
    state.level = "beginner";
    setFeedback("warn", "中级/高级关卡为进阶版权益，已自动切换到初级。");
  } else {
    state.level = desiredLevel;
  }
  state.duration = Number.parseInt(refs.keyboardDurationSelect.value, 10) || 60;
  state.timeLeft = state.duration;
  state.lastFrameTs = 0;
  state.spawnBuffer = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.shots = 0;
  state.hits = 0;
  state.misses = 0;
  state.destroyed = 0;
  state.bonusCount = 0;
  state.shield = 0;
  state.rapidUntil = 0;
  state.freezeUntil = 0;
  state.lastShotTs = 0;
  state.targetSeed = 1;
  state.bulletSeed = 1;
  state.bossTargetId = null;
  state.bossDefeated = 0;
  state.nextBossDestroyed = 24;
  state.mission = createMission(state.level);
  state.lives = getLevelConfig(state.level).startLives;
  clearField();
  centerPlane();
  renderMissionPanel();
  renderBossPanel();
  hideOverlay();
  refs.sessionSummary.innerHTML = `<p class="empty">本局进行中...</p>`;
  setFeedback("warn", "空战开始：按下已出现字母即可击碎对应障碍物。");

  for (let i = 0; i < 6; i += 1) {
    spawnTarget();
  }
  refreshHud();

  state.running = true;
  state.timerId = setInterval(() => {
    if (!state.running) {
      return;
    }
    state.timeLeft -= 1;
    refreshHud();
    if (state.timeLeft <= 0) {
      endGame("时间到");
    }
  }, 1000);
  state.rafId = requestAnimationFrame(animate);
}

function renderDailyTask(task) {
  if (!task) {
    refs.dailyTaskTitle.textContent = "每日任务不可用";
    refs.dailyTaskDesc.textContent = "当前浏览器未启用本地存储。";
    refs.dailyTaskProgress.textContent = "进度：-";
    refs.dailyTaskStatus.textContent = "状态：-";
    refs.dailyTaskApplyBtn.disabled = true;
    return;
  }
  refs.dailyTaskApplyBtn.disabled = false;
  refs.dailyTaskTitle.textContent = `每日任务（${getLevelLabel(task.level)}）`;
  refs.dailyTaskDesc.textContent = `目标：${getSetLabel(task.keySet)} / ${task.duration}s / 命中≥${task.targetHits} / 命中率≥${
    task.targetAccuracy
  }% / 速度≥${task.targetSpeed}`;
  refs.dailyTaskProgress.textContent = `进度：已练 ${task.sessionCount || 0} 局，最佳命中 ${
    task.bestHits || 0
  }，最佳命中率 ${task.bestAccuracy || 0}% ，最佳速度 ${task.bestSpeed || 0}`;
  refs.dailyTaskStatus.textContent = task.completed
    ? `状态：已完成（${formatTime(task.completedAt || Date.now())}）`
    : "状态：未完成";
}

function normalizeDailyTaskByPlan(task) {
  if (!task || hasAdvancedLevelAccess() || !isAdvancedLevel(task.level)) {
    return task;
  }
  const downgraded = {
    ...task,
    level: "beginner",
    keySet: task.keySet === "full" ? "pinyin" : task.keySet,
    duration: Math.min(task.duration || 60, 90),
    targetHits: Math.min(task.targetHits || 35, 60),
    targetAccuracy: Math.min(task.targetAccuracy || 75, 82),
    targetSpeed: Math.min(task.targetSpeed || 70, 95),
  };
  if (store && typeof store.saveKeyboardDailyTask === "function") {
    return store.saveKeyboardDailyTask(downgraded, task.date);
  }
  return downgraded;
}

function loadDailyTask() {
  if (!store || typeof store.getKeyboardDailyTask !== "function") {
    renderDailyTask(null);
    return null;
  }
  const rawTask = store.getKeyboardDailyTask(toDateKey());
  const task = normalizeDailyTaskByPlan(rawTask);
  renderDailyTask(task);
  return task;
}

function applyDailyTaskSettings() {
  const task = loadDailyTask();
  if (!task) {
    setFeedback("warn", "每日任务暂不可用。");
    return;
  }
  refs.keySetSelect.value = task.keySet;
  refs.keyboardDurationSelect.value = `${task.duration}`;
  const nextLevel = isAdvancedLevel(task.level) && !hasAdvancedLevelAccess() ? "beginner" : task.level;
  refs.keyboardLevelSelect.value = nextLevel;
  if (nextLevel !== task.level) {
    setFeedback("warn", "当前套餐暂不支持中高级日任务，已按初级配置应用。");
    return;
  }
  setFeedback("ok", "已应用每日任务配置，点击“开始空战”即可挑战。");
}

function renderHistory() {
  refs.historyBody.innerHTML = "";
  const rows =
    store && typeof store.getKeyboardPracticeRecords === "function" ? store.getKeyboardPracticeRecords() : [];
  const latest = rows.slice(-12).reverse();
  if (!latest.length) {
    refs.historyBody.innerHTML = `<tr><td colspan="8" class="empty">暂无战绩，开始第一局吧。</td></tr>`;
    return;
  }
  latest.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatTime(item.ts)}</td>
      <td>${getSetLabel(item.keySet)}</td>
      <td>${getLevelLabel(item.level)}</td>
      <td>${item.score || 0}</td>
      <td>${item.hits || 0}</td>
      <td>${item.accuracy || 0}%</td>
      <td>${item.speed || 0}</td>
      <td>${item.maxStreak || 0}</td>
    `;
    refs.historyBody.appendChild(row);
  });
}

function renderLeaderboard() {
  refs.leaderboardBody.innerHTML = "";
  const rows =
    store && typeof store.getKeyboardPracticeRecords === "function" ? store.getKeyboardPracticeRecords() : [];
  const ranked = [...rows]
    .sort(
      (a, b) =>
        (b.score || 0) - (a.score || 0) ||
        (b.hits || 0) - (a.hits || 0) ||
        (b.accuracy || 0) - (a.accuracy || 0)
    )
    .slice(0, 10);
  if (!ranked.length) {
    refs.leaderboardBody.innerHTML = `<tr><td colspan="6" class="empty">暂无排行数据。</td></tr>`;
    return;
  }
  ranked.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>#${index + 1}</td>
      <td>${formatTime(item.ts)}</td>
      <td>${getLevelLabel(item.level)}</td>
      <td>${item.score || 0}</td>
      <td>${item.hits || 0}</td>
      <td>${item.accuracy || 0}%</td>
    `;
    refs.leaderboardBody.appendChild(row);
  });
}

function handleKeydown(event) {
  if (!state.running) {
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    movePlaneBy(-34);
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    movePlaneBy(34);
    return;
  }

  const char = getInputChar(event.key);
  if (!char) {
    return;
  }
  event.preventDefault();
  fireByKey(char);
}

function bindEvents() {
  refs.keyboardStartBtn.addEventListener("click", startGame);
  refs.keyboardEndBtn.addEventListener("click", () => endGame("已手动结束"));
  refs.dailyTaskApplyBtn.addEventListener("click", applyDailyTaskSettings);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", () => {
    if (!state.running) {
      centerPlane();
      return;
    }
    movePlaneBy(0);
  });
  window.addEventListener("focus", () => {
    loadTheme();
    refreshLevelOptions();
    refreshMembershipTip();
  });
  refs.themeSelect?.addEventListener("change", () => {
    applyTheme(refs.themeSelect.value, true);
  });
  refs.battlefield.addEventListener("mousemove", (event) => {
    if (!state.running) {
      return;
    }
    movePlaneTo(event.clientX);
  });
}

function bootstrap() {
  loadTheme();
  bindEvents();
  refreshLevelOptions();
  refreshMembershipTip();
  centerPlane();
  refreshHud();
  renderMissionPanel();
  renderBossPanel();
  loadDailyTask();
  renderHistory();
  renderLeaderboard();
  rebuildActiveKeys();
  showOverlay("点击“开始空战”开始练习");
}

bootstrap();
