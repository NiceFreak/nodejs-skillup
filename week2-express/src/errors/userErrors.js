// TODO: 将报错格式转换成 { code: xxx, message: 'xxx' } 的格式
// name: EmailConflictError
// message: 用户已存在（email: xxx）
export class EmailConflictError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'EmailConflictError';
    }
}

// name: UserValidationError
// message: 用户数据校验失败：xxx
export class UserValidationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'UserValidationError';
    }
}
// name: DatabaseConnectionError
// message: 数据库连接失败
export class DatabaseConnectionError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'DatabaseConnectionError';
    }
}

// name: AggregationError
// message: 聚合查询失败：xxx
export class AggregationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'AggregationError';
    }
}

// name: InvalidCredentialsError
// message: 邮箱或密码错误
export class InvalidCredentialsError extends Error {
    constructor() {
        super('邮箱或密码错误');
        this.name = 'InvalidCredentialsError';
    }
}

// name: JwtSecretConfigurationError
// message: 未配置 JWT SECRET 或其强度不足
export class JwtSecretConfigurationError extends Error {
    constructor() {
        super('未配置 JWT SECRET 或其强度不足');
        this.name = 'JwtSecretConfigurationError';
    }
}

// name: export class AuthenticationError {
// message: 身份验证错误
export class AuthenticationError extends Error {
    constructor() {
        super('Token 无效或已过期');
        this.name = 'AuthenticationError';
    }
}
