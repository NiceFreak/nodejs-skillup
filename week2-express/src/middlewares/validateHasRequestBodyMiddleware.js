import { hasRequestBody } from '../utils/validators.js';

export const validateHasRequestBody = (req, res, next) => {
    if (!hasRequestBody(req.body)) {
        return res.status(400).json({ error: '请求体缺失' });
    }
    next();
};
