import { validatePositiveInt } from "../utils/validators.js";

export const validateMonthsParam = (req, res, next) => {
    const { valid, value } = validatePositiveInt(req.query.months, 6);
    if (!valid) {
        return res.status(400).json({ error: 'Months must be a positive integer' });
    }

    req.months = value;
    next();
};
