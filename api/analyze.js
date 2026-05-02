module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: '只允许 POST 请求' });

    const { image, type, angle } = req.body;
    if (!image) return res.status(400).json({ error: '未接收到图片' });

    // 你的真实密钥
    const AK = process.env.BAIDU_API_KEY || "4tUV7LvmNhf23gu8phRyKjkK";
    const SK = process.env.BAIDU_SECRET_KEY || "l1dwgfUgt5przilsf0GHin1g4rhTdwJG";

    try {
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`;
        const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
        const tokenData = await tokenResponse.json();
        const token = tokenData.access_token;
        
        if (!token) throw new Error("获取百度Token失败，请检查AK和SK！");

        let report = {};

        if (type === 'face') {
            // 🤖 真实面部诊断
            const faceApiUrl = `https://aip.baidubce.com/rest/2.0/face/v3/detect?access_token=${token}`;
            const faceRes = await fetch(faceApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: image, image_type: 'BASE64', face_field: 'age,beauty,face_shape' })
            });
            const faceData = await faceRes.json();

            // 【完全不兜底】如果报错，直接抛出百度的真实报错原因
            if (faceData.error_code) {
                return res.status(400).json({ issue: `百度AI拒绝测算：${faceData.error_msg}` });
            }

            const faceInfo = faceData.result.face_list[0];
            const shapeType = faceInfo.face_shape.type; 
            let shapeText = "标准脸型"; let shapeIssue = "面部平整度尚可，需注意日常抗初老。";
            if (shapeType === 'square') { shapeText = "方脸/菱形脸"; shapeIssue = "下颌角骨骼感较强，可能伴随咬肌紧张。"; }
            if (shapeType === 'round') { shapeText = "圆脸"; shapeIssue = "面部软组织较多，随着年龄增长易出现下垂或双下巴。"; }
            if (shapeType === 'oval' || shapeType === 'heart') { shapeText = "瓜子脸/心形脸"; shapeIssue = "轮廓优秀，但需注意胶原蛋白流失导致的骨骼突出。"; }

            report = {
                title: "面容状态真实数据",
                score: Math.round(faceInfo.beauty || 75),
                issue: `[AI 测算结果：${shapeText} | 预估视觉年龄：${faceInfo.age}岁] \n${shapeIssue}`,
                suggestion: "根据您的真实骨相数据，专属的护肤及饮食干预策略已在 Notion 生成。"
            };

        } else {
            // 🤖 真实骨骼体态诊断
            const bodyApiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis?access_token=${token}`;
            const params = new URLSearchParams();
            params.append('image', image);
            const bodyRes = await fetch(bodyApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
            const bodyData = await bodyRes.json();

            // 【完全不兜底】直接返回真实报错信息，让用户自己找原因
            if (bodyData.error_code) {
                return res.status(400).json({ issue: `百度AI报错：${bodyData.error_msg}` });
            }
            if (!bodyData.person_num || bodyData.person_num === 0) {
                return res.status(400).json({ issue: "AI 视觉引擎未能找到清晰的人体关键点！\n请确保：\n1. 全身在画面内\n2. 衣服尽量贴身\n3. 背景不要有复杂的杂物干扰。" });
            }

            // 提取真实骨骼坐标
            const parts = bodyData.person_info[0].body_parts;
            let postureScore = 90; let issueText = ""; let suggestionText = "";

            if (angle === 'front') {
                const shoulderDiff = Math.abs(parts.left_shoulder.y - parts.right_shoulder.y);
                if (shoulderDiff > 12) {
                    postureScore = 65;
                    issueText = `AI 精准测算：左右肩存在明显高度差 (像素落差高达 ${Math.round(shoulderDiff)}px)，确诊【高低肩】风险。`;
                    suggestionText = "请立刻停止单侧发力习惯，Notion 中已生成斜方肌拉伸与对称性训练计划。";
                } else {
                    issueText = `AI 精准测算：左右肩高度差仅为 ${Math.round(shoulderDiff)}px，肩部对称性极佳。`;
                    suggestionText = "请继续保持良好体态，可在 Notion 中跟练核心巩固计划。";
                }
            } else if (angle === 'side') {
                const shoulderCenterX = (parts.left_shoulder.x + parts.right_shoulder.x) / 2;
                const neckX = parts.neck.x;
                const headForwardDiff = Math.abs(neckX - shoulderCenterX);
                
                if (headForwardDiff > 15) {
                    postureScore = 60;
                    issueText = `AI 精准测算：您的颈椎中心偏离肩膀垂直线达 ${Math.round(headForwardDiff)}px，确诊【头前倾（探颈）】风险。`;
                    suggestionText = "已生成胸锁乳突肌拉伸及下巴微收训练计划，请导入 Notion 并强制执行。";
                } else {
                    issueText = `AI 精准测算：颈部偏离值仅为 ${Math.round(headForwardDiff)}px，未见明显探颈问题。`;
                    suggestionText = "侧面颈椎曲度处于健康范围，建议日常保持，持续追踪。";
                }
            }
            report = { title: "骨骼节点真实测算", score: postureScore, issue: issueText, suggestion: suggestionText };
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ issue: "服务器内部连接异常：" + error.message });
    }
}
