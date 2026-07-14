const emailRegex = /^\S+@\S+\.\S+$/;

export const validateLoginBody = (req, res, next) => {
    const { email, password } = req.body;

    // 1. 必填存在性
    if (email === undefined || password === undefined) {
        return res.status(400).json({
            code: 400,
            message: 'Missing required fields: email, password',
        });
    }

    // 2. 类型检查
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
            code: 400,
            message: 'email and password must be strings',
        });
    }

    // 3. email 基础格式（与 User Schema 保持一致）
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            code: 400,
            message: 'Invalid email format',
        });
    }

    // 4. email 不能为空或纯空白
    if (email.trim().length === 0) {
        return res.status(400).json({
            code: 400,
            message: 'email cannot be empty',
        });
    }

    // 5. password 不能是纯空白
    if (password.trim().length === 0) {
        return res.status(400).json({
            code: 400,
            message: 'password cannot be empty',
        });
    }

    // 登录不检查密码长度（长度是注册策略）
    next();
};
