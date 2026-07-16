import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, '请输入合法的邮箱地址'],
    },
    age: {
        type: Number,
        required: false,
    },
    // 新增字段：passwordHash
    passwordHash: {
        type: String,
        select: false, // 默认查询不返回
    },
    // 新增字段: role
    role: {
        type: String,
        enum: ['member', 'admin'],
        default: 'member',
    },
    addresses: [
        {
            recipient: {
                type: String,
                required: true,
            },
            phone: {
                type: String,
                required: true,
            },
            province: {
                type: String,
                required: true,
            },
            city: {
                type: String,
                required: true,
            },
            detailAddress: {
                type: String,
                required: true,
            },
        },
    ],
});

const User = mongoose.model('User', userSchema);

export default User;
