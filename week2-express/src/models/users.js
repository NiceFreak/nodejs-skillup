import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please fill a valid email address']
    },
    age: {
        type: Number,
        required: false
    },
    addresses: [{
        recipient: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        province: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        detailAddress: {
            type: String,
            required: true
        }
    }],
    // 新增字段：passwordHash
    passwordHash: {
        type: String,
        select: false   // 默认查询不返回
    }
});

const User = mongoose.model("User", userSchema);

export default User;
