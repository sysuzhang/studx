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
  cloudSessionText: document.getElementById("cloudSessionText"),
  cloudSyncMeta: document.getElementById("cloudSyncMeta"),
  cloudSyncTip: document.getElementById("cloudSyncTip"),
  cloudUploadBtn: document.getElementById("cloudUploadBtn"),
  cloudDownloadBtn: document.getElementById("cloudDownloadBtn"),
  cloudRefreshBtn: document.getElementById("cloudRefreshBtn"),
  activityList: document.getElementById("activityList"),
};

const library = Array.isArray(window.HANZI_LIBRARY) ? window.HANZI_LIBRARY : [];
const store = window.LearningStore;
const cloud = window.CloudSync;

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

function quotaSummary(limit, used) {
  if (limit === null) {
    return `${used} / ∞`;
  }
  return `${used}/${limit}`;
}

function setCloudTip(text) {
  if (!refs.cloudSyncTip) {
    return;
  }
  refs.cloudSyncTip.textContent = text;
}

function setCloudButtonsDisabled(disabled) {
  if (refs.cloudUploadBtn) {
    refs.cloudUploadBtn.disabled = disabled;
  }
  if (refs.cloudDownloadBtn) {
    refs.cloudDownloadBtn.disabled = disabled;
  }
}

function formatCloudTime(ts) {
  if (!Number.isFinite(ts) || ts <= 0) {
    return "-";
  }
  return formatTime(ts);
}

async function refreshCloudPanel() {
  if (!refs.cloudSessionText || !refs.cloudSyncMeta) {
    return;
  }
  if (!cloud) {
    refs.cloudSessionText.textContent = "云同步模块未加载。";
    refs.cloudSyncMeta.textContent = "云端状态：不可用";
    setCloudButtonsDisabled(true);
    return;
  }

  refs.cloudSessionText.textContent = "正在同步会话状态...";
  refs.cloudSyncMeta.textContent = "云端状态：查询中...";
  const session = await cloud.getSession();
  if (!session.loggedIn || !session.user) {
    refs.cloudSessionText.textContent = "当前未登录。请先前往登录页完成多用户登录。";
    refs.cloudSyncMeta.textContent = "云端状态：未登录";
    setCloudButtonsDisabled(true);
    return;
  }
  const roleText = session.user.role === "teacher" ? "教师" : "学生";
  refs.cloudSessionText.textContent = `当前云端账号：${session.user.username}（${roleText}）`;
  setCloudButtonsDisabled(false);
  try {
    const status = await cloud.getSyncStatus();
    refs.cloudSyncMeta.textContent = status?.hasSnapshot
      ? `云端状态：已同步，最近更新时间 ${formatCloudTime(status.updatedAt)}（版本 ${status.version || 1}）`
      : "云端状态：暂无同步记录";
  } catch (error) {
    refs.cloudSyncMeta.textContent = `云端状态：读取失败（${error.message}）`;
  }
}

async function uploadCloudProgress() {
  if (!cloud) {
    return;
  }
  setCloudTip("上传中...");
  try {
    const result = await cloud.uploadLocalProgress();
    if (store && typeof store.logActivity === "function") {
      store.logActivity("cloud_sync_upload", {
        version: result.version || 1,
        updatedAt: result.updatedAt || Date.now(),
        source: "user_center",
      });
    }
    setCloudTip(`上传完成：版本 ${result.version}，更新时间 ${formatCloudTime(result.updatedAt)}`);
    renderActivities();
    await refreshCloudPanel();
  } catch (error) {
    setCloudTip(`上传失败：${error.message}`);
  }
}

