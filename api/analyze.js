const TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
const FACE_API_URL = "https://aip.baidubce.com/rest/2.0/face/v3/detect";
const BODY_API_URL = "https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis";

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  const AK = process.env.BAIDU_API_KEY;
  const SK = process.env.BAIDU_SECRET_KEY;

  if (req.method === "GET") {
    const shouldCheckToken = String(req.query?.check || "").toLowerCase() === "token";

    if (!shouldCheckToken) {
      return res.status(200).json({
        ok: true,
        message: "API 自检成功。这个接口需要 POST 图片才能进行 AI 评估。",
        env: {
          BAIDU_API_KEY: Boolean(AK),
          BAIDU_SECRET_KEY: Boolean(SK)
        },
        nextCheck: "如果想检测百度 AK/SK 是否有效，请打开 /api/analyze?check=token",
        note: "这里只显示是否存在环境变量，不会暴露你的真实密钥。"
      });
    }

    if (!AK || !SK) {
      return res.status(500).json({
        ok: false,
        message: "百度环境变量未配置完整。",
        env: {
          BAIDU_API_KEY: Boolean(AK),
          BAIDU_SECRET_KEY: Boolean(SK)
        },
        fix: [
          "打开 Vercel 项目后台",
          "进入 Settings",
          "进入 Environment Variables",
          "添加 BAIDU_API_KEY 和 BAIDU_SECRET_KEY",
          "保存后重新 Redeploy"
        ]
      });
    }

    try {
      await getBaiduAccessToken(AK, SK);

      return res.status(200).json({
        ok: true,
        message: "百度 Access Token 获取成功，说明 BAIDU_API_KEY 和 BAIDU_SECRET_KEY 基本正确。",
        next: [
          "如果面容能识别，但体态不能识别，请检查百度应用是否开通了【人体分析 / 人体关键点识别】权限。",
          "如果体态仍无法识别，请上传能看见双肩、脖子、腰胯的清晰照片。"
        ]
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: "百度 Access Token 获取失败，说明 API Key / Secret Key 可能填错，或 Vercel 环境变量没有生效。",
        error: error.message,
        fix: [
          "确认 Vercel 环境变量名字必须是 BAIDU_API_KEY 和 BAIDU_SECRET_KEY",
          "确认填的是百度智能云应用的 API Key 和 Secret Key，不是 AppID",
          "修改环境变量后必须重新 Redeploy",
          "如果密钥曾经暴露到 GitHub，建议在百度智能云后台重置密钥"
        ]
      });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "只允许 GET 自检或 POST 评估",
      issue: "请求方式不正确。"
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
        "添加 BAIDU_API_KEY 和 BAIDU_SECRET_KEY",
        "重新 Redeploy 项目"
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

    return res.status(500).json({
      error: "云端评估失败",
      title: "暂时无法生成报告",
      score: "--",
      issue: error.message || "云端评估暂时不稳定，可能是网络、接口权限、接口额度或服务器配置导致。",
      suggestion: "请先检查 Vercel 环境变量是否正确，再确认百度智能云应用是否开通了对应接口权限。",
      nextStep: "如果面容能识别但体态不能识别，重点检查百度应用是否开通了【人体分析 / 人体关键点识别】。",
      actions: [
        "打开 /api/analyze 检查环境变量是否存在",
        "打开 /api/analyze?check=token 检查 AK/SK 是否有效",
        "确认百度应用已开通人体分析",
        "重新部署 Vercel 项目"
      ],
      note: "系统错误时不生成评分，避免给出不准确结果。",
      isFallback: true
    });
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const code = data.error || data.error_code || "UNKNOWN_TOKEN_ERROR";
    const msg = data.error_description || data.error_msg || "百度 Access Token 获取失败";

    throw new Error(`百度 Token 获取失败：${code} - ${msg}`);
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
      face_field: "beauty,face_shape,quality"
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`百度人脸接口请求失败：HTTP ${response.status}`);
  }

  if (data.error_code) {
    const errorMessage = formatBaiduError("百度人脸接口返回错误", data);

    return getFaceReuploadResult(
      `${errorMessage}。如果你上传的是正脸照仍然失败，请检查百度应用是否开通了【人脸识别 / 人脸检测与属性分析】权限。`
    );
  }

  if (!data.result || !Array.isArray(data.result.face_list) || data.result.face_list.length === 0) {
    return getFaceReuploadResult("这张照片没有稳定识别到清晰人脸，可能是光线、角度、遮挡或画面距离导致。");
  }

  const face = data.result.face_list[0];

  const rawScore = Number(face.beauty);
  const score = Number.isFinite(rawScore) ? clamp(Math.round(rawScore), 60, 96) : 78;

  const shapeType = face.face_shape && face.face_shape.type;
  const shapeInfo = getFaceShapeInfo(shapeType);

  return {
    status: "success",
    title: "面容状态评估",
    score,
    issue: `AI 识别到你的脸型倾向为「${shapeInfo.label}」。${shapeInfo.issue}`,
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`百度人体接口请求失败：HTTP ${response.status}`);
  }

  if (data.error_code) {
    throw new Error(
      `${formatBaiduError("百度人体接口返回错误", data)}。这通常不是照片问题，而是接口权限、额度、图片格式或应用配置问题。请确认百度应用已开通【人体分析 / 人体关键点识别】。`
    );
  }

  if (!data.person_num || !Array.isArray(data.person_info) || data.person_info.length === 0) {
    return getPostureReuploadResult("百度人体接口没有识别到人体。请上传能看见头、脖子、双肩和上半身的清晰照片。");
  }

  const selectedPerson = selectBestPerson(data.person_info);

  if (!selectedPerson || !selectedPerson.body_parts) {
    return getPostureReuploadResult("百度人体接口返回了人体结果，但没有稳定返回身体关键点。");
  }

  const parts = selectedPerson.body_parts;

  if (angle === "side") {
    return analyzeSidePosture(parts);
  }

  return analyzeFrontPosture(parts);
}

