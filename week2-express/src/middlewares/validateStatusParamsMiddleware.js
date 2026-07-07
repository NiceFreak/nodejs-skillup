import { validateStatus } from "../utils/validators.js";

export const validateStatusParam = (req, res, next) => {
    const { valid, value } = validateStatus(req.query.status);
    if (!valid) {
        return res.status(400).json({ 
            error: 'Status must be one of: pending, completed, canceled, refunding, refunded' 
        });
    }

    req.status = value;
    next();
};
