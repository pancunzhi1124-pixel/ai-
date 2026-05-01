module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    // 接收图片和“分析类型(type)”
    const { image, type } = req.body;
    if (!image) {
        return res.status(400).json({ error: '没有获取到图片' });
    }

    try {
        // 模拟 AI 深度计算耗时 2 秒，让前端动画飞一会
        await new Promise(resolve => setTimeout(resolve, 2000));

        let report = {};

        // 逻辑分支：面部 VS 体态
        if (type === 'face') {
            // 面容专业报告库
            const faceResults = [
                { score: 88, issue: "面部平整度极佳，但存在轻微法令纹初老特征，眼周略显疲态。", suggestion: "加入抗氧化精华，尝试早晨面部冷敷与眼周拨筋，延缓胶原蛋白流失。" },
                { score: 85, issue: "下颌线略微模糊，可能与咀嚼肌紧张或晨起轻度水肿有关。", suggestion: "建议低钠饮食，配合早间黑咖啡及下颌线提拉操，塑造紧致轮廓。" },
                { score: 82, issue: "中庭比例偏长，T区有轻微出油与毛孔粗大迹象，影响整体清透感。", suggestion: "温和刷酸（水杨酸）清理毛孔，化妆时注重苹果肌提亮以缩短中庭视觉。" }
            ];
            report = faceResults[Math.floor(Math.random() * faceResults.length)];
            report.title = "面容抗衰诊断报告";
        } else {
            // 体态专业报告库
            const postureResults = [
                { score: 72, issue: "存在轻度骨盆前倾，可能导致下腹部突出（假性小肚腩）及腰椎受力过大。", suggestion: "加强下腹部核心力量（如死虫子动作），拉伸髂腰肌，日常注意站姿收腹。" },
                { score: 76, issue: "颈部有前探趋势（探颈），斜方肌紧张，易导致假性双下巴及气质减分。", suggestion: "背部肌肉群唤醒（如弹力带划船），日常使用电脑注意屏幕高度，拉伸胸大肌。" },
                { score: 78, issue: "肩部轻微内扣（圆肩），背部力量薄弱，影响整体呼吸深度与直角肩形态。", suggestion: "强化中下斜方肌（YTWL训练），拉伸胸小肌，保持沉肩坠肘的习惯。" }
            ];
            report = postureResults[Math.floor(Math.random() * postureResults.length)];
            report.title = "骨相体态分析报告";
        }

        // 返回定制化结果
        res.status(200).json(report);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '服务器处理失败' });
    }
}
