import { register as registerService } from '../services/authService.js';

export const registerController = async (req, res, next) => {
    const { name, email, password } = req.body;

    // Express 5 自动捕获 async 错误，直接传递给 error handler
    const result = await registerService({ name, email, password });

    res.status(201).json({
        message: 'created',
        data: result,
    });
};
