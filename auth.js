const refs = {
  sessionText: document.getElementById("sessionText"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginBtn: document.getElementById("loginBtn"),
  loginTip: document.getElementById("loginTip"),
  registerUsername: document.getElementById("registerUsername"),
  registerDisplayName: document.getElementById("registerDisplayName"),
  registerPassword: document.getElementById("registerPassword"),
  registerRole: document.getElementById("registerRole"),
  inviteCode: document.getElementById("inviteCode"),
  registerBtn: document.getElementById("registerBtn"),
  registerTip: document.getElementById("registerTip"),
};

const cloud = window.CloudSync;

function showTip(node, text) {
  if (!node) {
    return;
  }
  node.textContent = text;
}

function roleText(role) {
  return role === "teacher" ? "教师" : "学生";
}

async function refreshSession() {
  if (!cloud) {
    refs.sessionText.textContent = "云同步模块未加载。";
    return;
  }
  const session = await cloud.getSession();
  if (!session.loggedIn || !session.user) {
    refs.sessionText.textContent = "当前未登录。登录后可启用多用户云同步。";
    return;
  }
  refs.sessionText.textContent = `已登录：${session.user.username}（${roleText(session.user.role)}）`;
}

async function doLogin() {
  if (!cloud) {
    return;
  }
  showTip(refs.loginTip, "登录中...");
  try {
    const payload = await cloud.login({
      username: refs.loginUsername.value.trim(),
      password: refs.loginPassword.value,
    });
    showTip(refs.loginTip, `登录成功，欢迎 ${payload.user.username}`);
    refs.loginPassword.value = "";
    await refreshSession();
  } catch (error) {
    showTip(refs.loginTip, `登录失败：${error.message}`);
  }
}

async function doRegister() {
  if (!cloud) {
    return;
  }
  showTip(refs.registerTip, "注册中...");
  try {
    const payload = await cloud.register({
      username: refs.registerUsername.value.trim(),
      displayName: refs.registerDisplayName.value.trim(),
      password: refs.registerPassword.value,
      role: refs.registerRole.value,
      inviteCode: refs.inviteCode.value.trim(),
    });
    showTip(refs.registerTip, `注册成功，当前已登录为 ${payload.user.username}`);
    refs.registerPassword.value = "";
    refs.inviteCode.value = "";
    await refreshSession();
  } catch (error) {
    showTip(refs.registerTip, `注册失败：${error.message}`);
  }
}

async function doLogout() {
  if (!cloud) {
    return;
  }
  await cloud.logout();
  showTip(refs.loginTip, "");
  showTip(refs.registerTip, "");
  await refreshSession();
}

function bindEvents() {
  refs.loginBtn?.addEventListener("click", doLogin);
  refs.registerBtn?.addEventListener("click", doRegister);
  refs.logoutBtn?.addEventListener("click", doLogout);
}

async function bootstrap() {
  bindEvents();
  await refreshSession();
}

bootstrap();
