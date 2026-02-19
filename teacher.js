const refs = {
  sessionText: document.getElementById("sessionText"),
  refreshBtn: document.getElementById("refreshBtn"),
  studentListBody: document.getElementById("studentListBody"),
  reportHead: document.getElementById("reportHead"),
  statsGrid: document.getElementById("statsGrid"),
  activityList: document.getElementById("activityList"),
};

const cloud = window.CloudSync;

const state = {
  rows: [],
  selectedStudentId: "",
};

function formatTime(ts) {
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

function activityText(log) {
  if (!log || typeof log !== "object") {
    return "学习活动";
  }
  const type = log.type || "activity";
  const payload = log.payload || {};
  if (type === "typing_game_finish") {
    return `完成打字闯关：分数 ${payload.score || 0}，命中率 ${payload.accuracy || 0}%`;
  }
  if (type === "keyboard_practice_finish") {
    return `完成键盘练习：分数 ${payload.score || 0}，速度 ${payload.speed || 0}`;
  }
  if (type === "follow_reading") {
    return `完成跟读：${payload.char || "-"}（${payload.level || "记录"}）`;
  }
  if (type === "dictionary_lookup") {
    return `查询新华字典：${payload.char || "-"}`;
  }
  if (type === "worksheet_add") {
    return `加入字帖：${(payload.chars || []).join("") || "-"}`;
  }
  return `学习操作：${type}`;
}

function renderList() {
  refs.studentListBody.innerHTML = "";
  if (!state.rows.length) {
    refs.studentListBody.innerHTML = `<tr><td colspan="5" class="empty">暂无学生同步数据。</td></tr>`;
    return;
  }
  state.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = `selectable${row.id === state.selectedStudentId ? " active" : ""}`;
    tr.innerHTML = `
      <td>${row.displayName || row.username}</td>
      <td>${formatTime(row.lastSyncedAt)}</td>
      <td>${row.stats?.learnedChars || 0}</td>
      <td>${row.stats?.typingBestScore || 0}</td>
      <td>${row.stats?.keyboardBestSpeed || 0}</td>
    `;
    tr.addEventListener("click", () => {
      state.selectedStudentId = row.id;
      renderList();
      loadStudentReport(row.id);
    });
    refs.studentListBody.appendChild(tr);
  });
}

function renderStats(stats) {
  refs.statsGrid.innerHTML = "";
  const rows = [
    { label: "已学汉字", value: stats.learnedChars || 0 },
    { label: "累计打卡任务", value: stats.completedTasks || 0 },
    { label: "打字场次", value: stats.typingGames || 0 },
    { label: "打字最高分", value: stats.typingBestScore || 0 },
    { label: "键盘场次", value: stats.keyboardSessions || 0 },
    { label: "键盘最高速", value: stats.keyboardBestSpeed || 0 },
    { label: "跟读次数", value: stats.followReadingCount || 0 },
    { label: "跟读准确率", value: `${stats.followReadingAccuracy || 0}%` },
    { label: "日任务完成天数", value: stats.keyboardDailyDoneDays || 0 },
    { label: "最近活动", value: formatTime(stats.lastActivityAt || 0) },
  ];
  rows.forEach((item) => {
    const card = document.createElement("article");
    card.className = "stat";
    card.innerHTML = `<p class="label">${item.label}</p><p class="value">${item.value}</p>`;
    refs.statsGrid.appendChild(card);
  });
}

function renderActivities(logs) {
  refs.activityList.innerHTML = "";
  if (!logs.length) {
    refs.activityList.innerHTML = `<li class="empty">暂无活动明细。</li>`;
    return;
  }
  logs.slice(0, 20).forEach((log) => {
    const li = document.createElement("li");
    li.textContent = `${formatTime(log.ts)} - ${activityText(log)}`;
    refs.activityList.appendChild(li);
  });
}

async function loadStudentReport(studentId) {
  if (!cloud || !studentId) {
    return;
  }
  refs.reportHead.textContent = "报告加载中...";
  refs.statsGrid.innerHTML = "";
  refs.activityList.innerHTML = "";
  try {
    const payload = await cloud.getTeacherStudentReport(studentId);
    const studentName = payload?.student?.displayName || payload?.student?.username || "学生";
    if (!payload?.hasReport || !payload?.report) {
      refs.reportHead.textContent = `${studentName} 尚未上传云端学习数据。`;
      return;
    }
    refs.reportHead.textContent = `${studentName} - 最近同步：${formatTime(payload.updatedAt)}（版本 ${
      payload.version
    }）`;
    renderStats(payload.report.stats || {});
    renderActivities(payload.report.recentActivities || []);
  } catch (error) {
    refs.reportHead.textContent = `加载失败：${error.message}`;
  }
}

async function loadStudents() {
  if (!cloud) {
    refs.sessionText.textContent = "CloudSync 模块未加载。";
    return;
  }
  const session = await cloud.getSession();
  if (!session.loggedIn || !session.user) {
    refs.sessionText.textContent = "未登录：请先前往登录页使用教师账号登录。";
    refs.studentListBody.innerHTML = `<tr><td colspan="5" class="empty">请先登录。</td></tr>`;
    return;
  }
  if (session.user.role !== "teacher") {
    refs.sessionText.textContent = `当前账号 ${session.user.username} 不是教师角色，无法查看教师报表。`;
    refs.studentListBody.innerHTML = `<tr><td colspan="5" class="empty">权限不足。</td></tr>`;
    return;
  }

  refs.sessionText.textContent = `教师已登录：${session.user.username}，可查看学生学习报告。`;
  try {
    const payload = await cloud.getTeacherStudents();
    state.rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!state.rows.find((item) => item.id === state.selectedStudentId)) {
      state.selectedStudentId = state.rows[0]?.id || "";
    }
    renderList();
    if (state.selectedStudentId) {
      await loadStudentReport(state.selectedStudentId);
    } else {
      refs.reportHead.textContent = "暂无学生可查看。";
      refs.statsGrid.innerHTML = "";
      refs.activityList.innerHTML = `<li class="empty">暂无活动明细。</li>`;
    }
  } catch (error) {
    refs.studentListBody.innerHTML = `<tr><td colspan="5" class="empty">加载失败：${error.message}</td></tr>`;
    refs.reportHead.textContent = "报告加载失败。";
  }
}

function bindEvents() {
  refs.refreshBtn?.addEventListener("click", loadStudents);
}

function bootstrap() {
  bindEvents();
  loadStudents();
}

bootstrap();
