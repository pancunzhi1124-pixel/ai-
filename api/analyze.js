module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    const { image, type } = req.body;
    if (!image) return res.status(400).json({ error: '未接收到图片' });

    // 【终极修复区】：这里是配置 API 密钥的地方
    // 首选：自动读取你在 Vercel 填写的环境变量（最安全）
    // 备选：如果你一定要写死在代码里，请把你的钥匙写在双引号里面！
    const AK = process.env.BAIDU_API_KEY || "4tUV7LvmNhf23gu8phRyKjkK";
    const SK = process.env.BAIDU_SECRET_KEY || "l1dwgfUgt5przilsf0GHin1g4rhTdwJG";

    if (!AK || !SK) return res.status(500).json({ error: '服务器 API 密钥未配置' });

    try {
        // 第一步：用 AK 和 SK 向百度换取“临时通行证” (Access Token)
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`;
        const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
        const tokenData = await tokenResponse.json();
        const token = tokenData.access_token;

        if (!token) {
            return res.status(500).json({ title: "授权失败", score: "Error", issue: "未能获取百度 AI 接口的 Token，请检查 AK/SK 是否填写正确。", suggestion: "请检查代码或 Vercel 的环境变量配置。" });
        }

        let report = {};

        // 第二步：根据前端传来的要求，走不同的 AI 大模型
        if (type === 'face') {
            // 🤖 调用百度【人脸检测】真实接口
            const faceApiUrl = `https://aip.baidubce.com/rest/2.0/face/v3/detect?access_token=${token}`;
            const faceRes = await fetch(faceApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: image,
                    image_type: 'BASE64',
                    face_field: 'age,beauty,face_shape' // 请求百度返回：年龄、颜值打分、脸型
                })
            });
            const faceData = await faceRes.json();

            // 如果没检测到脸
            if (faceData.error_code) {
                return res.status(400).json({ title: "诊断失败", score: "N/A", issue: "AI 未能识别到清晰的人脸。", suggestion: "请确保光线充足，五官无遮挡（如果是侧脸太偏也会识别失败）。" });
            }

            // 提取真实数据
            const faceInfo = faceData.result.face_list[0];
            const beautyScore = Math.round(faceInfo.beauty || 75); // 百度给出的客观颜值打分
            const age = Math.round(faceInfo.age || 25);
            const shapeType = faceInfo.face_shape.type; 

            // 将英文脸型翻译为中文及对应问题
            let shapeText = "标准脸型";
            let shapeIssue = "面部平整度尚可，需注意日常抗初老。";
            if (shapeType === 'square') { shapeText = "方脸/菱形脸"; shapeIssue = "下颌角骨骼感较强，可能伴随咬肌紧张，容易显得凌厉或疲惫。"; }
            if (shapeType === 'round') { shapeText = "圆脸"; shapeIssue = "面部软组织较多，随着年龄增长，筋膜层支撑力下降，易出现下垂或双下巴。"; }
            if (shapeType === 'oval' || shapeType === 'heart') { shapeText = "瓜子脸/心形脸"; shapeIssue = "轮廓优秀，但需注意面部胶原蛋白流失导致的颧骨突出或太阳穴凹陷。"; }

            report = {
                title: "面容状态真实诊断",
                score: beautyScore,
                issue: `[AI识别结果：${shapeText} | 预估视觉年龄：${age}岁] ${shapeIssue}`,
                suggestion: "建议根据不同脸型的骨相特征，定制早C晚A抗衰策略及面部瑜伽。详细抗衰食谱已在 Notion 模板中生成。"
            };

        } else {
            // 🤖 调用百度【人体关键点分析】真实接口
            const bodyApiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis?access_token=${token}`;
            
            const params = new URLSearchParams();
            params.append('image', image);

            const bodyRes = await fetch(bodyApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });
            const bodyData = await bodyRes.json();

            // 如果没检测到人
            if (!bodyData.person_num || bodyData.person_num === 0) {
                return res.status(400).json({ title: "诊断失败", score: "N/A", issue: "AI 未能识别到完整的人体骨骼结构。", suggestion: "请上传能看清肩部和躯干的半身或全身照。" });
            }

            // 提取骨骼节点真实坐标
            const parts = bodyData.person_info[0].body_parts;
            const leftShoulderY = parts.left_shoulder.y;
            const rightShoulderY = parts.right_shoulder.y;
            
            // 算力时刻：计算左右肩的落差像素（Y轴坐标差值）
            const shoulderDiff = Math.abs(leftShoulderY - rightShoulderY);
            
            let postureScore = 88;
            let issueText = "肩颈对齐度较好，未见明显高低肩问题。但需警惕日常久坐导致的体态退化。";
            let suggestionText = "维持良好的日常习惯，可配合弹力带进行背部肌肉唤醒，防止体态恶化。";

            // 如果左右肩Y轴落差超过 15 个像素，判定为真实高低肩
            if (shoulderDiff > 15) {
                postureScore = 65;
                issueText = `AI 骨骼测算显示：左右肩存在明显高度差 (像素落差约 ${Math.round(shoulderDiff)}px)，确诊为【高低肩】。这通常伴随脊柱侧弯或单侧斜方肌代偿肥大。`;
                suggestionText = "需立即停止错误的单侧发力习惯（如单肩背包、跷二郎腿）。定制的对称性康复训练与背部拉伸计划已在 Notion 准备完毕。";
            }

            report = {
                title: "骨骼体态真实测算",
                score: postureScore,
                issue: issueText,
                suggestion: suggestionText
            };
        }

        res.status(200).json(report);

    } catch (error) {
        console.error(error);
        res.status(500).json({ title: "系统过载", score: "Error", issue: "云端神经网络正在处理海量请求，请稍后重试。", suggestion: "如果一直报错，请前往百度云控制台确认是否已免费领取了该接口的调用额度。" });
    }
}
