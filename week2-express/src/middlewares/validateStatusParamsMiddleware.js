import { validateStatus } from '../utils/validators.js';

export const validateStatusParam = (req, res, next) => {
    const { valid, value } = validateStatus(req.query.status);
    if (!valid) {
        return res.status(400).json({
            error: 'status 必须是以下之一：pending、completed、canceled、refunding、refunded',
        });
    }

    req.status = value;
    next();
};
