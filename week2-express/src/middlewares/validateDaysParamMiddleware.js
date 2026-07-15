import { validatePositiveInt } from '../utils/validators.js';

export const validateDaysParam = (req, res, next) => {
    const { valid, value } = validatePositiveInt(req.query.days, 30);
    if (!valid) {
        return res.status(400).json({ error: 'days 必须是正整数' });
    }

    req.days = value;
    next();
};
