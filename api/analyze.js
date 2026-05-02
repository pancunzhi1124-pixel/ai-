const TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
const FACE_API_URL = "https://aip.baidubce.com/rest/2.0/face/v3/detect";
const BODY_API_URL = "https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis";

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "只允许 POST 请求",
      issue: "请求方式不正确，请刷新页面后重试。"
    });
  }

  const { image, type = "face", angle = "front" } = req.body || {};

  if (!image || typeof image !== "string") {
    return res.status(400).json({
      error: "未接收到图片",
      issue: "没有读取到图片，请重新上传。"
    });
  }

  if (!["face", "posture"].includes(type)) {
    return res.status(400).json({
      error: "评估类型不正确",
      issue: "请选择面容状态或体态趋势后再上传。"
    });
  }

  const AK = process.env.BAIDU_API_KEY;
  const SK = process.env.BAIDU_SECRET_KEY;

  if (!AK || !SK) {
    return res.status(500).json({
      error: "服务器 API 密钥未配置",
      title: "系统配置未完成",
      score: "--",
      issue: "服务器还没有配置 BAIDU_API_KEY 或 BAIDU_SECRET_KEY。",
      suggestion: "请在 Vercel 的 Environment Variables 中添加百度智能云 API Key 和 Secret Key，然后重新部署。",
      nextStep: "配置完成后重新上传照片即可。",
      actions: [
        "打开 Vercel 项目设置",
        "进入 Environment Variables",
        "添加 BAIDU_API_KEY 和 BAIDU_SECRET_KEY"
      ],
      note: "请不要把 API Key 写进前端或提交到 GitHub。",
      isFallback: true
    });
  }

  try {
    const token = await getBaiduAccessToken(AK, SK);

    let report;

    if (type === "face") {
      report = await analyzeFaceState(token, image);
    } else {
      report = await analyzePostureState(token, image, angle);
    }

    return res.status(200).json(report);
  } catch (error) {
    console.error("Analyze error:", error);

    return res.status(200).json(getSystemFallback(type));
  }
};

function setJsonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

