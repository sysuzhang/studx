const refs = {
  currentPlanBox: document.getElementById("currentPlanBox"),
  paymentProviderSelect: document.getElementById("paymentProviderSelect"),
  providerMeta: document.getElementById("providerMeta"),
  orderMeta: document.getElementById("orderMeta"),
  actionTip: document.getElementById("actionTip"),
  planGrid: document.getElementById("planGrid"),
};

const store = window.LearningStore;
const cloud = window.CloudSync;
const PLAN_ORDER = ["free", "pro_monthly", "pro_yearly"];
const POLL_LIMIT = 20;

const state = {
  plans: [],
  providers: {},
  sessionUser: null,
  serverSubscription: null,
  latestOrders: [],
  pollTimer: null,
  pollCount: 0,
};

function formatDate(ts) {
  if (!Number.isFinite(ts) || ts <= 0) {
    return "-";
  }
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const h = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function quotaText(limit, used) {
  if (limit === null) {
    return `不限量（已用 ${used}）`;
  }
  return `${used}/${limit}`;
}

function yesNo(value) {
  return value ? "已解锁" : "未解锁";
}

function getPlans() {
  const source = state.plans.length
    ? state.plans
    : store && typeof store.getBillingPlans === "function"
    ? store.getBillingPlans()
    : [];
  return [...source].sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
}

function getCurrentPlanId() {
  if (state.serverSubscription?.planId) {
    return state.serverSubscription.planId;
  }
  return store && typeof store.getSubscription === "function" ? store.getSubscription().planId : "free";
}

function syncServerSubscriptionToLocal() {
  if (!state.serverSubscription?.planId || !store || typeof store.getSubscription !== "function") {
    return;
  }
  const localPlanId = store.getSubscription().planId;
  if (localPlanId !== state.serverSubscription.planId && typeof store.setSubscription === "function") {
    store.setSubscription(state.serverSubscription.planId, "cloud_billing_sync");
  }
}

function renderProviderMeta() {
  const provider = refs.paymentProviderSelect?.value || "stripe";
  const row = state.providers[provider];
  if (!row) {
    refs.providerMeta.textContent = "支付通道信息不可用。";
    return;
  }
  refs.providerMeta.textContent = row.enabled
    ? `${row.label} 已配置，可创建真实支付订单。`
    : `${row.label} 当前未配置，暂不可用。`;
}

function syncProviderOptions() {
  if (!refs.paymentProviderSelect) {
    return;
  }
  const current = refs.paymentProviderSelect.value;
  const options = [...refs.paymentProviderSelect.querySelectorAll("option")];
  options.forEach((option) => {
    const provider = option.value;
    const row = state.providers[provider];
    if (!row) {
      option.disabled = false;
      return;
    }
    option.disabled = !row.enabled;
    option.textContent = row.label || option.textContent;
  });
  const selectedEnabled = state.providers[current]?.enabled !== false;
  if (!selectedEnabled) {
    const fallback = options.find((option) => !option.disabled);
    if (fallback) {
      refs.paymentProviderSelect.value = fallback.value;
    }
  }
}

function renderCurrentPlan() {
  if (!store || typeof store.getBillingSnapshot !== "function") {
    refs.currentPlanBox.innerHTML = `<p class="tip">当前浏览器未启用本地存储，套餐信息不可用。</p>`;
    return;
  }
  syncServerSubscriptionToLocal();
  const snapshot = store.getBillingSnapshot();
  const sub = state.serverSubscription || snapshot.subscription || {};
  const plan = getPlans().find((item) => item.id === (sub.planId || snapshot.plan?.id || "free")) || snapshot.plan || { name: "基础版" };
  const printUsage = snapshot.usage?.worksheetPrint || { used: 0, limit: 2 };
  const lookupUsage = snapshot.usage?.dictionaryLookup || { used: 0, limit: 60 };
  const loginText = state.sessionUser
    ? `云端账号：${state.sessionUser.username}（${state.sessionUser.role === "teacher" ? "教师" : "学生"}）`
    : "云端账号：未登录（登录后可真实支付并跨设备同步套餐）";
  const expiresText =
    sub.expiresAt && Number.isFinite(sub.expiresAt) ? `到期时间：${formatDate(sub.expiresAt)}` : "到期时间：长期有效";
  refs.currentPlanBox.innerHTML = `
    <p class="status">${loginText}</p>
    <p class="status ok">当前套餐：${plan.name}</p>
    <p class="status">开通时间：${formatDate(sub.activatedAt || snapshot.subscription?.activatedAt || 0)}</p>
    <p class="status">${expiresText}</p>
    <p class="status">今日字帖打印：${quotaText(printUsage.limit, printUsage.used)}</p>
    <p class="status">今日字典检索：${quotaText(lookupUsage.limit, lookupUsage.used)}</p>
    <p class="status">键盘中/高级关卡：${yesNo(snapshot.features?.keyboardAdvancedLevel)}</p>
    <p class="status">字典进阶释义：${yesNo(snapshot.features?.dictionaryAdvanced)}</p>
  `;
}

function planFeatureItems(plan) {
  const printLimit = plan.quotas?.worksheetPrintDailyLimit ?? (plan.id === "free" ? 2 : null);
  const lookupLimit = plan.quotas?.dictionaryLookupDailyLimit ?? (plan.id === "free" ? 60 : null);
  return [
    `字帖打印：${printLimit === null ? "不限量" : `${printLimit} 次/天`}`,
    `字典检索：${lookupLimit === null ? "不限量" : `${lookupLimit} 次/天`}`,
    `键盘中/高级关卡：${plan.features?.keyboardAdvancedLevel ? "已解锁" : "未解锁"}`,
    `字典进阶释义：${plan.features?.dictionaryAdvanced ? "已解锁" : "未解锁"}`,
    `优先反馈支持：${plan.features?.prioritySupport ? "支持" : "不支持"}`,
  ];
}

function renderPlanCards() {
  const plans = getPlans();
  const currentPlanId = getCurrentPlanId();
  const provider = refs.paymentProviderSelect?.value || "stripe";
  const providerEnabled = state.providers[provider]?.enabled !== false;
  refs.planGrid.innerHTML = "";
  plans.forEach((plan) => {
    const card = document.createElement("article");
    card.className = `plan-card${plan.id === currentPlanId ? " active" : ""}`;
    let actionText = "当前方案";
    if (plan.id !== currentPlanId) {
      if (plan.id === "free") {
        actionText = "切换为基础版";
      } else if (!state.sessionUser) {
        actionText = "登录后支付开通";
      } else if (!providerEnabled) {
        actionText = "通道未配置";
      } else {
        actionText = "创建支付订单";
      }
    }
    const buttonDisabled = plan.id === currentPlanId || (plan.id !== "free" && state.sessionUser && !providerEnabled);
    card.innerHTML = `
      <h3 class="plan-title">${plan.name}</h3>
      <p class="plan-price">${plan.priceLabel}</p>
      <p class="plan-desc">${plan.description || ""}</p>
      <ul class="plan-list">
        ${planFeatureItems(plan)
          .map((item) => `<li>${item}</li>`)
          .join("")}
      </ul>
      <button type="button" data-plan-id="${plan.id}" class="${plan.id === currentPlanId ? "ghost" : ""}" ${
        buttonDisabled ? "disabled" : ""
      }>
        ${actionText}
      </button>
    `;
    refs.planGrid.appendChild(card);
  });
}

async function refreshCloudBilling() {
  if (!cloud) {
    state.sessionUser = null;
    state.serverSubscription = null;
    state.latestOrders = [];
    return;
  }
  const planPayload = await cloud.getBillingPlans();
  state.plans = Array.isArray(planPayload?.plans) ? planPayload.plans : [];
  state.providers = planPayload?.providers || {};
  const session = await cloud.getSession();
  state.sessionUser = session.loggedIn ? session.user : null;
  if (!state.sessionUser) {
    state.serverSubscription = null;
    state.latestOrders = [];
    return;
  }
  const subPayload = await cloud.getBillingSubscription();
  state.serverSubscription = subPayload?.subscription || null;
  const orderPayload = await cloud.listBillingOrders();
  state.latestOrders = Array.isArray(orderPayload?.rows) ? orderPayload.rows : [];
  if (orderPayload?.subscription) {
    state.serverSubscription = orderPayload.subscription;
  }
}

function clearOrderPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  state.pollCount = 0;
}

