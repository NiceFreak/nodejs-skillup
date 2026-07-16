import { findUserRoleById } from '../repositories/users.js';
import { AuthorizationError, AuthenticationError } from '../errors/userErrors.js';

export const requireRole = (requiredRole) => {
    return async (req, res, next) => {
        // 前置条件：validateToken 必须在此之前执行
        if (!req.auth || !req.auth.sub) {
            // 认证信息缺失，应视为认证问题，返回 401
            return next(new AuthenticationError());
        }

        try {
            const role = await findUserRoleById(req.auth.sub);
            if (role !== requiredRole) {
                return next(new AuthorizationError());
            }

            // 将角色挂载到 req.user 供后续使用
            req.user = { ...req.user, role };
            next();
        } catch (err) {
            // 所有意外错误（数据库异常、查询失败等）透传给全局错误处理器
            // 不要伪装成 403
            next(err);
        }
    };
};