async function downloadCloudProgress() {
  if (!cloud) {
    return;
  }
  const ok = window.confirm("下载会覆盖当前设备上的学习进度，是否继续？");
  if (!ok) {
    return;
  }
  setCloudTip("下载中...");
  try {
    const result = await cloud.downloadCloudProgress("replace");
    if (!result?.hasSnapshot) {
      setCloudTip("云端暂无可下载数据。");
      await refreshCloudPanel();
      return;
    }
    if (store && typeof store.logActivity === "function") {
      store.logActivity("cloud_sync_download", {
        version: result.version || 1,
        updatedAt: result.updatedAt || Date.now(),
        source: "user_center",
      });
    }
    setCloudTip(`下载完成：已应用 ${result.applied} 项本地数据。`);
    loadProfile();
    renderAll();
    await refreshCloudPanel();
  } catch (error) {
    setCloudTip(`下载失败：${error.message}`);
  }
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
  const keyboardStats = store
    ? store.getKeyboardPracticeStats()
    : { totalSessions: 0, bestAccuracy: 0, averageAccuracy: 0, bestSpeed: 0, averageSpeed: 0, totalHits: 0 };
  const keyboardDailyStats = store
    ? store.getKeyboardDailyTaskStats()
    : { totalDays: 0, completedDays: 0, completionRate: 0, todayCompleted: false, latestCompletedAt: 0 };
  const billing = store && typeof store.getBillingSnapshot === "function" ? store.getBillingSnapshot() : null;
  const currentPlanName = billing?.plan?.name || "基础版";
  const printUsage = billing?.usage?.worksheetPrint || { used: 0, limit: 2 };
  const dictUsage = billing?.usage?.dictionaryLookup || { used: 0, limit: 60 };
  const keyboardAdvancedUnlocked = billing?.features?.keyboardAdvancedLevel ? "已解锁" : "未解锁";
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
      <p class="label">键位练习场次</p>
      <p class="value">${keyboardStats.totalSessions}</p>
    </article>
    <article class="stat">
      <p class="label">键位平均速度</p>
      <p class="value">${keyboardStats.averageSpeed}</p>
    </article>
    <article class="stat">
      <p class="label">键位日任务完成天数</p>
      <p class="value">${keyboardDailyStats.completedDays}</p>
    </article>
    <article class="stat">
      <p class="label">今日键位任务</p>
      <p class="value">${keyboardDailyStats.todayCompleted ? "已完成" : "未完成"}</p>
    </article>
    <article class="stat">
      <p class="label">字帖收藏汉字</p>
      <p class="value">${cart.length}</p>
    </article>
    <article class="stat">
      <p class="label">当前套餐</p>
      <p class="value">${currentPlanName}</p>
    </article>
    <article class="stat">
      <p class="label">今日字帖打印</p>
      <p class="value">${quotaSummary(printUsage.limit, printUsage.used)}</p>
    </article>
    <article class="stat">
      <p class="label">今日字典检索</p>
      <p class="value">${quotaSummary(dictUsage.limit, dictUsage.used)}</p>
    </article>
    <article class="stat">
      <p class="label">键盘进阶关卡</p>
      <p class="value">${keyboardAdvancedUnlocked}</p>
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
  const keyboardStats = store
    ? store.getKeyboardPracticeStats()
    : { totalSessions: 0, bestAccuracy: 0, averageAccuracy: 0, bestSpeed: 0, averageSpeed: 0, totalHits: 0 };
  const keyboardDailyStats = store
    ? store.getKeyboardDailyTaskStats()
    : { totalDays: 0, completedDays: 0, completionRate: 0, todayCompleted: false, latestCompletedAt: 0 };
  const profile = store ? store.getUserProfile() : { targetLevel: "HSK1", dailyMinutes: 20, goals: "" };
  const billing = store && typeof store.getBillingSnapshot === "function" ? store.getBillingSnapshot() : null;
  const learned = calendarStats.learnedChars.length;

  let stage = "启蒙阶段";
  if (learned >= 80) {
    stage = "中级准备阶段";
  } else if (learned >= 30) {
    stage = "基础提升阶段";
  }

  const pron = followStats.total >= 10 ? `${followStats.accuracy}%` : "样本不足";
  const typing = typingStats.totalGames >= 3 ? `${typingStats.averageAccuracy}%` : "样本不足";
  const keyboard = keyboardStats.totalSessions >= 3 ? `${keyboardStats.averageSpeed} 键/分` : "样本不足";
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
    keyboardStats.totalSessions < 3
      ? "建议先进行“键盘操作练习”，优先熟悉 ASDF JKL; 基础键位。"
      : keyboardStats.averageSpeed >= 140
      ? "键位熟练度较好，可在打字闯关中提高节奏并减少跳过。"
      : "键位练习可先用 60 秒短局，重点关注目标按键与对应手指。",
    keyboardDailyStats.todayCompleted
      ? "今日键位任务已完成，可把练习重心切换到分级汉字闯关。"
      : "建议先在打字闯关页完成“每日键位任务”，形成稳定输入习惯。",
    billing?.subscription?.planId === "free"
      ? "你当前使用基础版：如需高频打印字帖或挑战键盘中高级关卡，可在“订阅中心”按需升级。"
      : "你当前已开通进阶版：建议充分使用中高级键位关卡与完整字典释义强化学习效率。",
  ];

  refs.evaluationBox.innerHTML = `
    <h3>当前学习评价：${escapeHtml(stage)}</h3>
    <p>跟读评价：${escapeHtml(pron)}；打字命中率：${escapeHtml(typing)}；键位速度：${escapeHtml(
    keyboard
  )}；累计打卡天数：${calendarStats.activeDays} 天。</p>
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
  if (log.type === "worksheet_export_pdf") {
    return `导出了字帖 PDF（${log.payload?.pages || 0} 页，模板：${log.payload?.templateId || "custom"}）`;
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
  if (log.type === "keyboard_practice_finish") {
    const levelMap = { beginner: "初级", intermediate: "中级", advanced: "高级" };
    const level = levelMap[log.payload?.level] || "练习";
    return `完成键位练习（${level}）：积分 ${log.payload?.score ?? 0}，命中率 ${log.payload?.accuracy ?? 0}% ，速度 ${
      log.payload?.speed ?? 0
    } 键/分`;
  }
  if (log.type === "keyboard_daily_task_done") {
    return `完成每日键位任务：目标命中 ${log.payload?.targetHits ?? 0}，目标速度 ${log.payload?.targetSpeed ?? 0} 键/分`;
  }
  if (log.type === "dictionary_lookup") {
    return `在新华字典查询了汉字：${log.payload?.char || ""}`;
  }
  if (log.type === "billing_plan_change") {
    const planMap = {
      free: "基础版",
      pro_monthly: "进阶版（月）",
      pro_yearly: "进阶版（年）",
    };
    return `套餐变更：${planMap[log.payload?.from] || log.payload?.from || "-"} → ${
      planMap[log.payload?.to] || log.payload?.to || "-"
    }`;
  }
  if (log.type === "billing_paywall_hit") {
    const featureMap = {
      worksheet_print: "字帖打印",
      dictionary_lookup: "字典检索",
      keyboard_advanced_level: "键盘中高级关卡",
      dictionary_advanced: "字典进阶释义",
    };
    return `触发套餐限制：${featureMap[log.payload?.featureKey] || log.payload?.featureKey || "会员功能"}（当前套餐：${
      log.payload?.planId || "free"
    }）`;
  }
  if (log.type === "cloud_sync_upload") {
    return `上传学习进度到云端（版本 ${log.payload?.version || 1}）`;
  }
  if (log.type === "cloud_sync_download") {
    return `从云端下载学习进度（版本 ${log.payload?.version || 1}）`;
  }
  if (log.type === "textbook_lesson_done") {
    return `小学语文课本：${log.payload?.done ? "标记完成" : "取消完成"}课文（${log.payload?.lessonId || ""}）`;
  }
  if (log.type === "textbook_task_update") {
    return `小学语文任务：第 ${Number(log.payload?.taskIndex) + 1 || 1} 项${log.payload?.checked ? "已完成" : "取消完成"}`;
  }
  if (log.type === "textbook_quiz_submit") {
    return `课后小测：得分 ${log.payload?.score || 0}（${log.payload?.passed ? "达标" : "待提升"}）`;
  }
  if (log.type === "textbook_reading_assess") {
    return `课文朗读评分：${log.payload?.score || 0} 分（错字 ${log.payload?.weakCount || 0}）`;
  }
  if (log.type === "textbook_chars_to_worksheet") {
    return `课本生字加入字帖：${log.payload?.count || 0} 字`;
  }
  if (log.type === "textbook_quiz_wrong_to_worksheet" || log.type === "textbook_reading_weak_to_worksheet") {
    return `课本错字加入字帖：${log.payload?.count || 0} 字`;
  }
  if (log.type === "worksheet_workbook_generate") {
    return `生成分级字帖本：${log.payload?.level || ""}（${log.payload?.chars || 0} 字）`;
  }
  if (log.type === "worksheet_workbook_scan") {
    return `完成字帖本扫描评估：达标 ${log.payload?.masteredCount || 0}，未达标 ${log.payload?.weakCount || 0}`;
  }
  if (log.type === "worksheet_workbook_loop_generate") {
    return `循环生成下一册字帖本：携带未达标字 ${log.payload?.weakCarry || 0} 个`;
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
  refs.cloudUploadBtn?.addEventListener("click", uploadCloudProgress);
  refs.cloudDownloadBtn?.addEventListener("click", downloadCloudProgress);
  refs.cloudRefreshBtn?.addEventListener("click", refreshCloudPanel);
}

function bootstrap() {
  if (!store) {
    refs.evaluationBox.innerHTML = `<p class="empty">本地学习存储未启用，用户中心无法加载。</p>`;
    return;
  }
  loadProfile();
  bindEvents();
  renderAll();
  refreshCloudPanel();
}

bootstrap();
