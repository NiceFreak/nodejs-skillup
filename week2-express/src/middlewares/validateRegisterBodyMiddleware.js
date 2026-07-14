export const validateRegisterBody = (req, res, next) => {
    const { name, email, password } = req.body;

    // 1. 必填存在性
    if (name === undefined || email === undefined || password === undefined) {
        return res.status(400).json({
            code: 400,
            message: 'Missing required fields: name, email, password',
        });
    }

    // 2. 类型检查
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
            code: 400,
            message: 'name, email, and password must be strings',
        });
    }

    // 3. name 不能为空字符串或纯空白
    if (name.trim().length === 0) {
        return res.status(400).json({
            code: 400,
            message: 'name cannot be empty',
        });
    }

    // 4. email 基础格式（与 User Schema 保持一致）
    // Schema 中写的是 /^\S+@\S+\.\S+$/，这里直接用同样的正则
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            code: 400,
            message: 'Invalid email format',
        });
    }

    // 5. password 不能是纯空白（但保留原始空格给 Service 层做 hash）
    if (password.trim().length === 0) {
        return res.status(400).json({
            code: 400,
            message: 'Password cannot be empty or contain only whitespace',
        });
    }

    // 注意：密码最小长度 15 位由 authService 检查，此处放行
    next();
};
