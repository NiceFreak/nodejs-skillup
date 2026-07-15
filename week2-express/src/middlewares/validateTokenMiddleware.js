import jwt from 'jsonwebtoken';
import { AuthenticationError, JwtSecretConfigurationError } from '../errors/userErrors.js';

export const validateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next(new AuthenticationError());
    }

    if (!authHeader.startsWith('Bearer ')) {
        return next(new AuthenticationError());
    }

    const token = authHeader.slice(7);

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
        return next(new JwtSecretConfigurationError());
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.sub || typeof decoded.sub !== 'string') {
            return next(new AuthenticationError());
        }
        req.auth = {
            sub: decoded.sub,
        };
        next();
    } catch (err) {
        next(new AuthenticationError());
    }
};
