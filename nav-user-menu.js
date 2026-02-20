(function () {
  const TOKEN_KEY = "cloudAuthTokenV1";
  const USER_KEY = "cloudAuthUserV1";
  const PROFILE_KEY = "userProfileV1";
  const STYLE_ID = "navUserMenuStyleV1";
  const PRIORITY_CHANNEL_LABELS = ["汉字总览", "拼音频道", "分级练习", "字帖工坊", "小学语文"];
  const REMOVED_NAV_LABELS = new Set(["首页", "新华字典"]);

  const LEGACY_NAV_PAGES = new Set(["calendar.html", "auth.html", "teacher.html", "user.html"]);
  const USER_SCOPE_PAGES = new Set(["calendar.html", "auth.html", "teacher.html", "user.html"]);

  function safeReadText(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function safeReadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeUser(rawUser) {
    if (!rawUser || typeof rawUser !== "object") {
      return null;
    }
    const username = String(rawUser.username || "").trim();
    const displayName = String(rawUser.displayName || "").trim();
    const role = rawUser.role === "teacher" ? "teacher" : "student";
    if (!username && !displayName) {
      return null;
    }
    return { username, displayName, role };
  }

  function getCachedSession() {
    const token = safeReadText(TOKEN_KEY);
    const user = normalizeUser(safeReadJson(USER_KEY, null));
    if (!token || !user) {
      return { loggedIn: false, user: null };
    }
    return { loggedIn: true, user };
  }

  async function getResolvedSession(fallback) {
    const cloud = window.CloudSync;
    if (!cloud || typeof cloud.getSession !== "function") {
      return fallback;
    }
    try {
      const session = await cloud.getSession();
      if (!session?.loggedIn || !session?.user) {
        return { loggedIn: false, user: null };
      }
      const user = normalizeUser(session.user);
      return user ? { loggedIn: true, user } : { loggedIn: false, user: null };
    } catch (error) {
      return fallback;
    }
  }

  function clearLocalSessionCache() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  async function logoutAndRedirect() {
    const cloud = window.CloudSync;
    if (cloud && typeof cloud.logout === "function") {
      try {
        await cloud.logout();
      } catch (error) {
        clearLocalSessionCache();
      }
    } else {
      clearLocalSessionCache();
    }
    window.location.href = "./auth.html";
  }

  function getCurrentFileName() {
    const fullPath = String(window.location.pathname || "");
    const file = fullPath.split("/").pop() || "index.html";
    return file.toLowerCase();
  }

  function getFileNameFromHref(href) {
    try {
      const url = new URL(String(href || ""), window.location.href);
      return (url.pathname.split("/").pop() || "").toLowerCase();
    } catch (error) {
      return "";
    }
  }

  function getProfileNameFallback() {
    const profile = safeReadJson(PROFILE_KEY, {});
    return String(profile?.displayName || "").trim();
  }

  function getDisplayName(user) {
    return String(user?.displayName || "").trim() || getProfileNameFallback() || String(user?.username || "").trim() || "用户";
  }

  function getRoleLabel(role) {
    return role === "teacher" ? "教师" : "学生";
  }

  function getAvatarText(displayName) {
    const chars = [...String(displayName || "").trim()];
    if (!chars.length) {
      return "U";
    }
    const first = chars[0];
    if (/[a-z]/i.test(first)) {
      return first.toUpperCase();
    }
    return first;
  }

  function removeLegacyLinks(container) {
    const links = [...container.querySelectorAll(":scope > a[href]")];
    links.forEach((link) => {
      const text = String(link.textContent || "").trim();
      if (REMOVED_NAV_LABELS.has(text)) {
        link.remove();
        return;
      }
      const file = getFileNameFromHref(link.getAttribute("href"));
      if (LEGACY_NAV_PAGES.has(file)) {
        link.remove();
      }
    });
  }

  function reorderChannelLinks(container) {
    const allLinks = [...container.querySelectorAll(":scope > a[href]")];
    if (!allLinks.length) {
      return;
    }

    const selected = new Set();
    const priorityLinks = [];

    PRIORITY_CHANNEL_LABELS.forEach((label) => {
      const matched = allLinks.find((link) => {
        if (selected.has(link)) {
          return false;
        }
        const text = String(link.textContent || "").trim();
        return text === label;
      });
      if (matched) {
        selected.add(matched);
        priorityLinks.push(matched);
      }
    });

    if (!priorityLinks.length) {
      return;
    }

    const others = allLinks.filter((link) => !selected.has(link));
    [...priorityLinks, ...others].forEach((link) => {
      container.appendChild(link);
    });
  }

  function createMenuLink(text, href) {
    const link = document.createElement("a");
    link.className = "nav-user-item";
    link.href = href;
    link.textContent = text;
    return link;
  }

  function createDivider() {
    const divider = document.createElement("div");
    divider.className = "nav-user-divider";
    return divider;
  }

  function createLogoutButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-user-item nav-user-logout";
    button.textContent = "退出登录";
    button.addEventListener("click", () => {
      logoutAndRedirect();
    });
    return button;
  }

  function buildTrigger(session) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "nav-user-trigger";
    const currentFile = getCurrentFileName();
    if (USER_SCOPE_PAGES.has(currentFile)) {
      trigger.classList.add("active");
    }

    const avatar = document.createElement("span");
    avatar.className = "nav-user-avatar";
    const name = document.createElement("span");
    name.className = "nav-user-name";
    const caret = document.createElement("span");
    caret.className = "nav-user-caret";
    caret.textContent = "▾";

    if (session.loggedIn && session.user) {
      const displayName = getDisplayName(session.user);
      avatar.textContent = getAvatarText(displayName);
      name.textContent = displayName;
    } else {
      avatar.textContent = "未";
      name.textContent = "用户中心";
    }

    trigger.appendChild(avatar);
    trigger.appendChild(name);
    trigger.appendChild(caret);
    return trigger;
  }

  function buildDropdown(session) {
    const menu = document.createElement("div");
    menu.className = "nav-user-dropdown";

    if (!session.loggedIn || !session.user) {
      const tip = document.createElement("p");
      tip.className = "nav-user-tip";
      tip.textContent = "登录后可同步学习进度，并进入学习日历与用户中心。";
      menu.appendChild(tip);
      menu.appendChild(createMenuLink("去登录 / 注册", "./auth.html"));
      return menu;
    }

    const head = document.createElement("p");
    head.className = "nav-user-meta";
    head.textContent = `${getDisplayName(session.user)}（${getRoleLabel(session.user.role)}）`;
    menu.appendChild(head);

    if (session.user.role === "teacher") {
      menu.appendChild(createMenuLink("教师端入口", "./teacher.html"));
      menu.appendChild(createMenuLink("教师端学生报告", "./teacher.html"));
    } else {
      menu.appendChild(createMenuLink("学习日历", "./calendar.html"));
      menu.appendChild(createMenuLink("用户中心", "./user.html"));
    }

    menu.appendChild(createDivider());
    menu.appendChild(createLogoutButton());
    return menu;
  }

  function mountUserMenu(container, session) {
    const existing = container.querySelector(".nav-user-entry");
    if (existing) {
      existing.remove();
    }

    const entry = document.createElement("div");
    entry.className = "nav-user-entry";

    const trigger = buildTrigger(session);
    const dropdown = buildDropdown(session);
    entry.appendChild(trigger);
    entry.appendChild(dropdown);
    container.appendChild(entry);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      entry.classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
      if (!entry.contains(event.target)) {
        entry.classList.remove("open");
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        entry.classList.remove("open");
      }
    });
  }

  function injectStyleOnce() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .nav-user-entry {
        position: relative;
        margin-left: auto;
        z-index: 1200;
      }
      .nav-user-trigger {
        font: inherit;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #d8e1ef;
        border-radius: 999px;
        padding: 6px 10px;
        background: #ffffff;
        color: #1f2937;
        cursor: pointer;
        font-weight: 600;
      }
      .nav-user-trigger:hover,
      .nav-user-trigger.active {
        background: #e8efff;
        color: #1d4ed8;
        border-color: #bfdbfe;
      }
      .nav-user-avatar {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        line-height: 1;
      }
      .nav-user-name {
        max-width: 112px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nav-user-caret {
        font-size: 11px;
        opacity: 0.85;
      }
      .nav-user-dropdown {
        display: none;
        position: absolute;
        right: 0;
        top: calc(100% + 8px);
        min-width: 220px;
        border: 1px solid #d8e1ef;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 14px 26px rgba(15, 23, 42, 0.14);
        padding: 8px;
      }
      .nav-user-entry.open .nav-user-dropdown {
        display: block;
      }
      .nav-user-meta {
        margin: 4px 8px 8px;
        font-size: 12px;
        color: #52607a;
      }
      .nav-user-tip {
        margin: 4px 8px 8px;
        font-size: 12px;
        color: #52607a;
        line-height: 1.5;
      }
      .nav-user-item {
        font: inherit;
        display: block;
        width: 100%;
        text-align: left;
        text-decoration: none;
        border: 0;
        border-radius: 8px;
        padding: 8px 10px;
        background: transparent;
        color: #1f2937;
        cursor: pointer;
      }
      .nav-user-item:hover {
        background: #eef4ff;
        color: #1d4ed8;
      }
      .nav-user-divider {
        height: 1px;
        margin: 6px 4px;
        background: #e6ecf7;
      }
      .nav-user-logout {
        color: #b91c1c;
      }
      @media (max-width: 860px) {
        .nav-user-entry {
          margin-left: 0;
        }
        .nav-user-dropdown {
          right: auto;
          left: 0;
          min-width: 200px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getNavContainers() {
    return [
      ...document.querySelectorAll(".nav .links, .nav .nav-links, .site-nav"),
    ];
  }

  function renderToAllContainers(session) {
    const containers = getNavContainers();
    if (!containers.length) {
      return;
    }
    containers.forEach((container) => {
      reorderChannelLinks(container);
      removeLegacyLinks(container);
      mountUserMenu(container, session);
    });
  }

  async function bootstrap() {
    injectStyleOnce();
    const cached = getCachedSession();
    renderToAllContainers(cached);
    const resolved = await getResolvedSession(cached);
    renderToAllContainers(resolved);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
