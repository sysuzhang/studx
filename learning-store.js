(function () {
  const WORKSHEET_CART_KEY = "worksheetCharCartV1";
  const CALENDAR_COMPLETION_KEY = "studyCalendarCompletionV1";
  const FOLLOW_READING_KEY = "followReadingRecordsV1";
  const TYPING_GAME_KEY = "typingGameRecordsV1";
  const KEYBOARD_PRACTICE_KEY = "keyboardPracticeRecordsV1";
  const KEYBOARD_DAILY_TASK_KEY = "keyboardDailyTaskV1";
  const BILLING_SUBSCRIPTION_KEY = "billingSubscriptionPlanV1";
  const BILLING_USAGE_KEY = "billingUsageMeterV1";
  const WORKBOOK_HISTORY_KEY = "worksheetWorkbookHistoryV1";
  const WORKBOOK_MASTERY_KEY = "worksheetWorkbookMasteryV1";
  const PRACTICE_PROGRESS_KEY = "practiceLearningProgressV1";
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

  function createPracticeProgressDefaults() {
    return {
      learnedChars: {},
      reviewChars: {},
      wrongChars: {},
      updatedAt: 0,
    };
  }

  function normalizePracticeTime(value, fallback) {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return Number.isFinite(fallback) && fallback > 0 ? fallback : Date.now();
  }

  function normalizePracticeLearnedMap(map) {
    const source = map && typeof map === "object" ? map : {};
    const next = {};
    Object.keys(source).forEach((key) => {
      const char = toHanCharArray(key)[0];
      if (!char) {
        return;
      }
      const ts = Number(source[key]);
      if (Number.isFinite(ts) && ts > 0) {
        next[char] = ts;
      }
    });
    return next;
  }

  function normalizePracticeTrackMap(map) {
    const source = map && typeof map === "object" ? map : {};
    const next = {};
    Object.keys(source).forEach((key) => {
      const char = toHanCharArray(key)[0];
      if (!char) {
        return;
      }
      const row = source[key] && typeof source[key] === "object" ? source[key] : {};
      const count = Number.isFinite(row.count) && row.count > 0 ? Math.floor(row.count) : 1;
      const firstTs = normalizePracticeTime(row.firstTs, row.lastTs);
      const lastTs = normalizePracticeTime(row.lastTs, firstTs);
      next[char] = {
        count,
        firstTs,
        lastTs,
        source: row.source ? String(row.source) : "",
        reason: row.reason ? String(row.reason) : "",
      };
    });
    return next;
  }

  function normalizePracticeProgress(raw) {
    const defaults = createPracticeProgressDefaults();
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      learnedChars: normalizePracticeLearnedMap(source.learnedChars),
      reviewChars: normalizePracticeTrackMap(source.reviewChars),
      wrongChars: normalizePracticeTrackMap(source.wrongChars),
      updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : 0,
    };
  }

  function getPracticeProgress() {
    const raw = safeRead(PRACTICE_PROGRESS_KEY, createPracticeProgressDefaults());
    return normalizePracticeProgress(raw);
  }

  function savePracticeProgress(progress) {
    const next = normalizePracticeProgress(progress);
    next.updatedAt = Date.now();
    safeWrite(PRACTICE_PROGRESS_KEY, next);
    return next;
  }

  function touchPracticeTrack(map, char, payload) {
    const now = Date.now();
    const row = map[char] && typeof map[char] === "object" ? map[char] : null;
    map[char] = {
      count: (row?.count || 0) + 1,
      firstTs: Number.isFinite(row?.firstTs) ? row.firstTs : now,
      lastTs: now,
      source: payload?.source ? String(payload.source) : row?.source || "",
      reason: payload?.reason ? String(payload.reason) : row?.reason || "",
    };
  }

  function markPracticeCharLearned(char, payload) {
    const target = toHanCharArray(char)[0];
    if (!target) {
      return getPracticeProgress();
    }
    const progress = getPracticeProgress();
    progress.learnedChars[target] = Date.now();
    if (payload?.clearReview) {
      delete progress.reviewChars[target];
    }
    if (payload?.clearWrong) {
      delete progress.wrongChars[target];
    }
    const saved = savePracticeProgress(progress);
    logActivity("practice_progress_mark", {
      bucket: "learned",
      char: target,
      source: payload?.source || "practice",
    });
    return saved;
  }

  function markPracticeCharForReview(char, payload) {
    const target = toHanCharArray(char)[0];
    if (!target) {
      return getPracticeProgress();
    }
    const progress = getPracticeProgress();
    touchPracticeTrack(progress.reviewChars, target, payload);
    const saved = savePracticeProgress(progress);
    logActivity("practice_progress_mark", {
      bucket: "review",
      char: target,
      source: payload?.source || "practice",
      reason: payload?.reason || "",
    });
    return saved;
  }

  function markPracticeWrongChar(char, payload) {
    const target = toHanCharArray(char)[0];
    if (!target) {
      return getPracticeProgress();
    }
    const progress = getPracticeProgress();
    touchPracticeTrack(progress.wrongChars, target, payload);
    const saved = savePracticeProgress(progress);
    logActivity("practice_progress_mark", {
      bucket: "wrong",
      char: target,
      source: payload?.source || "practice",
      reason: payload?.reason || "",
    });
    return saved;
  }

  function clearPracticeProgress() {
    const next = createPracticeProgressDefaults();
    next.updatedAt = Date.now();
    safeWrite(PRACTICE_PROGRESS_KEY, next);
    logActivity("practice_progress_clear", {});
    return next;
  }

  function getPracticeProgressSummary(limit) {
    const rows = getPracticeProgress();
    const max = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : 12;

    const learnedChars = Object.entries(rows.learnedChars || {})
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .map((entry) => entry[0]);

    const reviewChars = Object.entries(rows.reviewChars || {})
      .sort((a, b) => (b[1]?.lastTs || 0) - (a[1]?.lastTs || 0))
      .map((entry) => entry[0]);

    const wrongChars = Object.entries(rows.wrongChars || {})
      .sort((a, b) => (b[1]?.lastTs || 0) - (a[1]?.lastTs || 0))
      .map((entry) => entry[0]);

    return {
      learnedCount: learnedChars.length,
      reviewCount: reviewChars.length,
      wrongCount: wrongChars.length,
      learnedChars: learnedChars.slice(0, max),
      reviewChars: reviewChars.slice(0, max),
      wrongChars: wrongChars.slice(0, max),
      updatedAt: rows.updatedAt || 0,
    };
  }

  function getPracticeCharProgress(char) {
    const target = toHanCharArray(char)[0];
    if (!target) {
      return { learned: false, inReview: false, wrongCount: 0 };
    }
    const rows = getPracticeProgress();
    return {
      learned: Boolean(rows.learnedChars[target]),
      inReview: Boolean(rows.reviewChars[target]),
      wrongCount: Number.isFinite(rows.wrongChars[target]?.count) ? rows.wrongChars[target].count : 0,
    };
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

  function getWorkbookHistory() {
    const rows = safeRead(WORKBOOK_HISTORY_KEY, []);
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.filter((item) => item && typeof item === "object");
  }

  function saveWorkbookHistory(rows) {
    const list = Array.isArray(rows) ? rows.filter((item) => item && typeof item === "object") : [];
    const compact = list.slice(-120);
    safeWrite(WORKBOOK_HISTORY_KEY, compact);
    return compact;
  }

  function appendWorkbookRecord(record) {
    const row = record && typeof record === "object" ? record : null;
    if (!row) {
      return null;
    }
    const rows = getWorkbookHistory();
    rows.push(row);
    const compact = saveWorkbookHistory(rows);
    logActivity("worksheet_workbook_generate", {
      bookId: row.id || "",
      ageGroup: row.ageGroup || "",
      level: row.level || "",
      chars: Array.isArray(row.chars) ? row.chars.length : 0,
      source: row.source || "workbook",
    });
    return compact[compact.length - 1] || null;
  }

  function getWorkbookRecordById(bookId) {
    const target = String(bookId || "");
    if (!target) {
      return null;
    }
    const rows = getWorkbookHistory();
    return rows.find((item) => String(item.id || "") === target) || null;
  }

  function updateWorkbookRecord(bookId, patch) {
    const target = String(bookId || "");
    if (!target) {
      return null;
    }
    const rows = getWorkbookHistory();
    const index = rows.findIndex((item) => String(item.id || "") === target);
    if (index < 0) {
      return null;
    }
    const next = {
      ...rows[index],
      ...(patch && typeof patch === "object" ? patch : {}),
      id: rows[index].id,
    };
    rows[index] = next;
    saveWorkbookHistory(rows);
    return next;
  }

  function getWorkbookMasteryMap() {
    const map = safeRead(WORKBOOK_MASTERY_KEY, {});
    return map && typeof map === "object" ? map : {};
  }

  function saveWorkbookMasteryMap(map) {
    const next = map && typeof map === "object" ? map : {};
    safeWrite(WORKBOOK_MASTERY_KEY, next);
    return next;
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
    const titleTags = Array.isArray(record?.titleTags)
      ? record.titleTags.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
      : [];
    const item = {
      ts: Date.now(),
      mode: record?.mode || "hanzi",
      score: Number.isFinite(record?.score) ? record.score : 0,
      accuracy: Number.isFinite(record?.accuracy) ? record.accuracy : 0,
      correct: Number.isFinite(record?.correct) ? record.correct : 0,
      total: Number.isFinite(record?.total) ? record.total : 0,
      maxCombo: Number.isFinite(record?.maxCombo) ? record.maxCombo : 0,
      bossDefeated: Number.isFinite(record?.bossDefeated) ? record.bossDefeated : 0,
      duration: Number.isFinite(record?.duration) ? record.duration : 0,
      wrongChars: Array.isArray(record?.wrongChars) ? toHanCharArray(record.wrongChars) : [],
      titleTags,
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
      bossDefeated: item.bossDefeated,
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
      WORKBOOK_HISTORY_KEY,
      WORKBOOK_MASTERY_KEY,
      PRACTICE_PROGRESS_KEY,
      USER_PROFILE_KEY,
      ACTIVITY_LOG_KEY,
    },
    getWorksheetCart,
    saveWorksheetCart,
    addWorksheetChars,
    removeWorksheetChar,
    clearWorksheetCart,
    getWorkbookHistory,
    saveWorkbookHistory,
    appendWorkbookRecord,
    getWorkbookRecordById,
    updateWorkbookRecord,
    getWorkbookMasteryMap,
    saveWorkbookMasteryMap,
    getPracticeProgress,
    savePracticeProgress,
    markPracticeCharLearned,
    markPracticeCharForReview,
    markPracticeWrongChar,
    clearPracticeProgress,
    getPracticeProgressSummary,
    getPracticeCharProgress,
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
