const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();

const PORT = Number.parseInt(process.env.PORT, 10) || 8787;
const STATIC_ROOT = __dirname;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "cloud-db.json");
const SESSION_DAYS = 30;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const TEACHER_INVITE_CODE = process.env.TEACHER_INVITE_CODE || "TEACHER2026";
const TEACHER_DEFAULT_USERNAME = process.env.TEACHER_DEFAULT_USERNAME || "teacher";
const TEACHER_DEFAULT_PASSWORD = process.env.TEACHER_DEFAULT_PASSWORD || "teacher123";

app.use(express.json({ limit: "2mb" }));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = { users: [], sessions: [], syncRecords: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      users: safeArray(parsed.users),
      sessions: safeArray(parsed.sessions),
      syncRecords: safeArray(parsed.syncRecords),
    };
  } catch (error) {
    return { users: [], sessions: [], syncRecords: [] };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function nowTs() {
  return Date.now();
}

function createId(prefix) {
  return `${prefix}_${nowTs()}_${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

function verifyPassword(password, record) {
  if (!record || !record.salt || !record.hash) {
    return false;
  }
  const input = hashPassword(password, record.salt);
  return crypto.timingSafeEqual(Buffer.from(input, "hex"), Buffer.from(record.hash, "hex"));
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || "",
    role: user.role || "student",
    createdAt: user.createdAt || 0,
  };
}

function cleanExpiredSessions(db) {
  const now = nowTs();
  db.sessions = db.sessions.filter((item) => Number.isFinite(item.expiresAt) && item.expiresAt > now);
}

function createSession(db, userId) {
  const token = crypto.randomBytes(30).toString("hex");
  const now = nowTs();
  const expiresAt = now + SESSION_DAYS * 24 * 3600 * 1000;
  const row = {
    id: createId("sess"),
    token,
    userId,
    createdAt: now,
    expiresAt,
  };
  db.sessions.push(row);
  db.sessions = db.sessions
    .filter((item) => item.userId !== userId || item.id === row.id)
    .concat(db.sessions.filter((item) => item.userId === userId && item.id !== row.id).slice(-4));
  return row;
}

function ensureSeedTeacher() {
  const db = readDb();
  const teacherName = normalizeUsername(TEACHER_DEFAULT_USERNAME);
  if (!teacherName) {
    return;
  }
  const exists = db.users.some((item) => item.username === teacherName);
  if (exists) {
    return;
  }
  const pass = createPasswordRecord(TEACHER_DEFAULT_PASSWORD);
  db.users.push({
    id: createId("usr"),
    username: teacherName,
    displayName: "教师示例账号",
    role: "teacher",
    password: pass,
    createdAt: nowTs(),
  });
  writeDb(db);
  // eslint-disable-next-line no-console
  console.log(`[cloud] seeded teacher account: ${teacherName} / ${TEACHER_DEFAULT_PASSWORD}`);
}

function authRequired(req, res, next) {
  const token = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return res.status(401).json({ message: "未登录或令牌缺失" });
  }
  const db = readDb();
  cleanExpiredSessions(db);
  const session = db.sessions.find((item) => item.token === token);
  if (!session) {
    writeDb(db);
    return res.status(401).json({ message: "登录已过期，请重新登录" });
  }
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) {
    db.sessions = db.sessions.filter((item) => item.id !== session.id);
    writeDb(db);
    return res.status(401).json({ message: "账户不存在，请重新登录" });
  }
  req.db = db;
  req.auth = { user, session };
  return next();
}

function teacherOnly(req, res, next) {
  if (req.auth?.user?.role !== "teacher") {
    return res.status(403).json({ message: "仅教师端可访问" });
  }
  return next();
}

function getSnapshotObject(snapshot, key, fallback) {
  if (!snapshot || typeof snapshot !== "object") {
    return fallback;
  }
  const value = snapshot[key];
  return value === undefined ? fallback : value;
}

function computeReportFromSnapshot(snapshot) {
  const completion = getSnapshotObject(snapshot, "studyCalendarCompletionV1", {});
  const completionKeys = Object.keys(completion || {}).filter((key) => completion[key]);
  const learnedSet = new Set(
    completionKeys
      .map((key) => String(key).split("|")[1])
      .filter(Boolean)
  );

  const typing = safeArray(getSnapshotObject(snapshot, "typingGameRecordsV1", []));
  const keyboard = safeArray(getSnapshotObject(snapshot, "keyboardPracticeRecordsV1", []));
  const follow = safeArray(getSnapshotObject(snapshot, "followReadingRecordsV1", []));
  const activities = safeArray(getSnapshotObject(snapshot, "learningActivityLogV1", []));
  const dailyTaskMap = getSnapshotObject(snapshot, "keyboardDailyTaskV1", {});
  const billing = getSnapshotObject(snapshot, "billingSubscriptionPlanV1", {});
  const profile = getSnapshotObject(snapshot, "userProfileV1", {});

  const typingBest = typing.reduce((max, row) => Math.max(max, Number(row?.score) || 0), 0);
  const typingAvgAcc = typing.length
    ? Math.round(typing.reduce((sum, row) => sum + (Number(row?.accuracy) || 0), 0) / typing.length)
    : 0;

  const keyboardBestSpeed = keyboard.reduce((max, row) => Math.max(max, Number(row?.speed) || 0), 0);
  const keyboardAvgAcc = keyboard.length
    ? Math.round(keyboard.reduce((sum, row) => sum + (Number(row?.accuracy) || 0), 0) / keyboard.length)
    : 0;

  const followOk = follow.filter((row) => row?.level === "ok").length;
  const followAcc = follow.length ? Math.round((followOk / follow.length) * 100) : 0;

  const taskRows = Object.values(dailyTaskMap || {}).filter((item) => item && typeof item === "object");
  const doneTaskDays = taskRows.filter((item) => item.completed).length;

  const lastActivityAt = activities.reduce((max, row) => Math.max(max, Number(row?.ts) || 0), 0);

  return {
    profile: {
      displayName: profile.displayName || "",
      targetLevel: profile.targetLevel || "",
      dailyMinutes: Number(profile.dailyMinutes) || 0,
    },
    stats: {
      learnedChars: learnedSet.size,
      completedTasks: completionKeys.length,
      typingGames: typing.length,
      typingBestScore: typingBest,
      typingAverageAccuracy: typingAvgAcc,
      keyboardSessions: keyboard.length,
      keyboardBestSpeed,
      keyboardAverageAccuracy: keyboardAvgAcc,
      followReadingCount: follow.length,
      followReadingAccuracy: followAcc,
      keyboardDailyDoneDays: doneTaskDays,
      activityCount: activities.length,
      lastActivityAt,
      billingPlanId: billing.planId || "free",
    },
    recentActivities: activities.slice(-30).reverse(),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: nowTs() });
});

app.post("/api/auth/register", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim();
  const roleReq = String(req.body?.role || "student");
  const inviteCode = String(req.body?.inviteCode || "");

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ message: "用户名需为 3-24 位小写字母/数字/下划线" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "密码至少 6 位" });
  }
  const role = roleReq === "teacher" ? "teacher" : "student";
  if (role === "teacher" && inviteCode !== TEACHER_INVITE_CODE) {
    return res.status(403).json({ message: "教师邀请码不正确" });
  }

  const db = readDb();
  const exists = db.users.some((item) => item.username === username);
  if (exists) {
    return res.status(409).json({ message: "用户名已存在" });
  }
  cleanExpiredSessions(db);
  const user = {
    id: createId("usr"),
    username,
    displayName,
    role,
    password: createPasswordRecord(password),
    createdAt: nowTs(),
  };
  db.users.push(user);
  const session = createSession(db, user.id);
  writeDb(db);
  return res.json({
    token: session.token,
    user: publicUser(user),
  });
});

app.post("/api/auth/login", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const db = readDb();
  cleanExpiredSessions(db);
  const user = db.users.find((item) => item.username === username);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ message: "用户名或密码错误" });
  }
  const session = createSession(db, user.id);
  writeDb(db);
  return res.json({
    token: session.token,
    user: publicUser(user),
  });
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  req.db.sessions = req.db.sessions.filter((item) => item.id !== req.auth.session.id);
  writeDb(req.db);
  res.json({ ok: true });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({
    user: publicUser(req.auth.user),
    session: {
      createdAt: req.auth.session.createdAt,
      expiresAt: req.auth.session.expiresAt,
    },
  });
});

app.get("/api/sync/status", authRequired, (req, res) => {
  const record = req.db.syncRecords.find((item) => item.userId === req.auth.user.id);
  if (!record) {
    return res.json({ hasSnapshot: false, updatedAt: 0, version: 0 });
  }
  return res.json({
    hasSnapshot: true,
    updatedAt: record.updatedAt || 0,
    version: record.version || 1,
    stats: computeReportFromSnapshot(record.payload || {}).stats,
  });
});

app.post("/api/sync/upload", authRequired, (req, res) => {
  const snapshot = req.body?.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return res.status(400).json({ message: "同步数据格式无效" });
  }
  const bytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
  if (bytes > MAX_SNAPSHOT_BYTES) {
    return res.status(413).json({ message: "同步数据过大，请精简后重试" });
  }

  const current = req.db.syncRecords.find((item) => item.userId === req.auth.user.id);
  const nextVersion = (current?.version || 0) + 1;
  const next = {
    userId: req.auth.user.id,
    updatedAt: nowTs(),
    version: nextVersion,
    payload: snapshot,
    clientTs: Number(req.body?.clientTs) || 0,
  };
  req.db.syncRecords = req.db.syncRecords.filter((item) => item.userId !== req.auth.user.id);
  req.db.syncRecords.push(next);
  writeDb(req.db);
  return res.json({
    ok: true,
    updatedAt: next.updatedAt,
    version: next.version,
    stats: computeReportFromSnapshot(next.payload).stats,
  });
});

app.get("/api/sync/download", authRequired, (req, res) => {
  const record = req.db.syncRecords.find((item) => item.userId === req.auth.user.id);
  if (!record) {
    return res.json({ hasSnapshot: false, updatedAt: 0, version: 0, snapshot: null });
  }
  return res.json({
    hasSnapshot: true,
    updatedAt: record.updatedAt || 0,
    version: record.version || 1,
    snapshot: record.payload || {},
    stats: computeReportFromSnapshot(record.payload || {}).stats,
  });
});

app.get("/api/teacher/students", authRequired, teacherOnly, (req, res) => {
  const students = req.db.users
    .filter((item) => item.role === "student")
    .map((user) => {
      const record = req.db.syncRecords.find((row) => row.userId === user.id);
      const report = record ? computeReportFromSnapshot(record.payload || {}) : null;
      const displayName = report?.profile?.displayName || user.displayName || user.username;
      return {
        id: user.id,
        username: user.username,
        displayName,
        createdAt: user.createdAt || 0,
        lastSyncedAt: record?.updatedAt || 0,
        version: record?.version || 0,
        stats: report?.stats || null,
      };
    })
    .sort((a, b) => b.lastSyncedAt - a.lastSyncedAt || b.createdAt - a.createdAt);

  res.json({ rows: students });
});

app.get("/api/teacher/students/:userId/report", authRequired, teacherOnly, (req, res) => {
  const userId = String(req.params.userId || "");
  const user = req.db.users.find((item) => item.id === userId && item.role === "student");
  if (!user) {
    return res.status(404).json({ message: "未找到学生账号" });
  }
  const record = req.db.syncRecords.find((item) => item.userId === user.id);
  if (!record) {
    return res.json({
      student: publicUser(user),
      hasReport: false,
      updatedAt: 0,
      version: 0,
      report: null,
    });
  }
  return res.json({
    student: publicUser(user),
    hasReport: true,
    updatedAt: record.updatedAt || 0,
    version: record.version || 1,
    report: computeReportFromSnapshot(record.payload || {}),
  });
});

app.use(express.static(STATIC_ROOT, { extensions: ["html"] }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(STATIC_ROOT, "index.html"));
});

ensureDb();
ensureSeedTeacher();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[cloud] server running at http://localhost:${PORT}`);
});