async function checkOrderStatus(orderId, silent) {
  if (!cloud || !orderId || !state.sessionUser) {
    return null;
  }
  const payload = await cloud.getBillingOrder(orderId);
  const order = payload?.order || null;
  if (!order) {
    return null;
  }
  state.serverSubscription = payload?.subscription || state.serverSubscription;
  if (payload?.subscription?.planId && store && typeof store.getSubscription === "function") {
    const localPlan = store.getSubscription().planId;
    if (localPlan !== payload.subscription.planId && typeof store.setSubscription === "function") {
      store.setSubscription(payload.subscription.planId, "payment_verified");
    }
  }
  if (!silent) {
    refs.orderMeta.textContent = `订单 ${order.id} 状态：${order.status}（更新时间 ${formatDate(order.updatedAt)}）`;
  }
  return order;
}

function startOrderPolling(orderId) {
  clearOrderPolling();
  const runner = async () => {
    state.pollCount += 1;
    try {
      const order = await checkOrderStatus(orderId, false);
      if (!order) {
        clearOrderPolling();
        return;
      }
      if (order.status === "paid") {
        clearOrderPolling();
        refs.actionTip.textContent = "支付成功，套餐权益已自动生效。";
        await refreshCloudBilling();
        renderAll();
        return;
      }
      if (["expired", "failed", "cancelled"].includes(order.status)) {
        clearOrderPolling();
        refs.actionTip.textContent = `订单状态：${order.status}，请重新发起支付。`;
        await refreshCloudBilling();
        renderAll();
        return;
      }
      if (state.pollCount >= POLL_LIMIT) {
        clearOrderPolling();
        refs.actionTip.textContent = "订单仍在处理中，可稍后点击刷新查看最终状态。";
      }
    } catch (error) {
      clearOrderPolling();
      refs.actionTip.textContent = `订单状态检查失败：${error.message}`;
    }
  };
  runner();
  state.pollTimer = setInterval(runner, 3000);
}

