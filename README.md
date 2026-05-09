# 大厂 AI 面试训练网页（EdgeOne Pages）

适合小红书售卖后的交付场景：用户购买后在订单发货信息中拿到链接和访问码，登录后按开通版本进行训练。

## 项目结构

```
.
├── index.html
├── style.css
├── app.js
├── questions.js
├── edge-functions/
│   └── api/
│       └── verify.js
└── README.md
```

## 已实现功能

- 登录页提示：访问码在小红书订单发货信息中查看。
- 访问码登录（EdgeOne Pages Functions 验证）。
- 登录成功后显示：当前开通版本、有效期、使用步骤。
- 题库中心（岗位筛选）。
- 标准答案（展开 / 收起）。
- 摄像头检测（`navigator.mediaDevices.getUserMedia`）。
- 版本能力控制：
  - 岗位通关版（basic）：仅可使用基础 AI 面试官。
  - Offer 决胜版（pro）：可使用基础 AI 面试官 + 高压 AI 面试官 + 面试复盘助手。
- basic 用户点击 pro 功能时，弹出升级提示。
- 页面底部免责声明：
  - 本产品为 AI 模拟训练工具，不承诺实际面试结果，请结合个人真实经历使用。

## 如何部署到腾讯 EdgeOne Pages

1. 将本项目推送到你的 Git 仓库。
2. 在 EdgeOne Pages 中连接该仓库并创建站点。
3. 选择静态站点部署（纯 HTML/CSS/JS）。
4. `edge-functions/api/verify.js` 会处理 `/api/verify` 请求。

## 如何修改访问码和有效期

编辑 `edge-functions/api/verify.js` 中 `CODE_MAP`：

```js
const CODE_MAP = {
  "BASIC-2026": { version: "basic", expiryDate: "2026-12-31" },
  "PRO-2026": { version: "pro", expiryDate: "2026-12-31" }
};
```

- key：访问码。
- `version`：`basic` 或 `pro`。
- `expiryDate`：返回给前端展示的有效期。

## 如何修改题库

编辑 `questions.js` 的 `window.QUESTION_BANK`：

```js
{
  id: 1,
  role: "前端开发",
  question: "题目内容",
  answer: "参考答案内容"
}
```

## 如何修改扣子链接

编辑 `app.js` 中 `CONFIG.aiLinks`：

```js
aiLinks: {
  basicInterview: "https://你的基础面试官链接",
  proInterview: "https://你的高压面试官链接",
  reviewAssistant: "https://你的复盘助手链接"
}
```
