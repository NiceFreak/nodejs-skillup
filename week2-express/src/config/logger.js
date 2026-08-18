import { pino } from 'pino';

// D1 §5.1 冻结：pino 实例 = 第二道闸（第一道闸是中间件根本不记 body）
// timestamp: isoTime = ISO8601 UTC（P2 已拍板：Node 侧真 UTC，Z 结尾）
// redact paths 逐条对 D1 §5.1「永不入日志清单」：
//   req.body.password            登录请求体（明文密码）
//   req.headers.authorization    Bearer token 完整凭据
//   req.headers.cookie           session id
//   req.query.*                  查询串临时凭据（配套：日志 path 用 req.path 不含查询串）
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            'req.body.password',
            'req.headers.authorization',
            'req.headers.cookie',
            'req.query.resetToken',
            'req.query.access_token',
        ],
        censor: '[REDACTED]',
    },
});