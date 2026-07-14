import {
    register as registerService,
    login as loginService
} from '../services/authService.js';

export const registerController = async (req, res, next) => {
    const { name, email, password } = req.body;

    // Express 5 自动捕获 async 错误，直接传递给 error handler
    const result = await registerService({ name, email, password });

    res.status(201).json({
        message: 'created',
        data: result,
    });
};

export const loginController = async (req, res, next) => {
    const { email, password } = req.body;
    const result = await loginService({ email, password });
    res.status(200).json({
        message: 'Login successful',
        data: result,
    });
};

