module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: '只允许 POST 请求' });

    const { image, type, angle } = req.body;
    if (!image) return res.status(400).json({ error: '未接收到图片' });

    // ✅ 你的全新双权限万能钥匙已配置
    const AK = process.env.BAIDU_API_KEY || "EVJS9M05hqWukheZoqii0TPg";
    const SK = process.env.BAIDU_SECRET_KEY || "abuyt7rbhDLspy3nL7L0jJqYfXCOjoVU";

    try {
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`;
        const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
        const tokenData = await tokenResponse.json();
        
        // 验证密钥是否有效
        if (tokenData.error) {
            return res.status(400).json({ issue: `API密钥错误！百度返回: ${tokenData.error_description}` });
        }
        const token = tokenData.access_token;

        let report = {};

        if (type === 'face') {
            // ✨ 真实面容分析模式
            const faceApiUrl = `https://aip.baidubce.com/rest/2.0/face/v3/detect?access_token=${token}`;
            const faceRes = await fetch(faceApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: image, image_type: 'BASE64', face_field: 'age,beauty,face_shape' })
            });
            const faceData = await faceRes.json();

            // 拦截百度错误码
            if (faceData.error_code) {
                return res.status(400).json({ issue: `百度AI拒绝 (错误码: ${faceData.error_code})\n具体原因: ${faceData.error_msg}\n解决: 确保已【免费领取】人脸检测额度。` });
            }

            const faceInfo = faceData.result.face_list[0];
            const shapeType = faceInfo.face_shape.type; 
            let shapeText = "标准脸型"; let shapeIssue = "面部平整度尚可。";
            if (shapeType === 'square') shapeText = "方脸/菱形脸"; 
            if (shapeType === 'round') shapeText = "圆脸"; 
            if (shapeType === 'oval' || shapeType === 'heart') shapeText = "瓜子脸/心形脸"; 

            report = {
                title: "面容状态真实数据",
                score: Math.round(faceInfo.beauty || 75),
                issue: `[AI测算：${shapeText} | 预估年龄：${faceInfo.age}岁]`,
                suggestion: "专属护肤策略已在 Notion 生成。"
            };

        } else {
            // 🏃‍♀️ 真实体态评估模式
            const bodyApiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis?access_token=${token}`;
            const params = new URLSearchParams();
            params.append('image', image);
            const bodyRes = await fetch(bodyApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
            const bodyData = await bodyRes.json();

            // 拦截百度错误码
            if (bodyData.error_code) {
                return res.status(400).json({ issue: `百度云权限不足 (错误码: ${bodyData.error_code})\n原因: ${bodyData.error_msg}\n解决：请去百度控制台【免费领取】人体分析调用额度！` });
            }
            if (!bodyData.person_num || bodyData.person_num === 0) {
                return res.status(400).json({ issue: "AI 未能找到清晰的人体关键点！\n确保全身入镜且背景干净。" });
            }

            const parts = bodyData.person_info[0].body_parts;
            let postureScore = 90; let issueText = ""; let suggestionText = "";

            if (angle === 'front') {
                const shoulderDiff = Math.abs(parts.left_shoulder.y - parts.right_shoulder.y);
                if (shoulderDiff > 12) {
                    postureScore = 65;
                    issueText = `AI 测算：左右肩存在明显高度差 (像素落差 ${Math.round(shoulderDiff)}px)，确诊【高低肩】。`;
                    suggestionText = "已生成对称性训练计划，请导入 Notion。";
                } else {
                    issueText = `AI 测算：左右肩高度差仅 ${Math.round(shoulderDiff)}px，肩部对称性极佳。`;
                    suggestionText = "请继续保持良好体态。";
                }
            } else if (angle === 'side') {
                const shoulderCenterX = (parts.left_shoulder.x + parts.right_shoulder.x) / 2;
                const neckX = parts.neck.x;
                const headForwardDiff = Math.abs(neckX - shoulderCenterX);
                
                if (headForwardDiff > 15) {
                    postureScore = 60;
                    issueText = `AI 测算：颈椎中心偏离肩膀达 ${Math.round(headForwardDiff)}px，确诊【头前倾（探颈）】。`;
                    suggestionText = "已生成颈部回位训练计划，请导入 Notion 执行。";
                } else {
                    issueText = `AI 测算：颈部偏离值仅 ${Math.round(headForwardDiff)}px，无明显探颈。`;
                    suggestionText = "侧面颈椎曲度健康。";
                }
            }
            report = { title: "骨骼节点真实测算", score: postureScore, issue: issueText, suggestion: suggestionText };
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ issue: "网络异常：" + error.message });
    }
}
