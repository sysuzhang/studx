(function () {
  const TOKEN_KEY = "cloudAuthTokenV1";
  const USER_KEY = "cloudAuthUserV1";
  const API_BASE =
    typeof window.CLOUD_API_BASE === "string" && window.CLOUD_API_BASE.trim()
      ? window.CLOUD_API_BASE.trim().replace(/\/+$/, "")
      : "";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setSession(token, user) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function getCachedUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  async function request(path, options) {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}${path}`, {
      method: options?.method || "GET",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }
    if (!response.ok) {
      const msg = payload?.message || `请求失败（${response.status}）`;
      const error = new Error(msg);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function collectSnapshot() {
    const keysMap = window.LearningStore?.keys || {};
    const keyList = Object.values(keysMap).filter(Boolean);
    const snapshot = {};
    keyList.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) {
          return;
        }
        snapshot[key] = JSON.parse(raw);
      } catch (error) {
        // Skip malformed local entries.
      }
    });
    return snapshot;
  }

  function applySnapshot(snapshot, mode) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return { applied: 0 };
    }
    const keysMap = window.LearningStore?.keys || {};
    const keyList = Object.values(keysMap).filter(Boolean);
    let applied = 0;
    keyList.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
        try {
          localStorage.setItem(key, JSON.stringify(snapshot[key]));
          applied += 1;
        } catch (error) {
          // Ignore key write failures.
        }
      } else if (mode === "replace") {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          // Ignore key remove failures.
        }
      }
    });
    return { applied };
  }

  async function register(input) {
    const payload = await request("/api/auth/register", {
      method: "POST",
      body: {
        username: input?.username || "",
        password: input?.password || "",
        displayName: input?.displayName || "",
        role: input?.role || "student",
        inviteCode: input?.inviteCode || "",
      },
    });
    setSession(payload.token, payload.user);
    return payload;
  }

  async function login(input) {
    const payload = await request("/api/auth/login", {
      method: "POST",
      body: {
        username: input?.username || "",
        password: input?.password || "",
      },
    });
    setSession(payload.token, payload.user);
    return payload;
  }

  async function logout() {
    const token = getToken();
    if (!token) {
      setSession("", null);
      return { ok: true };
    }
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // Even on error, clear client session.
    }
    setSession("", null);
    return { ok: true };
  }

  async function getSession() {
    const token = getToken();
    if (!token) {
      return { loggedIn: false, user: null };
    }
    try {
      const payload = await request("/api/auth/me", { method: "GET" });
      setSession(token, payload.user || null);
      return {
        loggedIn: true,
        user: payload.user || null,
        session: payload.session || null,
      };
    } catch (error) {
      setSession("", null);
      return { loggedIn: false, user: null };
    }
  }

  async function getSyncStatus() {
    return request("/api/sync/status", { method: "GET" });
  }

  async function uploadLocalProgress() {
    const snapshot = collectSnapshot();
    return request("/api/sync/upload", {
      method: "POST",
      body: {
        snapshot,
        clientTs: Date.now(),
      },
    });
  }

  async function downloadCloudProgress(mode) {
    const payload = await request("/api/sync/download", { method: "GET" });
    if (!payload?.hasSnapshot || !payload?.snapshot) {
      return { ...payload, applied: 0 };
    }
    const result = applySnapshot(payload.snapshot, mode || "replace");
    return {
      ...payload,
      applied: result.applied,
    };
  }

  async function getTeacherStudents() {
    return request("/api/teacher/students", { method: "GET" });
  }

  async function getTeacherStudentReport(studentId) {
    return request(`/api/teacher/students/${encodeURIComponent(studentId)}/report`, { method: "GET" });
  }

  async function getBillingPlans() {
    return request("/api/billing/plans", { method: "GET" });
  }

  async function getBillingSubscription() {
    return request("/api/billing/subscription", { method: "GET" });
  }

  async function changeBillingSubscription(planId) {
    return request("/api/billing/subscription/change", {
      method: "POST",
      body: { planId: planId || "free" },
    });
  }

  async function createBillingOrder(input) {
    return request("/api/billing/orders/create", {
      method: "POST",
      body: {
        planId: input?.planId || "free",
        provider: input?.provider || "stripe",
      },
    });
  }

  async function getBillingOrder(orderId) {
    return request(`/api/billing/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  }

  async function listBillingOrders() {
    return request("/api/billing/orders", { method: "GET" });
  }

  window.CloudSync = {
    API_BASE,
    getToken,
    getCachedUser,
    getSession,
    register,
    login,
    logout,
    getSyncStatus,
    uploadLocalProgress,
    downloadCloudProgress,
    collectSnapshot,
    applySnapshot,
    getTeacherStudents,
    getTeacherStudentReport,
    getBillingPlans,
    getBillingSubscription,
    changeBillingSubscription,
    createBillingOrder,
    getBillingOrder,
    listBillingOrders,
  };
})();