function selectBestPerson(personInfoList) {
  if (!Array.isArray(personInfoList) || personInfoList.length === 0) {
    return null;
  }

  const scored = personInfoList.map((person) => {
    const parts = person.body_parts || {};
    const locationScore = Number(person.location?.score || 0);
    const validPartCount = Object.values(parts).filter((part) => Number(part?.score || 0) >= 0.2).length;

    return {
      person,
      score: locationScore * 10 + validPartCount
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0].person;
}

function analyzeFrontPosture(parts) {
  const leftShoulder = getPart(parts, "left_shoulder");
  const rightShoulder = getPart(parts, "right_shoulder");

  if (!leftShoulder || !rightShoulder) {
    return getPostureReuploadResult("这张照片没有稳定识别到左右肩位置。请上传正面站立照，并露出双肩。");
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
    status: "success",
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
  const leftHip = getPart(parts, "left_hip", 0.1);
  const rightHip = getPart(parts, "right_hip", 0.1);

  if (!leftShoulder || !rightShoulder || !neck) {
    return getPostureReuploadResult("这张侧面照没有稳定识别到肩颈位置。请上传能看见头、脖子、肩膀和躯干线条的侧面照。");
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
    status: "success",
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

function getPart(parts, name, minScore = 0.2) {
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

  const score = Number(part.score || 0);

  if (score < minScore) {
    return null;
  }

  return part;
}

function getFaceReuploadResult(reason) {
  return {
    status: "needs_reupload",
    title: "照片不适合识别",
    score: "--",
    issue: reason || "这张照片没有稳定识别到清晰人脸。",
    suggestion: "请重新上传一张更适合面容识别的照片。建议使用正面照，保持光线充足，五官无遮挡，避免过度美颜、侧脸、低头或远景照片。",
    nextStep: "你也可以先查看 Notion 自我经营系统，从睡眠、饮水、经期状态、饮食和情绪记录开始使用。",
    actions: [
      "使用清晰正脸照",
      "五官无遮挡",
      "避免过暗光线、强滤镜和远距离照片"
    ],
    note: "未成功识别时不生成面容评分，避免给出不准确结果。",
    isFallback: true
  };
}

function getPostureReuploadResult(reason) {
  return {
    status: "needs_reupload",
    title: "照片不适合识别",
    score: "--",
    issue: reason || "这张照片没有稳定识别到人体关键点。",
    suggestion: "请重新上传一张更适合体态识别的照片。正面照建议露出双肩、腰胯并保持站直；侧面照建议露出头颈、肩膀和躯干线条。",
    nextStep: "你也可以先查看 Notion 自我经营系统，从久坐时间、运动打卡、经期状态和身体数据开始记录。",
    actions: [
      "正面照：露出双肩和上半身",
      "侧面照：露出头颈、肩膀和躯干",
      "避免宽松外套、复杂背景和过暗光线"
    ],
    note: "未成功识别时不生成体态评分，避免给出不准确结果。",
    isFallback: true
  };
}

function formatBaiduError(prefix, data) {
  const code = data.error_code || data.error || "UNKNOWN_ERROR";
  const msg = data.error_msg || data.error_description || "未知错误";
  return `${prefix}：error_code=${code}，error_msg=${msg}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
