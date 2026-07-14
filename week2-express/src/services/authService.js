import bcrypt from 'bcrypt';
import { createUser, findByEmailWithPasswordHash } from '../repositories/users.js';
import {
    UserValidationError,
    InvalidCredentialsError
} from '../errors/userErrors.js';

const MIN_PASSWORD_LENGTH = 15;

export const register = async ({ name, email, password }) => {
    // 1. 密码策略
    if (typeof password !== 'string') {
        throw new UserValidationError('密码必须是字符串');
    }
    if (password.trim().length === 0) {
        throw new UserValidationError('密码不能为空或仅包含空白字符');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new UserValidationError(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 个字符`);
    }

    // 2. 生成哈希
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. 构造数据
    const userData = {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
    };

    // 4. 调用 Repository（可能抛出 EmailConflictError）
    const createdUser = await createUser(userData);

    // 5. 返回安全字段
    return {
        name: createdUser.name,
        email: createdUser.email,
    };
};

// login
export const login = async ({ email, password }) => {
    const userData = await findByEmailWithPasswordHash(email);

    if (!userData || !userData.passwordHash) {
        throw new InvalidCredentialsError();
    }

    const isMatch = await bcrypt.compare(password, userData.passwordHash);
    if (!isMatch) {
        throw new InvalidCredentialsError();
    }

    return {
        userId: userData._id,
        name: userData.name,
        email: userData.email,
    };
};

