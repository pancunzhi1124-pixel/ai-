const CONFIG = {
  verifyApi: "/api/verify",
  aiLinks: {
    basicInterview: "https://example.com/coze-basic-interviewer",
    proInterview: "https://example.com/coze-pro-interviewer",
    reviewAssistant: "https://example.com/coze-review-assistant"
  }
};

const state = {
  version: null,
  expiryDate: "",
  roleFilter: "全部"
};

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const dashboard = document.getElementById("dashboard");
const loginSection = document.getElementById("loginSection");
const versionText = document.getElementById("versionText");
const expiryText = document.getElementById("expiryText");
const roleFilter = document.getElementById("roleFilter");
const questionList = document.getElementById("questionList");
const answerList = document.getElementById("answerList");
const cameraBtn = document.getElementById("cameraBtn");
const cameraMsg = document.getElementById("cameraMsg");
const cameraPreview = document.getElementById("cameraPreview");
const aiLinks = document.getElementById("aiLinks");

function setMsg(el, text, type = "") {
  el.textContent = text;
  el.className = `msg ${type}`.trim();
}

function showUpgradeHint() {
  alert("该功能属于 Offer 决胜版，升级后可使用高压面试官与复盘助手。");
}

function initRoleFilter() {
  const roles = ["全部", ...new Set(window.QUESTION_BANK.map((q) => q.job))];
  roleFilter.innerHTML = roles.map((role) => `<option value="${role}">${role}</option>`).join("");
}

function getFilteredQuestions() {
  if (state.roleFilter === "全部") return window.QUESTION_BANK;
  return window.QUESTION_BANK.filter((q) => q.job === state.roleFilter);
}

function renderQuestions() {
  const list = getFilteredQuestions();
  questionList.innerHTML = list.map((q) => `<li><strong>[${q.job}]</strong> ${q.question}</li>`).join("");

  answerList.innerHTML = list
    .map(
      (q) => `
      <div class="answer-item">
        <button type="button" class="answer-head" data-id="${q.id}">展开答案：${q.question}</button>
        <div class="answer-body hidden" id="answer-${q.id}"><p><strong>轮次：</strong>${q.round}</p><p><strong>考察点：</strong>${q.intent}</p><p><strong>答题框架：</strong>${q.framework}</p><p><strong>参考作答：</strong>${q.standardAnswer}</p><p><strong>高频追问：</strong>${q.followups.join("；")}</p><p><strong>常见扣分点：</strong>${q.mistakes.join("；")}</p></div>
      </div>
    `
    )
    .join("");
}

function renderVersionFeatures() {
  const isPro = state.version === "pro";
  versionText.textContent = isPro ? "Offer 决胜版" : "岗位通关版";
  expiryText.textContent = state.expiryDate || "请联系客服确认";

  const links = [
    `<a class="action-link" href="${CONFIG.aiLinks.basicInterview}" target="_blank" rel="noopener">基础 AI 面试官</a>`
  ];

  if (isPro) {
    links.push(`<a class="action-link" href="${CONFIG.aiLinks.proInterview}" target="_blank" rel="noopener">高压 AI 面试官</a>`);
    links.push(`<a class="action-link" href="${CONFIG.aiLinks.reviewAssistant}" target="_blank" rel="noopener">面试复盘助手</a>`);
  } else {
    links.push(`<button type="button" class="action-link lock" data-pro-feature="true">高压 AI 面试官（升级后可用）</button>`);
    links.push(`<button type="button" class="action-link lock" data-pro-feature="true">面试复盘助手（升级后可用）</button>`);
  }

  aiLinks.innerHTML = links.join("");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const accessCode = document.getElementById("accessCode").value.trim();
  if (!accessCode) return;

  setMsg(loginMsg, "正在验证访问码...");
  try {
    const res = await fetch(CONFIG.verifyApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      setMsg(loginMsg, data.message || "访问码无效，请重试。", "error");
      return;
    }

    state.version = data.version;
    state.expiryDate = data.expiryDate;
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    renderVersionFeatures();
    renderQuestions();
    setMsg(loginMsg, "验证成功", "success");
  } catch (error) {
    setMsg(loginMsg, "网络异常，请稍后重试。", "error");
  }
});

roleFilter.addEventListener("change", (e) => {
  state.roleFilter = e.target.value;
  renderQuestions();
});

answerList.addEventListener("click", (e) => {
  const btn = e.target.closest(".answer-head");
  if (!btn) return;
  const id = btn.dataset.id;
  const body = document.getElementById(`answer-${id}`);
  const isHidden = body.classList.toggle("hidden");
  btn.textContent = `${isHidden ? "展开" : "收起"}答案：${window.QUESTION_BANK.find((q) => String(q.id) === id).question}`;
});

aiLinks.addEventListener("click", (e) => {
  const locked = e.target.closest("[data-pro-feature='true']");
  if (!locked) return;
  showUpgradeHint();
});

cameraBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    cameraPreview.srcObject = stream;
    cameraPreview.classList.remove("hidden");
    setMsg(cameraMsg, "摄像头检测成功，可正常预览。", "success");
  } catch (error) {
    setMsg(cameraMsg, "摄像头检测失败，请检查浏览器权限与设备状态。", "error");
  }
});

initRoleFilter();
renderQuestions();
