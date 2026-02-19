const refs = {
  currentPlanBox: document.getElementById("currentPlanBox"),
  actionTip: document.getElementById("actionTip"),
  planGrid: document.getElementById("planGrid"),
};

const store = window.LearningStore;
const PLAN_ORDER = ["free", "pro_monthly", "pro_yearly"];

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
  if (!store || typeof store.getBillingPlans !== "function") {
    return [];
  }
  const rows = store.getBillingPlans();
  return [...rows].sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
}

function renderCurrentPlan() {
  if (!store || typeof store.getBillingSnapshot !== "function") {
    refs.currentPlanBox.innerHTML = `<p class="tip">当前浏览器未启用本地存储，套餐信息不可用。</p>`;
    return;
  }
  const snapshot = store.getBillingSnapshot();
  const sub = snapshot.subscription || {};
  const plan = snapshot.plan || { name: "基础版" };
  const printUsage = snapshot.usage?.worksheetPrint || { used: 0, limit: 2 };
  const lookupUsage = snapshot.usage?.dictionaryLookup || { used: 0, limit: 60 };
  refs.currentPlanBox.innerHTML = `
    <p class="status ok">当前套餐：${plan.name}</p>
    <p class="status">开通时间：${formatDate(sub.activatedAt)}</p>
    <p class="status">今日字帖打印：${quotaText(printUsage.limit, printUsage.used)}</p>
    <p class="status">今日字典检索：${quotaText(lookupUsage.limit, lookupUsage.used)}</p>
    <p class="status">键盘中/高级关卡：${yesNo(snapshot.features?.keyboardAdvancedLevel)}</p>
    <p class="status">字典进阶释义：${yesNo(snapshot.features?.dictionaryAdvanced)}</p>
  `;
}

function planFeatureItems(plan) {
  const printLimit = plan.quotas?.worksheetPrintDailyLimit;
  const lookupLimit = plan.quotas?.dictionaryLookupDailyLimit;
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
  const currentPlanId = store && typeof store.getSubscription === "function" ? store.getSubscription().planId : "free";
  refs.planGrid.innerHTML = "";
  plans.forEach((plan) => {
    const card = document.createElement("article");
    card.className = `plan-card${plan.id === currentPlanId ? " active" : ""}`;
    const actionText =
      plan.id === currentPlanId ? "当前方案" : plan.id === "free" ? "切换为基础版" : "模拟开通该方案";
    card.innerHTML = `
      <h3 class="plan-title">${plan.name}</h3>
      <p class="plan-price">${plan.priceLabel}</p>
      <p class="plan-desc">${plan.description || ""}</p>
      <ul class="plan-list">
        ${planFeatureItems(plan)
          .map((item) => `<li>${item}</li>`)
          .join("")}
      </ul>
      <button type="button" data-plan-id="${plan.id}" class="${plan.id === currentPlanId ? "ghost" : ""}">
        ${actionText}
      </button>
    `;
    refs.planGrid.appendChild(card);
  });
}

function switchPlan(planId) {
  if (!store || typeof store.setSubscription !== "function") {
    return;
  }
  const current = store.getSubscription();
  if (current.planId === planId) {
    refs.actionTip.textContent = "已是当前方案。";
    return;
  }
  const next = store.setSubscription(planId, "pricing_center");
  refs.actionTip.textContent = `已切换到 ${next.planId === "free" ? "基础版" : "进阶版"}（演示环境为本地模拟开通）。`;
  renderAll();
}

function bindEvents() {
  refs.planGrid.addEventListener("click", (event) => {
    const node = event.target.closest("button[data-plan-id]");
    if (!node) {
      return;
    }
    switchPlan(node.dataset.planId);
  });
}

function renderAll() {
  renderCurrentPlan();
  renderPlanCards();
}

function bootstrap() {
  bindEvents();
  renderAll();
}

bootstrap();
