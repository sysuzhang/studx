const refs = {
  displayName: document.getElementById("displayName"),
  nativeLanguage: document.getElementById("nativeLanguage"),
  country: document.getElementById("country"),
  targetLevel: document.getElementById("targetLevel"),
  dailyMinutes: document.getElementById("dailyMinutes"),
  goals: document.getElementById("goals"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  profileSavedTip: document.getElementById("profileSavedTip"),
  statsGrid: document.getElementById("statsGrid"),
  evaluationBox: document.getElementById("evaluationBox"),
  cartMeta: document.getElementById("cartMeta"),
  cartChars: document.getElementById("cartChars"),
  openWorksheetBtn: document.getElementById("openWorksheetBtn"),
  clearCartBtn: document.getElementById("clearCartBtn"),
  goWorksheetLink: document.getElementById("goWorksheetLink"),
  activityList: document.getElementById("activityList"),
};

const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const store = window.LearningStore;

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

function formatTime(ts) {
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function saveProfile() {
  if (!store) {
    return;
  }
  const profile = store.saveUserProfile({
    displayName: refs.displayName.value.trim(),
    nativeLanguage: refs.nativeLanguage.value.trim(),
    country: refs.country.value.trim(),
    targetLevel: refs.targetLevel.value,
    dailyMinutes: Math.max(10, Number.parseInt(refs.dailyMinutes.value, 10) || 20),
    goals: refs.goals.value.trim(),
  });
  refs.dailyMinutes.value = profile.dailyMinutes;
  refs.profileSavedTip.textContent = "已保存";
  setTimeout(() => {
    refs.profileSavedTip.textContent = "";
  }, 1600);
  renderAll();
}

function loadProfile() {
  if (!store) {
    return;
  }
  const profile = store.getUserProfile();
  refs.displayName.value = profile.displayName || "";
  refs.nativeLanguage.value = profile.nativeLanguage || "";
  refs.country.value = profile.country || "";
  refs.targetLevel.value = profile.targetLevel || "HSK1";
  refs.dailyMinutes.value = profile.dailyMinutes || 20;
  refs.goals.value = profile.goals || "";
}

function getCalendarStats() {
  const completion = store ? store.getCalendarCompletion() : {};
  const completedTaskIds = Object.keys(completion).filter((key) => completion[key]);
  const completedTaskCount = completedTaskIds.length;
  const learnedChars = store ? store.getLearnedCharsFromCalendar() : [];
  const days = [
    ...new Set(
      completedTaskIds
        .map((key) => String(key).split("|")[0])
        .filter(Boolean)
        .sort()
    ),
  ];

  const today = new Date();
  const toKey = (date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
  const daySet = new Set(days);
  let streak = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  while (daySet.has(toKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { completedTaskCount, learnedChars, activeDays: days.length, streak };
}

function renderStats() {
  const calendarStats = getCalendarStats();
  const followStats = store ? store.getFollowReadingStats() : { total: 0, ok: 0, warn: 0, bad: 0, accuracy: 0 };
  const typingStats = store
    ? store.getTypingGameStats()
    : { totalGames: 0, bestScore: 0, averageScore: 0, averageAccuracy: 0, totalCorrect: 0 };
  const cart = store ? store.getWorksheetCart() : [];
  const progress = library.length
    ? Math.round((calendarStats.learnedChars.length / library.length) * 100)
    : 0;

  refs.statsGrid.innerHTML = `
    <article class="stat">
      <p class="label">字库总汉字</p>
      <p class="value">${library.length}</p>
    </article>
    <article class="stat">
      <p class="label">已打卡汉字</p>
      <p class="value">${calendarStats.learnedChars.length}</p>
    </article>
    <article class="stat">
      <p class="label">累计完成任务</p>
      <p class="value">${calendarStats.completedTaskCount}</p>
    </article>
    <article class="stat">
      <p class="label">连续学习天数</p>
      <p class="value">${calendarStats.streak}</p>
    </article>
    <article class="stat">
      <p class="label">跟读准确率</p>
      <p class="value">${followStats.accuracy}%</p>
    </article>
    <article class="stat">
      <p class="label">打字闯关场次</p>
      <p class="value">${typingStats.totalGames}</p>
    </article>
    <article class="stat">
      <p class="label">打字最高分</p>
      <p class="value">${typingStats.bestScore}</p>
    </article>
    <article class="stat">
      <p class="label">打字平均命中率</p>
      <p class="value">${typingStats.averageAccuracy}%</p>
    </article>
    <article class="stat">
      <p class="label">字帖收藏汉字</p>
      <p class="value">${cart.length}</p>
    </article>
    <article class="stat">
      <p class="label">整体覆盖进度</p>
      <p class="value">${progress}%</p>
    </article>
  `;
}

function evaluateLevel() {
  const calendarStats = getCalendarStats();
  const followStats = store ? store.getFollowReadingStats() : { accuracy: 0, total: 0 };
  const typingStats = store
    ? store.getTypingGameStats()
    : { totalGames: 0, bestScore: 0, averageScore: 0, averageAccuracy: 0, totalCorrect: 0 };
  const profile = store ? store.getUserProfile() : { targetLevel: "HSK1", dailyMinutes: 20, goals: "" };
  const learned = calendarStats.learnedChars.length;

  let stage = "启蒙阶段";
  if (learned >= 80) {
    stage = "中级准备阶段";
  } else if (learned >= 30) {
    stage = "基础提升阶段";
  }

  const pron = followStats.total >= 10 ? `${followStats.accuracy}%` : "样本不足";
  const typing = typingStats.totalGames >= 3 ? `${typingStats.averageAccuracy}%` : "样本不足";
  const gapText =
    profile.targetLevel === "HSK1"
      ? learned >= 50
        ? "已接近 HSK1 基础词汇要求，可加强听说。"
        : "建议继续积累高频基础字，优先完成学习日历任务。"
      : profile.targetLevel === "HSK2"
      ? learned >= 120
        ? "已具备冲刺 HSK2 的字词基础。"
        : "建议继续扩充字词量，并保持每周至少 4 次跟读。"
      : learned >= 220
      ? "字量进展良好，可逐步提升阅读难度。"
      : "建议先稳固基础字量，再推进更高等级目标。";

  const suggestions = [
    `每日建议学习时长：${profile.dailyMinutes || 20} 分钟（可拆分为听读 10 分钟 + 书写 10 分钟）`,
    "每次学习后将重点汉字加入“字帖收藏夹”，当天打印巩固。",
    followStats.total < 8
      ? "先增加跟读次数，系统才能给出更稳定的发音评价。"
      : followStats.accuracy >= 75
      ? "发音表现较好，可增加词组和短句跟读训练。"
      : "建议放慢语速并跟随“朗读当前汉字”多次模仿。",
    typingStats.totalGames < 3
      ? "建议每周至少完成 3 局“打字闯关”，同步提升汉字与拼音输入速度。"
      : typingStats.averageAccuracy >= 80
      ? "打字命中率表现优秀，可提高到 90 秒以上挑战并加入词组题。"
      : "打字练习建议从 60 秒短局开始，优先巩固错题并加入字帖反复书写。",
  ];

  refs.evaluationBox.innerHTML = `
    <h3>当前学习评价：${escapeHtml(stage)}</h3>
    <p>跟读评价：${escapeHtml(pron)}；打字命中率：${escapeHtml(typing)}；累计打卡天数：${
    calendarStats.activeDays
  } 天。</p>
    <p>目标匹配：${escapeHtml(gapText)}</p>
    <h3>个性化建议</h3>
    <ul>${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  `;
}

function renderCart() {
  const chars = store ? store.getWorksheetCart() : [];
  refs.cartMeta.textContent = `已收藏 ${chars.length} 个汉字`;
  refs.goWorksheetLink.href = chars.length
    ? `./worksheet.html?chars=${encodeURIComponent(chars.join(""))}`
    : "./worksheet.html";

  refs.cartChars.innerHTML = "";
  if (!chars.length) {
    refs.cartChars.innerHTML = `<p class="empty">还没有收藏汉字，去分级练习或总览页添加吧。</p>`;
    return;
  }

  chars.forEach((char) => {
    const chip = document.createElement("span");
    chip.className = "char-chip";
    chip.innerHTML = `${escapeHtml(char)} <button type="button" aria-label="移除 ${escapeHtml(
      char
    )}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      store.removeWorksheetChar(char);
      renderAll();
    });
    refs.cartChars.appendChild(chip);
  });
}

function activityMessage(log) {
  if (log.type === "worksheet_add") {
    return `将 ${log.payload?.chars?.join("") || ""} 加入字帖收藏（来源：${log.payload?.source || "unknown"}）`;
  }
  if (log.type === "worksheet_remove") {
    return `从字帖收藏移除汉字：${log.payload?.char || ""}`;
  }
  if (log.type === "worksheet_clear") {
    return "清空了字帖收藏夹";
  }
  if (log.type === "follow_reading") {
    const levelMap = { ok: "匹配", warn: "接近", bad: "待改进" };
    return `完成跟读：${log.payload?.char || ""}（${levelMap[log.payload?.level] || "记录"}）`;
  }
  if (log.type === "calendar_task_done") {
    return `完成学习任务：${log.payload?.char || ""}（${log.payload?.stage || ""}）`;
  }
  if (log.type === "calendar_task_undo") {
    return `取消任务勾选：${log.payload?.char || ""}（${log.payload?.stage || ""}）`;
  }
  if (log.type === "profile_update") {
    return "更新了学习档案";
  }
  if (log.type === "typing_game_finish") {
    const modeText = log.payload?.mode === "pinyin" ? "拼音打字" : "汉字打字";
    return `完成打字闯关（${modeText}）：得分 ${log.payload?.score ?? 0}，命中率 ${
      log.payload?.accuracy ?? 0
    }%`;
  }
  return "完成了一次学习操作";
}

function renderActivities() {
  const logs = store ? store.getActivityLogs(40) : [];
  refs.activityList.innerHTML = "";
  if (!logs.length) {
    refs.activityList.innerHTML = `<li class="empty">暂无学习活动记录。</li>`;
    return;
  }
  logs.forEach((log) => {
    const li = document.createElement("li");
    li.textContent = `${formatTime(log.ts)} - ${activityMessage(log)}`;
    refs.activityList.appendChild(li);
  });
}

function renderAll() {
  renderStats();
  evaluateLevel();
  renderCart();
  renderActivities();
}

function bindEvents() {
  refs.saveProfileBtn.addEventListener("click", saveProfile);
  refs.openWorksheetBtn.addEventListener("click", () => {
    const chars = store ? store.getWorksheetCart() : [];
    const target = chars.length ? `./worksheet.html?chars=${encodeURIComponent(chars.join(""))}` : "./worksheet.html";
    window.location.href = target;
  });
  refs.clearCartBtn.addEventListener("click", () => {
    if (!store) {
      return;
    }
    store.clearWorksheetCart();
    renderAll();
  });
}

function bootstrap() {
  if (!store) {
    refs.evaluationBox.innerHTML = `<p class="empty">本地学习存储未启用，用户中心无法加载。</p>`;
    return;
  }
  loadProfile();
  bindEvents();
  renderAll();
}

bootstrap();
