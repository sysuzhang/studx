const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Stripe = require("stripe");

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
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";

const BILLING_PLANS = {
  free: {
    id: "free",
    name: "基础版",
    priceLabel: "¥0",
    cycle: "free",
    amountCents: 0,
    currency: "cny",
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
    amountCents: 2900,
    currency: "cny",
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
    amountCents: 29900,
    currency: "cny",
    features: {
      keyboardAdvancedLevel: true,
      dictionaryAdvanced: true,
      prioritySupport: true,
    },
  },
};

const BILLING_PLAN_ORDER = ["free", "pro_monthly", "pro_yearly"];
const BILLING_EXTEND_MS = {
  monthly: 31 * 24 * 3600 * 1000,
  yearly: 366 * 24 * 3600 * 1000,
};

const stripeClient = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      if (req.originalUrl === "/api/payments/stripe/webhook") {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = { users: [], sessions: [], syncRecords: [], orders: [], paymentEvents: [] };
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
      orders: safeArray(parsed.orders),
      paymentEvents: safeArray(parsed.paymentEvents),
    };
  } catch (error) {
    return { users: [], sessions: [], syncRecords: [], orders: [], paymentEvents: [] };
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

function normalizePlanId(planId) {
  return BILLING_PLANS[planId] ? planId : "free";
}

function getPlanById(planId) {
  return BILLING_PLANS[normalizePlanId(planId)];
}

function listBillingPlans() {
  return BILLING_PLAN_ORDER.map((id) => BILLING_PLANS[id]).filter(Boolean);
}

function sanitizeOrderForClient(order) {
  if (!order) {
    return null;
  }
  return {
    id: order.id,
    userId: order.userId,
    provider: order.provider,
    planId: order.planId,
    amountCents: order.amountCents,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt || 0,
    checkoutUrl: order.checkoutUrl || "",
    checkoutSessionId: order.checkoutSessionId || "",
  };
}

function ensureUserBilling(user) {
  if (!user || typeof user !== "object") {
    return;
  }
  const now = nowTs();
  const billing = user.billing && typeof user.billing === "object" ? user.billing : {};
  user.billing = {
    planId: normalizePlanId(billing.planId || "free"),
    status: billing.status || "active",
    activatedAt: Number.isFinite(billing.activatedAt) ? billing.activatedAt : now,
    expiresAt: Number.isFinite(billing.expiresAt) ? billing.expiresAt : null,
    updatedAt: Number.isFinite(billing.updatedAt) ? billing.updatedAt : now,
    source: billing.source || "system_default",
    latestOrderId: billing.latestOrderId || "",
  };
}

function ensureAllUserBilling(db) {
  db.users.forEach((user) => ensureUserBilling(user));
}

function getPublicSubscription(user) {
  ensureUserBilling(user);
  return {
    planId: user.billing.planId,
    status: user.billing.status,
    activatedAt: user.billing.activatedAt,
    expiresAt: user.billing.expiresAt,
    updatedAt: user.billing.updatedAt,
    source: user.billing.source,
    latestOrderId: user.billing.latestOrderId || "",
    features: getPlanById(user.billing.planId).features,
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

function applySubscriptionFromOrder(db, user, order) {
  if (!user || !order) {
    return;
  }
  ensureUserBilling(user);
  const plan = getPlanById(order.planId);
  const now = nowTs();
  let expiresAt = null;
  if (plan.cycle === "monthly" || plan.cycle === "yearly") {
    const base = Number.isFinite(user.billing.expiresAt) && user.billing.expiresAt > now ? user.billing.expiresAt : now;
    expiresAt = base + (BILLING_EXTEND_MS[plan.cycle] || 0);
  }
  user.billing = {
    ...user.billing,
    planId: plan.id,
    status: "active",
    activatedAt: now,
    expiresAt,
    updatedAt: now,
    source: order.provider || "order_payment",
    latestOrderId: order.id,
  };
  order.appliedAt = now;
  order.subscriptionPlanId = plan.id;
  order.subscriptionExpiresAt = expiresAt;
  order.updatedAt = now;
  writeDb(db);
}

function setFreeSubscription(db, user, source) {
  if (!user) {
    return;
  }
  ensureUserBilling(user);
  const now = nowTs();
  user.billing = {
    ...user.billing,
    planId: "free",
    status: "active",
    activatedAt: now,
    expiresAt: null,
    updatedAt: now,
    source: source || "manual_free",
  };
  writeDb(db);
}

function recordPaymentEvent(db, payload) {
  db.paymentEvents.push({
    id: createId("pevt"),
    eventId: payload.eventId || "",
    type: payload.type || "unknown",
    orderId: payload.orderId || "",
    provider: payload.provider || "",
    receivedAt: nowTs(),
    payload: payload.payload || {},
  });
  db.paymentEvents = db.paymentEvents.slice(-2000);
}

function mapCheckoutStatusToOrderStatus(session) {
  if (!session || typeof session !== "object") {
    return "pending";
  }
  if (session.payment_status === "paid") {
    return "paid";
  }
  if (session.status === "expired") {
    return "expired";
  }
  if (session.status === "complete" && session.payment_status !== "paid") {
    return "pending_review";
  }
  return "pending";
}

async function createStripeCheckoutOrder(order, user) {
  if (!stripeClient) {
    const error = new Error("Stripe 支付未配置，请设置 STRIPE_SECRET_KEY");
    error.code = "stripe_not_configured";
    throw error;
  }
  const plan = getPlanById(order.planId);
  if (plan.amountCents <= 0) {
    const error = new Error("当前套餐无需支付");
    error.code = "invalid_amount";
    throw error;
  }
  const successUrl = `${APP_BASE_URL}/pricing.html?payment=success&orderId=${encodeURIComponent(order.id)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${APP_BASE_URL}/pricing.html?payment=cancelled&orderId=${encodeURIComponent(order.id)}`;
  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: plan.amountCents,
          product_data: {
            name: `汉字学习平台 ${plan.name}`,
            description: `订阅方案：${plan.priceLabel}`,
          },
        },
      },
    ],
    metadata: {
      orderId: order.id,
      userId: user.id,
      username: user.username,
      planId: plan.id,
    },
    client_reference_id: user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: "zh",
  });
  return session;
}

