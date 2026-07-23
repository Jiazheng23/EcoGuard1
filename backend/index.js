import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
// 如果环境变量里没有定义 PORT，就默认使用 5000 端口
const PORT = process.env.PORT || 5000;

// 设置中间件
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 允许 Express 解析前端传来的 JSON 数据

// 编写一个简单的测试 API 路由
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'EcoGuard 后端服务器运行正常！' 
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`EcoGuard Backend is running on http://localhost:${PORT}`);
});