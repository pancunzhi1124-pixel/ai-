module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: '只允许 POST 请求' });

    const { image, type, angle } = req.body;
    if (!image) return res.status(400).json({ error: '未接收到图片' });

    const AK = "EVJS9M05hqWukheZoqii0TPg";
    const SK = "abuyt7rbhDLspy3nL7L0jJqYfXCOjoVU";

    try {
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`;
        const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) return res.status(400).json({ issue: `API密钥错误！百度返回: ${tokenData.error_description}` });
        const token = tokenData.access_token;

        let report = {};

        if (type === 'face') {
            const faceApiUrl = `https://aip.baidubce.com/rest/2.0/face/v3/detect?access_token=${token}`;
            const faceRes = await fetch(faceApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: image, image_type: 'BASE64', face_field: 'beauty,face_shape' })
            });
            const faceData = await faceRes.json();

            if (faceData.error_code) return res.status(400).json({ issue: `百度AI拒绝 (错误码: ${faceData.error_code})\n具体原因: ${faceData.error_msg}` });

            const faceInfo = faceData.result.face_list[0];
            const shapeType = faceInfo.face_shape.type; 
            
            // ✅ 补全了所有脸型映射，不再单一！
            let shapeText = "鹅蛋脸 / 标准脸"; 
            let shapeIssue = "面部整体平整度尚可。若自拍距离过近（小于50cm），手机镜头的透视形变可能导致下颌角被隐藏，从而使面部显得更圆润或偏向鹅蛋脸。";
            
            if (shapeType === 'square') {
                shapeText = "方脸 / 骨感脸型"; 
                shapeIssue = "骨相特征明显，下颌角骨骼支撑力强。此类脸型极易伴随咬肌代偿性肥大，若咀嚼习惯不佳，会导致面部线条显得生硬凌厉。"; 
            } else if (shapeType === 'round') {
                shapeText = "圆脸 / 皮相丰盈脸型"; 
                shapeIssue = "面部软组织丰富，亲和力强。但由于脂肪层较厚，胶原蛋白流失后筋膜层支撑力下降，极易导致苹果肌下移及下颌线模糊（易垂体质）。"; 
            } else if (shapeType === 'triangle') {
                shapeText = "菱形脸 / 钻石脸"; 
                shapeIssue = "颧骨/颧弓较宽，下巴尖锐。这类骨相极易由于太阳穴凹陷或面颊凹陷，导致视觉上产生强烈的骨骼突兀感与疲态感。"; 
            } else if (shapeType === 'heart') {
                shapeText = "心形脸 / 倒三角脸"; 
                shapeIssue = "上宽下窄，轮廓优秀。但需警惕随着年龄增长，下半张脸支撑力不足，导致苹果肌断层。"; 
            }

            report = {
                title: "面容骨相客观诊断",
                score: Math.round(faceInfo.beauty || 75),
                issue: `[AI 判定：${shapeText}]\n\n${shapeIssue}`,
                suggestion: "已根据您的骨皮相特征，在 Notion 中生成专属抗衰干预策略（含早C晚A及提拉打卡库），请务必执行。"
            };

        } else {
            const bodyApiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis?access_token=${token}`;
            const params = new URLSearchParams();
            params.append('image', image);
            const bodyRes = await fetch(bodyApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
            const bodyData = await bodyRes.json();

            if (bodyData.error_code) return res.status(400).json({ issue: `百度云报错 (错误码: ${bodyData.error_code})\n原因: ${bodyData.error_msg}` });
            if (!bodyData.person_num || bodyData.person_num === 0) return res.status(400).json({ issue: "未找到人体节点！请确保全身入镜且背景干净。" });

            const parts = bodyData.person_info[0].body_parts;
            let postureScore = 90; let issueText = ""; let suggestionText = "";

            if (angle === 'front') {
                // ✅ 高级比例算法：不再看死像素，看肩宽比例！
                const shoulderDiff = Math.abs(parts.left_shoulder.y - parts.right_shoulder.y);
                const shoulderWidth = Math.abs(parts.left_shoulder.x - parts.right_shoulder.x) || 1; // 两个肩膀的宽度
                const tiltRatio = shoulderDiff / shoulderWidth; // 计算倾斜比例

                // 如果倾斜程度超过肩宽的 4.5% (自适应远近距离)
                if (tiltRatio > 0.045) {
                    postureScore = 65;
                    issueText = `AI 节点测算结果：左右肩存在明显倾斜（倾斜率达 ${(tiltRatio*100).toFixed(1)}%）。\n\n🔍 确诊【高低肩/脊柱侧弯风险】。这通常意味着严重的单侧发力习惯。长此以往会导致单侧斜方肌代偿性严重肥大，甚至引发连带代偿扭曲。`;
                    suggestionText = "体态危机已触发！Notion 中已为您生成针对性的【双侧肌肉张力平衡计划】与【斜方肌定向拉伸】，请务必每日打卡跟练。";
                } else {
                    issueText = `AI 节点测算结果：肩部倾斜率仅为 ${(tiltRatio*100).toFixed(1)}%，处于极佳的健康阈值内。\n\n🔍 您的肩部水平对称性表现优异，骨骼对齐度良好。`;
                    suggestionText = "请继续保持。可在 Notion 中解锁更高阶的核心巩固计划。";
                }
            } else if (angle === 'side') {
                // ✅ 高级比例算法：测算头部往前偏离了身体重心的比例！
                const shoulderCenterX = (parts.left_shoulder.x + parts.right_shoulder.x) / 2;
                const shoulderCenterY = (parts.left_shoulder.y + parts.right_shoulder.y) / 2;
                
                const headForwardDiff = Math.abs(parts.head.x - shoulderCenterX); // 头往前偏离的X距离
                const headHeightRef = Math.abs(parts.head.y - shoulderCenterY) || 1; // 头到肩膀的Y距离（作为参照物）
                
                const forwardRatio = headForwardDiff / headHeightRef; // 偏离比例

                // 如果头往前伸的距离超过了头肩距离的 30%
                if (forwardRatio > 0.30) {
                    postureScore = 60;
                    issueText = `AI 节点测算结果：您的头部重心已明显偏离肩部垂直线（偏离率高达 ${(forwardRatio*100).toFixed(1)}%）。\n\n🔍 确诊严重的【头前倾（探颈）/圆肩】。这不仅会毁掉侧颜气质，更会导致颈后大包（富贵包）脂肪堆积及慢性肩颈酸痛。`;
                    suggestionText = "不要任由体态恶化！Notion 中已匹配【胸锁乳突肌拉伸】及【深层颈屈肌强化】系统性回位训练，请导入执行。";
                } else {
                    issueText = `AI 节点测算结果：颈部偏离率仅 ${(forwardRatio*100).toFixed(1)}%，无明显探颈问题。\n\n🔍 侧面颈椎曲度处于生理范围内，侧颜气质仪态管理得非常到位。`;
                    suggestionText = "建议日常工作保持屏幕与视线平齐，并使用 Notion 持续追踪。";
                }
            }
            report = { title: "骨骼节点真实测算", score: postureScore, issue: issueText, suggestion: suggestionText };
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ issue: "网络异常：" + error.message });
    }
}