async function syncOrderWithStripe(db, order) {
  if (!order || order.provider !== "stripe" || !order.checkoutSessionId || !stripeClient) {
    return order;
  }
  const session = await stripeClient.checkout.sessions.retrieve(order.checkoutSessionId);
  const mappedStatus = mapCheckoutStatusToOrderStatus(session);
  if (mappedStatus !== order.status) {
    order.status = mappedStatus;
    order.updatedAt = nowTs();
  }
  if (mappedStatus === "paid" && !Number.isFinite(order.paidAt)) {
    order.paidAt = nowTs();
    order.updatedAt = nowTs();
    const user = db.users.find((item) => item.id === order.userId);
    if (user) {
      applySubscriptionFromOrder(db, user, order);
    }
  } else {
    writeDb(db);
  }
  return order;
}

function findOrderByStripeSession(db, checkoutSessionId, metadata) {
  if (!checkoutSessionId) {
    return null;
  }
  let order = db.orders.find((item) => item.checkoutSessionId === checkoutSessionId);
  if (!order && metadata?.orderId) {
    order = db.orders.find((item) => item.id === metadata.orderId);
  }
  return order || null;
}

function ensureSeedTeacher() {
  const db = readDb();
  ensureAllUserBilling(db);
  const teacherName = normalizeUsername(TEACHER_DEFAULT_USERNAME);
  if (!teacherName) {
    return;
  }
  const exists = db.users.some((item) => item.username === teacherName);
  if (exists) {
    writeDb(db);
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
    billing: {
      planId: "free",
      status: "active",
      activatedAt: nowTs(),
      expiresAt: null,
      updatedAt: nowTs(),
      source: "teacher_seed",
      latestOrderId: "",
    },
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
  ensureUserBilling(user);
  const now = nowTs();
  if (
    user.billing.planId !== "free" &&
    Number.isFinite(user.billing.expiresAt) &&
    user.billing.expiresAt <= now
  ) {
    user.billing.planId = "free";
    user.billing.status = "expired";
    user.billing.updatedAt = now;
    user.billing.expiresAt = null;
    user.billing.source = "auto_expire";
    writeDb(db);
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
    billing: {
      planId: "free",
      status: "active",
      activatedAt: nowTs(),
      expiresAt: null,
      updatedAt: nowTs(),
      source: "signup",
      latestOrderId: "",
    },
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

app.get("/api/billing/plans", (_req, res) => {
  const providers = {
    stripe: {
      enabled: Boolean(stripeClient && STRIPE_PUBLISHABLE_KEY),
      publishableKey: STRIPE_PUBLISHABLE_KEY || "",
      label: "Stripe（卡支付）",
    },
    wechat: {
      enabled: false,
      label: "微信支付（待配置）",
    },
    alipay: {
      enabled: false,
      label: "支付宝（待配置）",
    },
  };
  res.json({
    plans: listBillingPlans(),
    providers,
  });
});

app.get("/api/billing/subscription", authRequired, (req, res) => {
  const user = req.auth.user;
  ensureUserBilling(user);
  writeDb(req.db);
  res.json({
    subscription: getPublicSubscription(user),
    plan: getPlanById(user.billing.planId),
  });
});

app.post("/api/billing/subscription/change", authRequired, (req, res) => {
  const planId = normalizePlanId(req.body?.planId);
  if (planId !== "free") {
    return res.status(400).json({ message: "付费套餐请通过支付订单开通" });
  }
  setFreeSubscription(req.db, req.auth.user, "manual_downgrade");
  res.json({
    ok: true,
    subscription: getPublicSubscription(req.auth.user),
    plan: getPlanById("free"),
  });
});

app.post("/api/billing/orders/create", authRequired, async (req, res) => {
  try {
    const user = req.auth.user;
    ensureUserBilling(user);
    const planId = normalizePlanId(req.body?.planId);
    const provider = String(req.body?.provider || "stripe").trim().toLowerCase();
    const plan = getPlanById(planId);

    if (planId === "free") {
      setFreeSubscription(req.db, user, "free_switch");
      return res.json({
        ok: true,
        immediate: true,
        subscription: getPublicSubscription(user),
        plan,
      });
    }

    if (!["stripe", "wechat", "alipay"].includes(provider)) {
      return res.status(400).json({ message: "不支持的支付通道" });
    }
    if (provider !== "stripe") {
      return res.status(501).json({ message: "该支付通道暂未配置，可先使用 Stripe 测试闭环" });
    }

    const order = {
      id: createId("ord"),
      userId: user.id,
      provider,
      planId: plan.id,
      amountCents: plan.amountCents,
      currency: plan.currency,
      status: "created",
      createdAt: nowTs(),
      updatedAt: nowTs(),
      paidAt: null,
      checkoutSessionId: "",
      checkoutUrl: "",
      paymentIntentId: "",
    };

    const session = await createStripeCheckoutOrder(order, user);
    order.checkoutSessionId = session.id;
    order.checkoutUrl = session.url || "";
    order.paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : "";
    order.status = mapCheckoutStatusToOrderStatus(session);
    order.updatedAt = nowTs();
    req.db.orders.push(order);
    writeDb(req.db);
    return res.json({
      ok: true,
      order: sanitizeOrderForClient(order),
      checkoutUrl: order.checkoutUrl,
      providerInfo: {
        provider,
        publishableKey: STRIPE_PUBLISHABLE_KEY || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: `创建订单失败：${error.message}` });
  }
});

app.get("/api/billing/orders", authRequired, async (req, res) => {
  const userId = req.auth.user.id;
  const rows = req.db.orders
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);
  for (const row of rows) {
    if (row.provider === "stripe" && row.status !== "paid" && row.status !== "expired" && stripeClient) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await syncOrderWithStripe(req.db, row);
      } catch (error) {
        // Ignore transient provider sync failure in list endpoint.
      }
    }
  }
  const currentSub = getPublicSubscription(req.auth.user);
  res.json({
    rows: rows.map((item) => sanitizeOrderForClient(item)),
    subscription: currentSub,
  });
});

app.get("/api/billing/orders/:orderId", authRequired, async (req, res) => {
  const orderId = String(req.params.orderId || "");
  const order = req.db.orders.find((item) => item.id === orderId && item.userId === req.auth.user.id);
  if (!order) {
    return res.status(404).json({ message: "订单不存在" });
  }
  if (order.provider === "stripe" && order.status !== "paid" && order.status !== "expired" && stripeClient) {
    try {
      await syncOrderWithStripe(req.db, order);
    } catch (error) {
      // Ignore provider polling error and return local state.
    }
  }
  return res.json({
    order: sanitizeOrderForClient(order),
    subscription: getPublicSubscription(req.auth.user),
    plan: getPlanById(req.auth.user.billing.planId),
  });
});

app.post("/api/payments/stripe/webhook", async (req, res) => {
  if (!stripeClient || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("stripe webhook not configured");
  }
  const signature = String(req.headers["stripe-signature"] || "");
  if (!signature || !req.rawBody) {
    return res.status(400).send("missing stripe signature");
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`invalid signature: ${error.message}`);
  }

  const db = readDb();
  ensureAllUserBilling(db);
  const duplicated = db.paymentEvents.some((item) => item.eventId && item.eventId === event.id);
  if (duplicated) {
    return res.json({ received: true, duplicate: true });
  }

  const sessionObject = event.data?.object;
  const metadata = sessionObject?.metadata || {};
  const checkoutSessionId = sessionObject?.id || "";
  const order = findOrderByStripeSession(db, checkoutSessionId, metadata);
  const isCheckoutEvent = String(event.type || "").startsWith("checkout.session.");

  if (order && isCheckoutEvent) {
    const mapped = mapCheckoutStatusToOrderStatus(sessionObject);
    if (mapped !== order.status) {
      order.status = mapped;
      order.updatedAt = nowTs();
    }
    order.checkoutSessionId = order.checkoutSessionId || checkoutSessionId;
    order.paymentIntentId =
      order.paymentIntentId || (typeof sessionObject?.payment_intent === "string" ? sessionObject.payment_intent : "");
    if (mapped === "paid" && !Number.isFinite(order.paidAt)) {
      order.paidAt = nowTs();
      const user = db.users.find((item) => item.id === order.userId);
      if (user) {
        applySubscriptionFromOrder(db, user, order);
      }
    }
  }

  recordPaymentEvent(db, {
    eventId: event.id,
    type: event.type,
    orderId: order?.id || metadata?.orderId || "",
    provider: "stripe",
    payload: {
      checkoutSessionId,
      paymentStatus: sessionObject?.payment_status || "",
      status: sessionObject?.status || "",
      planId: metadata?.planId || "",
    },
  });
  writeDb(db);
  return res.json({ received: true });
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
