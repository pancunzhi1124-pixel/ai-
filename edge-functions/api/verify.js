export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();
    const accessCode = (body.accessCode || "").trim();

    const CODE_MAP = {
      "BASIC-2026": { version: "basic", expiryDate: "2026-12-31" },
      "PRO-2026": { version: "pro", expiryDate: "2026-12-31" }
    };

    const plan = CODE_MAP[accessCode];

    if (!plan) {
      return json({ success: false, message: "访问码无效。" }, 401);
    }

    return json({ success: true, version: plan.version, expiryDate: plan.expiryDate });
  } catch (e) {
    return json({ success: false, message: "请求格式错误。" }, 400);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
