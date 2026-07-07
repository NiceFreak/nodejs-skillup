import { validateDays } from "../utils/validators.js";

export const validateDaysParam = (req, res, next) => {
    const { valid, value } = validateDays(req.query.days);
    if (!valid) {
        return res.status(400).json({ error: 'Days must be a positive integer' });
    }

    req.days = value;
    next();
};