async function getBaiduAccessToken(apiKey, secretKey) {
  const url =
    `${TOKEN_URL}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(apiKey)}` +
    `&client_secret=${encodeURIComponent(secretKey)}`;

  const response = await fetch(url, {
    method: "POST"
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("Baidu token response:", data);
    throw new Error("百度 Access Token 获取失败");
  }

  return data.access_token;
}

async function analyzeFaceState(token, image) {
  const response = await fetch(`${FACE_API_URL}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image,
      image_type: "BASE64",
      face_field: "age,beauty,face_shape,quality"
    })
  });

  const data = await response.json();

  if (!response.ok || data.error_code || !data.result || !Array.isArray(data.result.face_list) || data.result.face_list.length === 0) {
    console.warn("Face API fallback:", data);
    return getFaceFallback();
  }

  const face = data.result.face_list[0];

  const rawScore = Number(face.beauty);
  const score = Number.isFinite(rawScore) ? clamp(Math.round(rawScore), 60, 96) : 78;

  const shapeType = face.face_shape && face.face_shape.type;
  const shapeInfo = getFaceShapeInfo(shapeType);

  const age = Number(face.age);
  const ageText = Number.isFinite(age) ? `视觉状态参考约 ${Math.round(age)} 岁，仅供观察。` : "视觉状态参考未稳定识别。";

  return {
    title: "面容状态评估",
    score,
    issue: `AI 识别到你的脸型倾向为「${shapeInfo.label}」。${shapeInfo.issue} ${ageText}`,
    suggestion: shapeInfo.suggestion,
    nextStep: "建议把睡眠、饮水、经期状态、饮食和护肤执行情况记录到 Notion，看 7 天后的状态变化。",
    actions: [
      "今晚记录睡眠时间和饮水量",
      "做 3 分钟咬肌与面部放松",
      "在 Notion 中记录今日气色和情绪状态"
    ],
    note: "本结果为 AI 生活管理参考，不代表医学判断，也不用于评价个人价值。",
    isFallback: false
  };
}

function getFaceShapeInfo(shapeType) {
  const map = {
    square: {
      label: "方脸 / 骨骼感脸型",
      issue: "下颌区域存在更强的轮廓感，日常压力大或咬肌紧张时，容易显得疲惫。",
      suggestion: "建议优先关注睡眠、咬肌放松、肩颈放松和抗炎饮食，而不是盲目追求快速改变。"
    },
    round: {
      label: "圆脸 / 软组织感脸型",
      issue: "面部软组织感较明显，熬夜、盐分摄入和经期前后更容易出现浮肿感。",
      suggestion: "建议从饮水、低盐饮食、睡眠和轻运动开始追踪，连续记录 7 天更容易看到变化。"
    },
    oval: {
      label: "鹅蛋脸 / 流畅型脸型",
      issue: "整体轮廓较流畅，但作息不稳定时，容易在眼周、法令纹和面中状态上体现疲惫感。",
      suggestion: "建议建立早晚护肤、睡眠和饮食记录，重点观察状态波动，而不是只看单次照片。"
    },
    heart: {
      label: "心形脸 / 上庭优势脸型",
      issue: "上半脸优势较明显，压力大或胶原流失时，容易显得太阳穴或面中不够饱满。",
      suggestion: "建议关注蛋白质摄入、睡眠质量、力量训练和面部放松，减少状态波动。"
    },
    long: {
      label: "长脸 / 线条型脸型",
      issue: "脸部纵向线条更明显，疲劳时容易显得中庭偏长或气色不足。",
      suggestion: "建议减少熬夜，记录经期前后气色变化，同时配合肩颈放松改善整体精神感。"
    }
  };

  return map[shapeType] || {
    label: "自然脸型",
    issue: "当前照片下的脸型特征较均衡，状态变化更可能来自睡眠、情绪、饮食和经期节律。",
    suggestion: "建议用 Notion 连续记录 7 天睡眠、饮水、饮食和情绪，找到影响状态的主要变量。"
  };
}

async function analyzePostureState(token, image, angle) {
  const params = new URLSearchParams();
  params.append("image", image);

  const response = await fetch(`${BODY_API_URL}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();

  if (
    !response.ok ||
    data.error_code ||
    !data.person_num ||
    !Array.isArray(data.person_info) ||
    data.person_info.length === 0 ||
    !data.person_info[0].body_parts
  ) {
    console.warn("Body API fallback:", data);
    return getPostureFallback("照片角度、光线、衣物或背景可能影响了人体关键点识别。");
  }

  const parts = data.person_info[0].body_parts;

  if (angle === "side") {
    return analyzeSidePosture(parts);
  }

  return analyzeFrontPosture(parts);
}

function analyzeFrontPosture(parts) {
  const leftShoulder = getPart(parts, "left_shoulder");
  const rightShoulder = getPart(parts, "right_shoulder");

  if (!leftShoulder || !rightShoulder) {
    return getPostureFallback("这张照片没有稳定识别到左右肩位置。");
  }

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  const diffRatio = shoulderWidth > 0 ? shoulderDiff / shoulderWidth : 0;

  let score = 88;
  let issue = "";
  let suggestion = "";
  let actions = [];

  if (diffRatio >= 0.09) {
    score = 68;
    issue = `AI 捕捉到左右肩高度存在较明显差异，约为肩宽的 ${Math.round(diffRatio * 100)}%。这提示你可能存在单侧发力、单肩背包、久坐歪斜等习惯风险。`;
    suggestion = "建议先从生活习惯入手，减少单侧背包和长期歪坐，并在 Notion 中安排肩颈放松、背部激活和对称性训练。";
    actions = [
      "今天避免单肩背包",
      "做 5 分钟胸肌拉伸和肩胛后缩练习",
      "在 Notion 中记录今天的坐姿和背包习惯"
    ];
  } else if (diffRatio >= 0.045) {
    score = 78;
    issue = `AI 捕捉到左右肩高度有轻微差异，约为肩宽的 ${Math.round(diffRatio * 100)}%。这不一定代表问题，但值得观察你的日常姿势习惯。`;
    suggestion = "建议连续 7 天记录久坐时间、背包方式和运动情况，观察肩颈紧张是否和生活习惯有关。";
    actions = [
      "工作 45 分钟后起身活动 2 分钟",
      "做 3 组肩胛后缩",
      "记录今天肩颈紧张程度"
    ];
  } else {
    score = 90;
    issue = "AI 未发现明显左右肩高度差异。当前正面肩部平衡度较好，但久坐、低头和核心无力仍可能影响长期体态。";
    suggestion = "建议继续维持良好坐姿，并在 Notion 中加入背部训练、核心激活和拉伸打卡。";
    actions = [
      "做 5 分钟背部激活",
      "记录今天久坐时间",
      "睡前完成一次肩颈拉伸"
    ];
  }

  return {
    title: "体态趋势评估",
    score,
    issue,
    suggestion,
    nextStep: "建议导入 Notion 体态管理计划，连续记录肩颈状态、久坐时间和训练完成度。",
    actions,
    note: "本结果根据照片关键点生成，仅作生活管理参考，不替代医学诊断或康复评估。",
    isFallback: false
  };
}

function analyzeSidePosture(parts) {
  const leftShoulder = getPart(parts, "left_shoulder");
  const rightShoulder = getPart(parts, "right_shoulder");
  const neck = getPart(parts, "neck");
  const leftHip = getPart(parts, "left_hip");
  const rightHip = getPart(parts, "right_hip");

  if (!leftShoulder || !rightShoulder || !neck) {
    return getPostureFallback("这张侧面照没有稳定识别到肩颈位置。");
  }

  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };

  let torsoReference = 220;

  if (leftHip && rightHip) {
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };

    torsoReference = Math.max(
      1,
      Math.hypot(neck.x - hipCenter.x, neck.y - hipCenter.y)
    );
  }

  const forwardDiff = Math.abs(neck.x - shoulderCenter.x);
  const forwardRatio = forwardDiff / torsoReference;

  let score = 86;
  let issue = "";
  let suggestion = "";
  let actions = [];

  if (forwardRatio >= 0.12) {
    score = 66;
    issue = `AI 捕捉到侧面肩颈中轴存在明显偏移，偏移比例约为 ${Math.round(forwardRatio * 100)}%。这提示你可能有低头、探颈或长期伏案习惯风险。`;
    suggestion = "建议优先调整屏幕高度，减少长时间低头，并把下巴微收、胸椎伸展和肩颈放松加入 Notion 打卡。";
    actions = [
      "把手机抬高到视线附近使用",
      "做 5 次下巴微收练习",
      "记录今天低头使用手机的时间"
    ];
  } else if (forwardRatio >= 0.065) {
    score = 76;
    issue = `AI 捕捉到侧面肩颈中轴有轻微偏移，偏移比例约为 ${Math.round(forwardRatio * 100)}%。这可能和久坐、低头或肩颈紧张有关。`;
    suggestion = "建议连续 7 天记录屏幕使用时间，并加入轻量肩颈拉伸和胸椎活动。";
    actions = [
      "工作时让屏幕和视线尽量平齐",
      "每 45 分钟做一次肩颈活动",
      "在 Notion 中记录肩颈酸胀程度"
    ];
  } else {
    score = 88;
    issue = "AI 未发现明显侧面肩颈中轴偏移。当前侧面体态趋势较稳定，但仍建议持续记录久坐和低头习惯。";
    suggestion = "建议保持屏幕高度、规律运动和背部训练，把体态管理变成长期习惯。";
    actions = [
      "做一次胸椎伸展",
      "记录今日坐姿状态",
      "完成 5 分钟肩颈放松"
    ];
  }

  return {
    title: "侧面体态趋势评估",
    score,
    issue,
    suggestion,
    nextStep: "建议导入 Notion 体态管理计划，连续追踪低头时间、肩颈紧张和拉伸完成度。",
    actions,
    note: "本结果根据照片关键点生成，仅作生活管理参考，不替代医学诊断或康复评估。",
    isFallback: false
  };
}