async function switchPlan(planId) {
  const currentPlanId = getCurrentPlanId();
  if (currentPlanId === planId) {
    refs.actionTip.textContent = "已是当前方案。";
    return;
  }

  if (planId === "free") {
    if (state.sessionUser && cloud) {
      const payload = await cloud.changeBillingSubscription("free");
      state.serverSubscription = payload?.subscription || state.serverSubscription;
      if (store && typeof store.getSubscription === "function" && typeof store.setSubscription === "function") {
        if (store.getSubscription().planId !== "free") {
          store.setSubscription("free", "cloud_downgrade");
        }
      }
      refs.actionTip.textContent = "已切换为基础版。";
      await refreshCloudBilling();
      renderAll();
      return;
    }
    if (store && typeof store.setSubscription === "function") {
      store.setSubscription("free", "pricing_local");
      refs.actionTip.textContent = "已切换到基础版（本地模式）。";
      renderAll();
      return;
    }
    return;
  }

  if (!state.sessionUser) {
    const goLogin = window.confirm("开通付费套餐前需要先登录账号，是否前往登录页？");
    if (goLogin) {
      window.location.href = "./auth.html";
    }
    return;
  }
  if (!cloud) {
    refs.actionTip.textContent = "CloudSync 未加载，无法创建支付订单。";
    return;
  }
  const provider = refs.paymentProviderSelect?.value || "stripe";
  const providerInfo = state.providers[provider];
  if (!providerInfo?.enabled) {
    refs.actionTip.textContent = `${providerInfo?.label || provider} 尚未配置，请切换可用支付通道。`;
    return;
  }

  refs.actionTip.textContent = "正在创建支付订单...";
  const payload = await cloud.createBillingOrder({ planId, provider });
  const order = payload?.order || null;
  if (!order) {
    refs.actionTip.textContent = "订单创建失败，请稍后重试。";
    return;
  }
  refs.orderMeta.textContent = `订单 ${order.id} 已创建，状态：${order.status}`;
  if (payload.checkoutUrl) {
    window.location.href = payload.checkoutUrl;
    return;
  }
  refs.actionTip.textContent = "订单已创建，请根据支付通道完成付款。";
  startOrderPolling(order.id);
}

function handleReturnFromPayment() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const orderId = params.get("orderId");
  if (!payment || !orderId) {
    return;
  }
  if (payment === "success") {
    refs.orderMeta.textContent = `支付回跳成功，正在确认订单 ${orderId} 状态...`;
    startOrderPolling(orderId);
    return;
  }
  if (payment === "cancelled") {
    refs.orderMeta.textContent = `订单 ${orderId} 已取消，可重新发起支付。`;
  } else {
    refs.orderMeta.textContent = `订单 ${orderId} 状态回跳：${payment}`;
  }
}

function renderLatestOrderMeta() {
  if (refs.orderMeta.textContent.trim()) {
    return;
  }
  if (!state.latestOrders.length) {
    refs.orderMeta.textContent = "暂无订单记录。";
    return;
  }
  const latest = state.latestOrders[0];
  refs.orderMeta.textContent = `最近订单：${latest.id}（${latest.status}，${formatDate(latest.updatedAt)}）`;
}

function bindEvents() {
  refs.paymentProviderSelect?.addEventListener("change", () => {
    renderProviderMeta();
    renderPlanCards();
  });
  refs.planGrid.addEventListener("click", (event) => {
    const node = event.target.closest("button[data-plan-id]");
    if (!node) {
      return;
    }
    switchPlan(node.dataset.planId).catch((error) => {
      refs.actionTip.textContent = `操作失败：${error.message}`;
    });
  });
}

function renderAll() {
  syncProviderOptions();
  renderCurrentPlan();
  renderProviderMeta();
  renderLatestOrderMeta();
  renderPlanCards();
}

async function bootstrap() {
  bindEvents();
  refs.providerMeta.textContent = "";
  refs.orderMeta.textContent = "";
  refs.actionTip.textContent = "加载订阅信息中...";
  try {
    await refreshCloudBilling();
    refs.actionTip.textContent = state.sessionUser
      ? "已连接云端订阅服务，可创建真实支付订单。"
      : "未登录：可先查看套餐，登录后开通真实支付。";
  } catch (error) {
    refs.actionTip.textContent = `云端计费服务不可用：${error.message}`;
  }
  renderAll();
  handleReturnFromPayment();
}

bootstrap();
