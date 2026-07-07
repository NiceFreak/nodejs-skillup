import { validateStatus } from "../validators.js";

describe("validateStatus", () => {
    test("合法状态返回 valid 和归一化的值", () => {
        const result = validateStatus("completed");
        expect(result.valid).toBe(true);
        expect(result.value).toBe("completed");
    });

    test("非法状态 valid 不通过", () => {
        const result = validateStatus("shipping");
        expect(result.valid).toBe(false);
        expect(result.value).toBe(null);
    });

    test("非字符串 valid 不通过, 转为 null", () => {
        const result = validateStatus(123);
        expect(result.valid).toBe(false);
        expect(result.value).toBe(null);
    });

    test("缺省(null/undefined)补默认 completed", () => {
        expect(validateStatus(null).valid).toBe(true);
        expect(validateStatus(null).value).toBe("completed");
        expect(validateStatus(undefined).value).toBe("completed");
    });

    test("大写归一化 valid 通过", () => {
        const result = validateStatus("COMPLETED");
        expect(result.valid).toBe(true);
        expect(result.value).toBe("completed");
    });
});