function getPart(parts, name) {
  const part = parts && parts[name];

  if (
    !part ||
    typeof part.x !== "number" ||
    typeof part.y !== "number" ||
    Number.isNaN(part.x) ||
    Number.isNaN(part.y)
  ) {
    return null;
  }

  return part;
}

function getFaceFallback() {
  return {
    title: "面容状态参考",
    score: 76,
    issue: "这张照片的光线、角度或遮挡可能不适合精细识别，因此先为你生成一份通用面容状态建议。",
    suggestion: "建议从睡眠、饮水、经期状态、饮食和情绪记录入手，观察哪些生活变量最影响你的气色和精神感。",
    nextStep: "你可以换一张更清晰的正脸照重新评估，也可以先导入 Notion 模板，从今天开始记录状态。",
    actions: [
      "今晚记录睡眠和饮水",
      "做 3 分钟面部放松",
      "在 Notion 中记录今日气色"
    ],
    note: "本结果是通用生活管理建议，不代表医学判断，也不用于评价个人价值。",
    isFallback: true
  };
}

function getPostureFallback(reason) {
  return {
    title: "体态状态参考",
    score: 74,
    issue: `${reason} 因此本次先生成通用体态自查建议。`,
    suggestion: "建议重新上传一张光线清晰、能看见肩颈线条的照片。也可以先从久坐时间、低头时间、肩颈紧张程度和背部训练完成度开始记录。",
    nextStep: "导入 Notion 体态管理计划，连续记录 7 天，你会更容易发现体态问题背后的生活习惯。",
    actions: [
      "今天记录久坐总时长",
      "做 5 分钟肩颈拉伸",
      "完成 2 组肩胛后缩练习"
    ],
    note: "本结果是通用生活管理建议，不替代医学诊断或专业康复评估。",
    isFallback: true
  };
}

function getSystemFallback(type) {
  if (type === "posture") {
    return getPostureFallback("云端评估暂时不稳定，可能是网络、图片格式或接口响应导致。");
  }

  return {
    ...getFaceFallback(),
    issue: "云端评估暂时不稳定，可能是网络、图片格式或接口响应导致。因此本次先生成通用面容状态建议。"
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
