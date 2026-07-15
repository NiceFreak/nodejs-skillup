// Validate ObjectId format (24 hex characters)
export const validateObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

// Check request body is a present, non-null, non-array object.
// express.json() leaves req.body as `undefined` when Content-Type isn't
// application/json, but `{}` when the JSON body is empty - `!req.body`
// alone only catches the first case.
export const hasRequestBody = (body) => {
    return typeof body === 'object' && body !== null && !Array.isArray(body);
};

// 校验 days 参数，缺失时默认 30，无效时返回失败
export const validateDays = (days) => {
    if (days === undefined || days === null) {
        return { valid: true, value: 30 };
    }

    const num = Number(days);

    if (Number.isInteger(num) && num > 0) {
        return { valid: true, value: num };
    }

    return { valid: false, value: null };
};

// 校验传入的整数参数
export const validatePositiveInt = (value, defaultValue) => {
    if (value === undefined || value === null) {
        return { valid: true, value: defaultValue };
    }

    const num = Number(value);

    if (Number.isInteger(num) && num > 0) {
        return { valid: true, value: num };
    }

    return { valid: false, value: null };
};

// 校验 status 参数，缺失时默认 'completed'，无效时返回失败
export const validateStatus = (status) => {
    const ALLOWED_STATUSES = ['pending', 'completed', 'canceled', 'refunding', 'refunded'];

    if (status === undefined || status === null) {
        return { valid: true, value: 'completed' };
    }

    if (typeof status !== 'string') {
        return { valid: false, value: null };
    }

    const normalized = status.toLowerCase();

    if (ALLOWED_STATUSES.includes(normalized)) {
        return { valid: true, value: normalized };
    }

    return { valid: false, value: null };
};
