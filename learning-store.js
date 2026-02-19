(function () {
  const WORKSHEET_CART_KEY = "worksheetCharCartV1";
  const CALENDAR_COMPLETION_KEY = "studyCalendarCompletionV1";
  const FOLLOW_READING_KEY = "followReadingRecordsV1";
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
    getUserProfile,
    saveUserProfile,
    getActivityLogs,
    logActivity,
    toHanCharArray,
  };
})();
