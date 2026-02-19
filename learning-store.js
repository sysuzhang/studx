(function () {
  const WORKSHEET_CART_KEY = "worksheetCharCartV1";
  const CALENDAR_COMPLETION_KEY = "studyCalendarCompletionV1";
  const FOLLOW_READING_KEY = "followReadingRecordsV1";
  const TYPING_GAME_KEY = "typingGameRecordsV1";
  const KEYBOARD_PRACTICE_KEY = "keyboardPracticeRecordsV1";
  const KEYBOARD_DAILY_TASK_KEY = "keyboardDailyTaskV1";
  const BILLING_SUBSCRIPTION_KEY = "billingSubscriptionPlanV1";
  const BILLING_USAGE_KEY = "billingUsageMeterV1";
  const USER_PROFILE_KEY = "userProfileV1";
  const ACTIVITY_LOG_KEY = "learningActivityLogV1";

  let hanRegex;
  try {
    hanRegex = /\p{Script=Han}/u;
  } catch (error) {
    hanRegex = /[\u3400-\u9fff\uf900-\ufaff]/;
  }

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  const KEYBOARD_DAILY_TEMPLATES = [
    {
      level: "beginner",
      keySet: "home",
      duration: 60,
      targetHits: 35,
      targetAccuracy: 75,
      targetSpeed: 70,
    },
    {
      level: "intermediate",
      keySet: "pinyin",
      duration: 90,
      targetHits: 60,
      targetAccuracy: 82,
      targetSpeed: 100,
    },
    {
      level: "advanced",
      keySet: "full",
      duration: 120,
      targetHits: 90,
      targetAccuracy: 86,
      targetSpeed: 125,
    },
  ];

  const BILLING_PLANS = {
    free: {
      id: "free",
      name: "基础版",
      priceLabel: "¥0",
      cycle: "free",
      description: "保留核心学习价值，适合入门用户。",
      quotas: {
        worksheetPrintDailyLimit: 2,
        dictionaryLookupDailyLimit: 60,
      },
      features: {
        keyboardAdvancedLevel: false,
        dictionaryAdvanced: false,
        prioritySupport: false,
      },
    },
    pro_monthly: {
      id: "pro_monthly",
      name: "进阶版（月）",
      priceLabel: "¥29 / 月",
      cycle: "monthly",
      description: "高频学习者优选，解锁高阶训练与无限打印。",
      quotas: {
        worksheetPrintDailyLimit: null,
        dictionaryLookupDailyLimit: null,
      },
      features: {
        keyboardAdvancedLevel: true,
        dictionaryAdvanced: true,
        prioritySupport: true,
      },
    },
    pro_yearly: {
      id: "pro_yearly",
      name: "进阶版（年）",
      priceLabel: "¥299 / 年",
      cycle: "yearly",
      description: "全年学习方案，折合约 25 元/月。",
      quotas: {
        worksheetPrintDailyLimit: null,
        dictionaryLookupDailyLimit: null,
      },
      features: {
        keyboardAdvancedLevel: true,
        dictionaryAdvanced: true,
        prioritySupport: true,
      },
    },
  };

  function toDateKey(ts) {
    const date = new Date(Number.isFinite(ts) ? ts : Date.now());
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizePlanId(planId) {
    return BILLING_PLANS[planId] ? planId : "free";
  }

  function getPlanById(planId) {
    return BILLING_PLANS[normalizePlanId(planId)];
  }

  function getBillingPlans() {
    return Object.values(BILLING_PLANS).map((plan) => ({
      ...plan,
      quotas: { ...(plan.quotas || {}) },
      features: { ...(plan.features || {}) },
    }));
  }

  function getSubscription() {
    const raw = safeRead(BILLING_SUBSCRIPTION_KEY, {});
    const planId = normalizePlanId(raw?.planId);
    return {
      planId,
      activatedAt: Number.isFinite(raw?.activatedAt) ? raw.activatedAt : 0,
      source: raw?.source || "system",
    };
  }

  function setSubscription(planId, source) {
    const targetId = normalizePlanId(planId);
    const prev = getSubscription();
    const next = {
      planId: targetId,
      activatedAt: Date.now(),
      source: source || "pricing",
    };
    safeWrite(BILLING_SUBSCRIPTION_KEY, next);
    logActivity("billing_plan_change", {
      from: prev.planId,
      to: next.planId,
      source: next.source,
    });
    return next;
  }

  function getBillingUsageMap() {
    const usage = safeRead(BILLING_USAGE_KEY, {});
    return usage && typeof usage === "object" ? usage : {};
  }

  function getUsageValueByDay(featureKey, dateKey) {
    const usage = getBillingUsageMap();
    const day = String(dateKey || toDateKey()).slice(0, 10);
    const row = usage[day];
    if (!row || typeof row !== "object") {
      return 0;
    }
    return Number.isFinite(row[featureKey]) ? row[featureKey] : 0;
  }

  function setUsageValueByDay(featureKey, value, dateKey) {
    const usage = getBillingUsageMap();
    const day = String(dateKey || toDateKey()).slice(0, 10);
    const row = usage[day] && typeof usage[day] === "object" ? usage[day] : {};
    row[featureKey] = value;
    usage[day] = row;
    safeWrite(BILLING_USAGE_KEY, usage);
  }

  function getFeatureDailyLimit(featureKey, planId) {
    const plan = getPlanById(planId);
    if (featureKey === "worksheet_print") {
      return plan.quotas.worksheetPrintDailyLimit;
    }
    if (featureKey === "dictionary_lookup") {
      return plan.quotas.dictionaryLookupDailyLimit;
    }
    return null;
  }

  function isFeatureEnabled(featureKey, planId) {
    const plan = getPlanById(planId || getSubscription().planId);
    if (featureKey === "keyboard_advanced_level") {
      return Boolean(plan.features.keyboardAdvancedLevel);
    }
    if (featureKey === "dictionary_advanced") {
      return Boolean(plan.features.dictionaryAdvanced);
    }
    if (featureKey === "priority_support") {
      return Boolean(plan.features.prioritySupport);
    }
    return true;
  }

  function canUseFeature(featureKey, amount, dateKey) {
    const need = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
    const subscription = getSubscription();
    const plan = getPlanById(subscription.planId);
    const limit = getFeatureDailyLimit(featureKey, subscription.planId);
    const used = getUsageValueByDay(featureKey, dateKey);

    if (featureKey === "keyboard_advanced_level" || featureKey === "dictionary_advanced") {
      const enabled = isFeatureEnabled(featureKey, subscription.planId);
      return {
        ok: enabled,
        featureKey,
        planId: subscription.planId,
        planName: plan.name,
        used: enabled ? 0 : 1,
        limit: enabled ? null : 0,
        remaining: enabled ? Infinity : 0,
      };
    }

    if (limit === null) {
      return {
        ok: true,
        featureKey,
        planId: subscription.planId,
        planName: plan.name,
        used,
        limit: null,
        remaining: Infinity,
      };
    }
    const nextUsed = used + need;
    return {
      ok: nextUsed <= limit,
      featureKey,
      planId: subscription.planId,
      planName: plan.name,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  function consumeFeatureUsage(featureKey, amount, payload) {
    const need = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
    const check = canUseFeature(featureKey, need);
    if (!check.ok) {
      logActivity("billing_paywall_hit", {
        featureKey,
        planId: check.planId,
        limit: check.limit,
        used: check.used,
        source: payload?.source || "unknown",
      });
      return check;
    }
    if (check.limit === null) {
      return check;
    }
    const current = getUsageValueByDay(featureKey, payload?.dateKey);
    const next = current + need;
    setUsageValueByDay(featureKey, next, payload?.dateKey);
    const result = {
      ...check,
      used: next,
      remaining: Math.max(0, check.limit - next),
    };
    return result;
  }

  function getBillingSnapshot() {
    const subscription = getSubscription();
    const plan = getPlanById(subscription.planId);
    const today = toDateKey();
    const worksheetLimit = getFeatureDailyLimit("worksheet_print", subscription.planId);
    const worksheetUsed = getUsageValueByDay("worksheet_print", today);
    const lookupLimit = getFeatureDailyLimit("dictionary_lookup", subscription.planId);
    const lookupUsed = getUsageValueByDay("dictionary_lookup", today);
    return {
      subscription,
      plan,
      today,
      usage: {
        worksheetPrint: {
          used: worksheetUsed,
          limit: worksheetLimit,
          remaining: worksheetLimit === null ? Infinity : Math.max(0, worksheetLimit - worksheetUsed),
        },
        dictionaryLookup: {
          used: lookupUsed,
          limit: lookupLimit,
          remaining: lookupLimit === null ? Infinity : Math.max(0, lookupLimit - lookupUsed),
        },
      },
      features: {
        keyboardAdvancedLevel: isFeatureEnabled("keyboard_advanced_level", subscription.planId),
        dictionaryAdvanced: isFeatureEnabled("dictionary_advanced", subscription.planId),
        prioritySupport: isFeatureEnabled("priority_support", subscription.planId),
      },
    };
  }

  function pickKeyboardDailyTemplate(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    const day = Number.isFinite(date.getTime()) ? date.getDate() : 1;
    return KEYBOARD_DAILY_TEMPLATES[day % KEYBOARD_DAILY_TEMPLATES.length];
  }

  function uniqueHanChars(chars) {
    return [...new Set([...String(chars ?? "")].filter((char) => hanRegex.test(char)))];
  }

  function toHanCharArray(input) {
    if (Array.isArray(input)) {
      return uniqueHanChars(input.join(""));
    }
    return uniqueHanChars(String(input ?? ""));
  }

  function getWorksheetCart() {
    const raw = safeRead(WORKSHEET_CART_KEY, []);
    if (!Array.isArray(raw)) {
      return [];
    }
    return uniqueHanChars(raw.join(""));
  }

  function saveWorksheetCart(chars) {
    const clean = toHanCharArray(chars);
    safeWrite(WORKSHEET_CART_KEY, clean);
    return clean;
  }

  function logActivity(type, payload) {
    const logs = safeRead(ACTIVITY_LOG_KEY, []);
    if (!Array.isArray(logs)) {
      return;
    }
    logs.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      type,
      payload: payload || {},
    });
    const compact = logs.slice(-300);
    safeWrite(ACTIVITY_LOG_KEY, compact);
  }

  function addWorksheetChars(chars, source) {
    const current = getWorksheetCart();
    const incoming = toHanCharArray(chars);
    const merged = [...new Set([...current, ...incoming])];
    saveWorksheetCart(merged);
    if (incoming.length) {
      logActivity("worksheet_add", {
        source: source || "unknown",
        chars: incoming,
        cartSize: merged.length,
      });
    }
    return {
      added: incoming.filter((char) => !current.includes(char)),
      cart: merged,
    };
  }

  function removeWorksheetChar(char) {
    const current = getWorksheetCart();
    const next = current.filter((item) => item !== char);
    saveWorksheetCart(next);
    logActivity("worksheet_remove", { char, cartSize: next.length });
    return next;
  }

  function clearWorksheetCart() {
    saveWorksheetCart([]);
    logActivity("worksheet_clear", {});
    return [];
  }

  function getCalendarCompletion() {
    const completion = safeRead(CALENDAR_COMPLETION_KEY, {});
    return completion && typeof completion === "object" ? completion : {};
  }

  function getLearnedCharsFromCalendar() {
    const completion = getCalendarCompletion();
    return [
      ...new Set(
        Object.keys(completion)
          .filter((key) => completion[key])
          .map((key) => String(key).split("|")[1])
          .filter(Boolean)
      ),
    ];
  }

  function getFollowReadingRecords() {
    const raw = safeRead(FOLLOW_READING_KEY, []);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((item) => item && typeof item === "object");
  }

  function appendFollowReadingRecord(record) {
    const rows = getFollowReadingRecords();
    rows.push({
      ts: Date.now(),
      char: record?.char || "",
      level: record?.level || "unknown",
      transcript: record?.transcript || "",
      source: record?.source || "unknown",
      confidence: Number.isFinite(record?.confidence) ? record.confidence : null,
    });
    const compact = rows.slice(-600);
    safeWrite(FOLLOW_READING_KEY, compact);
    logActivity("follow_reading", {
      char: record?.char || "",
      level: record?.level || "unknown",
      source: record?.source || "unknown",
    });
    return compact;
  }

  function getFollowReadingStats() {
    const rows = getFollowReadingRecords();
    const total = rows.length;
    const ok = rows.filter((row) => row.level === "ok").length;
    const warn = rows.filter((row) => row.level === "warn").length;
    const bad = rows.filter((row) => row.level === "bad").length;
    const accuracy = total ? Math.round((ok / total) * 100) : 0;
    return { total, ok, warn, bad, accuracy };
  }

  function getTypingGameRecords() {
    const rows = safeRead(TYPING_GAME_KEY, []);
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.filter((item) => item && typeof item === "object");
  }

  function appendTypingGameRecord(record) {
    const rows = getTypingGameRecords();
    const item = {
      ts: Date.now(),
      mode: record?.mode || "hanzi",
      score: Number.isFinite(record?.score) ? record.score : 0,
      accuracy: Number.isFinite(record?.accuracy) ? record.accuracy : 0,
      correct: Number.isFinite(record?.correct) ? record.correct : 0,
      total: Number.isFinite(record?.total) ? record.total : 0,
      maxCombo: Number.isFinite(record?.maxCombo) ? record.maxCombo : 0,
      duration: Number.isFinite(record?.duration) ? record.duration : 0,
      wrongChars: Array.isArray(record?.wrongChars) ? toHanCharArray(record.wrongChars) : [],
      source: record?.source || "typing",
    };
    rows.push(item);
    const compact = rows.slice(-300);
    safeWrite(TYPING_GAME_KEY, compact);
    logActivity("typing_game_finish", {
      mode: item.mode,
      score: item.score,
      accuracy: item.accuracy,
      correct: item.correct,
      total: item.total,
      source: item.source,
    });
    return item;
  }

  function getTypingGameStats() {
    const rows = getTypingGameRecords();
    if (!rows.length) {
      return {
        totalGames: 0,
        bestScore: 0,
        averageScore: 0,
        averageAccuracy: 0,
        totalCorrect: 0,
      };
    }
    const totalGames = rows.length;
    const bestScore = Math.max(...rows.map((row) => row.score || 0));
    const sumScore = rows.reduce((sum, row) => sum + (row.score || 0), 0);
    const sumAccuracy = rows.reduce((sum, row) => sum + (row.accuracy || 0), 0);
    const totalCorrect = rows.reduce((sum, row) => sum + (row.correct || 0), 0);
    return {
      totalGames,
      bestScore,
      averageScore: Math.round(sumScore / totalGames),
      averageAccuracy: Math.round(sumAccuracy / totalGames),
      totalCorrect,
    };
  }

  function getKeyboardPracticeRecords() {
    const rows = safeRead(KEYBOARD_PRACTICE_KEY, []);
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.filter((item) => item && typeof item === "object");
  }

  function appendKeyboardPracticeRecord(record) {
    const rows = getKeyboardPracticeRecords();
    const item = {
      ts: Date.now(),
      keySet: record?.keySet || "home",
      level: record?.level || "beginner",
      duration: Number.isFinite(record?.duration) ? record.duration : 60,
      score: Number.isFinite(record?.score) ? record.score : 0,
      hits: Number.isFinite(record?.hits) ? record.hits : 0,
      misses: Number.isFinite(record?.misses) ? record.misses : 0,
      total: Number.isFinite(record?.total) ? record.total : 0,
      accuracy: Number.isFinite(record?.accuracy) ? record.accuracy : 0,
      speed: Number.isFinite(record?.speed) ? record.speed : 0,
      maxStreak: Number.isFinite(record?.maxStreak) ? record.maxStreak : 0,
      source: record?.source || "keyboard_practice",
    };
    rows.push(item);
    const compact = rows.slice(-300);
    safeWrite(KEYBOARD_PRACTICE_KEY, compact);
    logActivity("keyboard_practice_finish", {
      keySet: item.keySet,
      level: item.level,
      score: item.score,
      accuracy: item.accuracy,
      speed: item.speed,
      hits: item.hits,
      total: item.total,
      source: item.source,
    });
    return item;
  }

  function getKeyboardPracticeStats() {
    const rows = getKeyboardPracticeRecords();
    if (!rows.length) {
      return {
        totalSessions: 0,
        bestAccuracy: 0,
        averageAccuracy: 0,
        bestSpeed: 0,
        averageSpeed: 0,
        totalHits: 0,
      };
    }
    const totalSessions = rows.length;
    const bestAccuracy = Math.max(...rows.map((row) => row.accuracy || 0));
    const bestSpeed = Math.max(...rows.map((row) => row.speed || 0));
    const sumAccuracy = rows.reduce((sum, row) => sum + (row.accuracy || 0), 0);
    const sumSpeed = rows.reduce((sum, row) => sum + (row.speed || 0), 0);
    const totalHits = rows.reduce((sum, row) => sum + (row.hits || 0), 0);
    return {
      totalSessions,
      bestAccuracy,
      averageAccuracy: Math.round(sumAccuracy / totalSessions),
      bestSpeed,
      averageSpeed: Math.round(sumSpeed / totalSessions),
      totalHits,
    };
  }

  function getKeyboardDailyTaskMap() {
    const map = safeRead(KEYBOARD_DAILY_TASK_KEY, {});
    return map && typeof map === "object" ? map : {};
  }

  function getKeyboardDailyTask(dateKey) {
    const targetDateKey = String(dateKey || toDateKey()).slice(0, 10);
    const map = getKeyboardDailyTaskMap();
    const template = pickKeyboardDailyTemplate(targetDateKey);
    const saved = map[targetDateKey] && typeof map[targetDateKey] === "object" ? map[targetDateKey] : {};
    return {
      date: targetDateKey,
      level: saved.level || template.level,
      keySet: saved.keySet || template.keySet,
      duration: Number.isFinite(saved.duration) ? saved.duration : template.duration,
      targetHits: Number.isFinite(saved.targetHits) ? saved.targetHits : template.targetHits,
      targetAccuracy: Number.isFinite(saved.targetAccuracy) ? saved.targetAccuracy : template.targetAccuracy,
      targetSpeed: Number.isFinite(saved.targetSpeed) ? saved.targetSpeed : template.targetSpeed,
      sessionCount: Number.isFinite(saved.sessionCount) ? saved.sessionCount : 0,
      bestHits: Number.isFinite(saved.bestHits) ? saved.bestHits : 0,
      bestAccuracy: Number.isFinite(saved.bestAccuracy) ? saved.bestAccuracy : 0,
      bestSpeed: Number.isFinite(saved.bestSpeed) ? saved.bestSpeed : 0,
      completed: Boolean(saved.completed),
      completedAt: Number.isFinite(saved.completedAt) ? saved.completedAt : null,
    };
  }

  function saveKeyboardDailyTask(task, dateKey) {
    const key = String(dateKey || task?.date || toDateKey()).slice(0, 10);
    const map = getKeyboardDailyTaskMap();
    map[key] = {
      ...getKeyboardDailyTask(key),
      ...(task || {}),
      date: key,
    };
    safeWrite(KEYBOARD_DAILY_TASK_KEY, map);
    return map[key];
  }

  function updateKeyboardDailyTaskProgress(result, dateKey) {
    const row = getKeyboardDailyTask(dateKey || toDateKey());
    row.sessionCount += 1;
    row.bestHits = Math.max(row.bestHits, Number.isFinite(result?.hits) ? result.hits : 0);
    row.bestAccuracy = Math.max(row.bestAccuracy, Number.isFinite(result?.accuracy) ? result.accuracy : 0);
    row.bestSpeed = Math.max(row.bestSpeed, Number.isFinite(result?.speed) ? result.speed : 0);

    const meetsTarget =
      (result?.level || "") === row.level &&
      (result?.keySet || "") === row.keySet &&
      (Number.isFinite(result?.duration) ? result.duration : 0) >= row.duration &&
      (Number.isFinite(result?.hits) ? result.hits : 0) >= row.targetHits &&
      (Number.isFinite(result?.accuracy) ? result.accuracy : 0) >= row.targetAccuracy &&
      (Number.isFinite(result?.speed) ? result.speed : 0) >= row.targetSpeed;

    let justCompleted = false;
    if (!row.completed && meetsTarget) {
      row.completed = true;
      row.completedAt = Date.now();
      justCompleted = true;
      logActivity("keyboard_daily_task_done", {
        level: row.level,
        keySet: row.keySet,
        targetHits: row.targetHits,
        targetAccuracy: row.targetAccuracy,
        targetSpeed: row.targetSpeed,
        source: "keyboard_daily_task",
      });
    }

    const saved = saveKeyboardDailyTask(row, row.date);
    return { ...saved, justCompleted };
  }

  function getKeyboardDailyTaskStats() {
    const map = getKeyboardDailyTaskMap();
    const rows = Object.values(map).filter((item) => item && typeof item === "object");
    const totalDays = rows.length;
    const completedDays = rows.filter((item) => item.completed).length;
    const completionRate = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
    const todayTask = getKeyboardDailyTask(toDateKey());
    return {
      totalDays,
      completedDays,
      completionRate,
      todayCompleted: todayTask.completed,
      latestCompletedAt: rows
        .map((item) => (Number.isFinite(item.completedAt) ? item.completedAt : 0))
        .reduce((max, ts) => Math.max(max, ts), 0),
    };
  }

  function getUserProfile() {
    const profile = safeRead(USER_PROFILE_KEY, {});
    const defaults = {
      displayName: "",
      nativeLanguage: "",
      targetLevel: "HSK1",
      country: "",
      dailyMinutes: 20,
      goals: "",
    };
    return { ...defaults, ...(profile || {}) };
  }

  function saveUserProfile(patch) {
    const profile = { ...getUserProfile(), ...(patch || {}) };
    safeWrite(USER_PROFILE_KEY, profile);
    logActivity("profile_update", {});
    return profile;
  }

  function getActivityLogs(limit) {
    const logs = safeRead(ACTIVITY_LOG_KEY, []);
    if (!Array.isArray(logs)) {
      return [];
    }
    const valid = logs.filter((item) => item && typeof item === "object");
    const slice = Number.isFinite(limit) ? valid.slice(-Math.max(0, limit)) : valid;
    return slice.reverse();
  }

  window.LearningStore = {
    keys: {
      WORKSHEET_CART_KEY,
      CALENDAR_COMPLETION_KEY,
      FOLLOW_READING_KEY,
      TYPING_GAME_KEY,
      KEYBOARD_PRACTICE_KEY,
      KEYBOARD_DAILY_TASK_KEY,
      BILLING_SUBSCRIPTION_KEY,
      BILLING_USAGE_KEY,
      USER_PROFILE_KEY,
      ACTIVITY_LOG_KEY,
    },
    getWorksheetCart,
    saveWorksheetCart,
    addWorksheetChars,
    removeWorksheetChar,
    clearWorksheetCart,
    getCalendarCompletion,
    getLearnedCharsFromCalendar,
    getFollowReadingRecords,
    appendFollowReadingRecord,
    getFollowReadingStats,
    getTypingGameRecords,
    appendTypingGameRecord,
    getTypingGameStats,
    getKeyboardPracticeRecords,
    appendKeyboardPracticeRecord,
    getKeyboardPracticeStats,
    getKeyboardDailyTask,
    saveKeyboardDailyTask,
    updateKeyboardDailyTaskProgress,
    getKeyboardDailyTaskStats,
    getBillingPlans,
    getSubscription,
    setSubscription,
    isFeatureEnabled,
    canUseFeature,
    consumeFeatureUsage,
    getBillingSnapshot,
    getUserProfile,
    saveUserProfile,
    getActivityLogs,
    logActivity,
    toHanCharArray,
  };
})();
