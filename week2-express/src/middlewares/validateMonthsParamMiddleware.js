import { validatePositiveInt } from '../utils/validators.js';

export const validateMonthsParam = (req, res, next) => {
    const { valid, value } = validatePositiveInt(req.query.months, 6);
    if (!valid) {
        return res.status(400).json({ error: 'months 必须是正整数' });
    }

    req.months = value;
    next();
};
