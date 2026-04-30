module.exports = async function handler(req, res) {
    // 确保是 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    // 从前端接收 base64 格式的图片
    const { image } = req.body;
    if (!image) {
        return res.status(400).json({ error: '没有获取到图片' });
    }

    // 从 Vercel 环境变量中读取你在第一步获取的 API Key 和 Secret Key
    const AK = process.env.BAIDU_API_KEY;
    const SK = process.env.BAIDU_SECRET_KEY;

    try {
        // 模拟 AI 计算耗时 1.5 秒
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 生成高转化率的体态痛点诊断
        const diagnosticResults = [
            { score: 72, issue: "存在轻微骨盆前倾，可能导致下腹部突出。", suggestion: "加强下腹部核心力量，拉伸髂腰肌。" },
            { score: 76, issue: "颈部有前探趋势（富贵包前期风险），斜方肌紧张。", suggestion: "背部肌肉群唤醒，日常注意低头频率。" },
            { score: 78, issue: "肩部轻微内扣（圆肩），影响整体气质与呼吸深度。", suggestion: "强化中下斜方肌，拉伸胸大肌。" }
        ];

        // 随机抽取一个报告给用户（制造定制感）
        const randomReport = diagnosticResults[Math.floor(Math.random() * diagnosticResults.length)];

        // 返回给前端
        res.status(200).json(randomReport);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '服务器处理失败' });
    }
}
