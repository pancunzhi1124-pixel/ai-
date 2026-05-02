module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: '只允许 POST 请求' });

    const { image, type, angle } = req.body;
    if (!image) return res.status(400).json({ error: '未接收到图片' });

    // 🔒 你的万能双权限钥匙
    const AK = "EVJS9M05hqWukheZoqii0TPg";
    const SK = "abuyt7rbhDLspy3nL7L0jJqYfXCOjoVU";

    try {
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`;
        const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            return res.status(400).json({ issue: `API密钥错误！百度返回: ${tokenData.error_description}` });
        }
        const token = tokenData.access_token;

        let report = {};

        if (type === 'face') {
            const faceApiUrl = `https://aip.baidubce.com/rest/2.0/face/v3/detect?access_token=${token}`;
            const faceRes = await fetch(faceApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: image, image_type: 'BASE64', face_field: 'beauty,face_shape' }) // 删除了 age 参数
            });
            const faceData = await faceRes.json();

            if (faceData.error_code) {
                return res.status(400).json({ issue: `百度AI拒绝 (错误码: ${faceData.error_code})\n具体原因: ${faceData.error_msg}\n解决: 确保已【免费领取】人脸检测额度。` });
            }

            const faceInfo = faceData.result.face_list[0];
            const shapeType = faceInfo.face_shape.type; 
            
            // 📝 【文案大升级】：扩充面部分析的专业度，完全去除年龄
            let shapeText = "标准比例脸型"; 
            let shapeIssue = "面部整体平整度与流畅度尚可，骨相与皮相分布较为均衡。但随着日常作息与重力影响，仍需警惕潜在的筋膜层松弛与面中轻微凹陷风险。";
            
            if (shapeType === 'square') {
                shapeText = "方脸 / 骨骼感偏重脸型"; 
                shapeIssue = "骨相特征明显，下颌角骨骼支撑力强，自带高级冷感。\n\n🔍 潜在痛点解析：此类脸型极易伴随咬肌的代偿性肥大与过度紧张。若日常咀嚼习惯不佳，会导致下庭视觉明显变宽，面部线条显得生硬凌厉，甚至产生明显的劳累感与严肃感。"; 
            }
            if (shapeType === 'round') {
                shapeText = "圆脸 / 皮相丰盈脸型"; 
                shapeIssue = "面部软组织丰富，皮相饱满，具有极强的亲和力与幼态感。\n\n🔍 潜在痛点解析：由于脂肪层与软组织较厚，随着胶原蛋白不可逆的流失，筋膜层支撑力会迅速下降。这极易导致苹果肌下移、法令纹明显加深，以及下颌线逐渐模糊（出现假性双下巴），属于抗老难度较高的“易垂”体质。"; 
            }
            if (shapeType === 'oval' || shapeType === 'heart') {
                shapeText = "瓜子脸 / 心形脸"; 
                shapeIssue = "整体轮廓流畅优秀，上宽下窄，符合主流审美的黄金比例。\n\n🔍 潜在痛点解析：由于下庭收窄，面颊两侧支撑力相对较弱。一旦面临胶原蛋白流失或气血不足，极易凸显颧骨高度，导致太阳穴轻微凹陷与面颊干瘪，从而产生骨骼突兀的视觉疲态。"; 
            }

            report = {
                title: "面容骨相客观诊断",
                score: Math.round(faceInfo.beauty || 75),
                issue: `[AI 骨相识别判定：${shapeText}]\n\n${shapeIssue}`,
                suggestion: "单纯的焦虑无法带来改变。"
            };

        } else {
            const bodyApiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_analysis?access_token=${token}`;
            const params = new URLSearchParams();
            params.append('image', image);
            const bodyRes = await fetch(bodyApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
            const bodyData = await bodyRes.json();

            if (bodyData.error_code) {
                return res.status(400).json({ issue: `百度云权限不足 (错误码: ${bodyData.error_code})\n原因: ${bodyData.error_msg}\n解决：请去百度控制台【免费领取】人体分析调用额度！` });
            }
            if (!bodyData.person_num || bodyData.person_num === 0) {
                return res.status(400).json({ issue: "AI 未能找到清晰的人体关键点！\n确保全身入镜且背景干净。" });
            }

            const parts = bodyData.person_info[0].body_parts;
            let postureScore = 90; let issueText = ""; let suggestionText = "";

            // 📝 【文案大升级】：扩充体态分析的痛点放大与原理解析
            if (angle === 'front') {
                const shoulderDiff = Math.abs(parts.left_shoulder.y - parts.right_shoulder.y);
                if (shoulderDiff > 12) {
                    postureScore = 65;
                    issueText = `AI 节点测算结果：左右肩存在明显的垂直高度差（像素落差达 ${Math.round(shoulderDiff)}px）。\n\n🔍 深度体态解析：系统已确诊您存在显著的【高低肩】及潜在的【脊柱侧弯】风险。这绝不仅仅是视觉上的不美观，它通常意味着您存在严重的单侧发力习惯（如长期单肩背包、歪斜坐姿）。长此以往，会导致单侧斜方肌代偿性严重肥大（视觉上脖子变短），甚至引发胸椎及腰椎的连带代偿扭曲。`;
                    suggestionText = "体态危机已触发！请立刻停止一切错误的发力习惯。";
                } else {
                    issueText = `AI 节点测算结果：左右肩高度差仅 ${Math.round(shoulderDiff)}px，处于极佳的健康阈值内。\n\n🔍 深度体态解析：您的肩部水平对称性表现优异，未发现明显的代偿性发力问题，骨骼对齐度良好，展现出了极好的仪态底气。`;
                    suggestionText = "请继续保持这份自律。";
                }
            } else if (angle === 'side') {
                const shoulderCenterX = (parts.left_shoulder.x + parts.right_shoulder.x) / 2;
                const neckX = parts.neck.x;
                const headForwardDiff = Math.abs(neckX - shoulderCenterX);
                
                if (headForwardDiff > 15) {
                    postureScore = 60;
                    issueText = `AI 节点测算结果：您的颈椎中心已明显偏离肩部垂直生理中轴线（偏离值高达 ${Math.round(headForwardDiff)}px）。\n\n🔍 深度体态解析：系统确诊您存在严重的【头前倾（探颈）】及圆肩问题。这种不良体态不仅会从侧面毁掉气质，更可怕的是，会导致颈后大包（富贵包）脂肪堆积、下颌线消失（假性双下巴），以及长期的慢性肩颈酸痛。`;
                    suggestionText = "不要任由体态继续恶化！";
                } else {
                    issueText = `AI 节点测算结果：颈部偏离值仅 ${Math.round(headForwardDiff)}px，无明显探颈问题。\n\n🔍 深度体态解析：侧面颈椎曲度处于非常健康的生理范围内。耳垂与肩峰基本保持在同一条垂直线上，侧颜气质仪态管理得非常到位。`;
                    suggestionText = "侧面仪态十分优雅。建议日常工作保持屏幕与视线平齐，并使用 Notion 持续追踪体态数据。";
                }
            }
            report = { title: "骨骼节点真实测算", score: postureScore, issue: issueText, suggestion: suggestionText };
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ issue: "网络异常：" + error.message });
    }
}
