(function () {
  const WORKSHEET_CART_KEY = "worksheetCharCartV1";
  const CALENDAR_COMPLETION_KEY = "studyCalendarCompletionV1";
  const FOLLOW_READING_KEY = "followReadingRecordsV1";
  const TYPING_GAME_KEY = "typingGameRecordsV1";
  const KEYBOARD_PRACTICE_KEY = "keyboardPracticeRecordsV1";
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
      duration: Number.isFinite(record?.duration) ? record.duration : 60,
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
    getUserProfile,
    saveUserProfile,
    getActivityLogs,
    logActivity,
    toHanCharArray,
  };
})();
