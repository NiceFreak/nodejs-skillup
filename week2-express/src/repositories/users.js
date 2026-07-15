import User from '../models/users.js';
import Order from '../models/orders.js';
import { EmailConflictError, UserValidationError, AggregationError } from '../errors/userErrors.js';
import { trusted } from 'mongoose';

export async function findAll() {
    const users = await User.find();
    return users;
}

export async function findById(id) {
    const user = await User.findById(id);
    return user;
}

// 按邮箱查询
export async function findByEmailWithPasswordHash(email) {
    const user = await User.findOne({ email }).select('+passwordHash');
    return user;
}

export async function createUser(userData) {
    try {
        const newUser = new User(userData);
        await newUser.save();
        return newUser;
    } catch (error) {
        if (error.name === 'ValidationError') {
            // 翻译成业务错误
            // 400 Bad Request
            throw new UserValidationError(`用户数据校验失败：${error.message}`, { cause: error });
        } else if (error.code === 11000) {
            // 翻译成业务错误
            // 409 Conflict
            const email = Object.entries(error.keyValue)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            throw new EmailConflictError(`用户已存在（${email}）`, { cause: error });
        }
        throw error;
    }
}

export async function deleteUser(id) {
    const deletedUser = await User.findByIdAndDelete(id);
    return deletedUser;
}

export async function updateUser(id, updateData) {
    try {
        const updatedUser = await User.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
        return updatedUser;
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new UserValidationError(`用户数据校验失败：${error.message}`, { cause: error });
        } else if (error.code === 11000) {
            const email = Object.entries(error.keyValue)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            throw new EmailConflictError(`用户已存在（${email}）`, { cause: error });
        }
        throw error;
    }
}

export async function getCustomerSpending(status, date) {
    try {
        const result = await Order.aggregate([
            {
                $match: {
                    status: status,
                    createdAt: {
                        $gte: date,
                    },
                },
            },
            {
                $group: {
                    _id: '$userId',
                    orderCount: {
                        $sum: 1,
                    },
                    totalSpending: {
                        $sum: '$totalAmount',
                    },
                    avgOrderValue: {
                        $avg: '$totalAmount',
                    },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo',
                },
            },
            {
                $unwind: '$userInfo',
            },
            {
                $project: {
                    _id: 0,
                    orderCount: 1,
                    totalSpending: 1,
                    avgOrderValue: 1,
                    userId: '$_id',
                    customerName: '$userInfo.name',
                    customerEmail: '$userInfo.email',
                },
            },
            {
                $sort: {
                    totalSpending: -1,
                },
            },
        ]);
        return result;
    } catch (error) {
        throw new AggregationError(`聚合查询失败：${error.message}`);
    }
}

export async function findOrdersWithUser() {
    const result = await Order.find().populate('userId');
    return result;
}

// 月度报表
export async function getMonthlySalesTrend(status, { startDate, endDate }) {
    try {
        const result = await Order.aggregate([
            {
                $match: {
                    status: status,
                    createdAt: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    orderCount: {
                        $sum: 1,
                    },
                    totalSpending: {
                        $sum: '$totalAmount',
                    },
                    avgOrderValue: {
                        $avg: '$totalAmount',
                    },
                },
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                },
            },
            {
                $project: {
                    _id: 0,
                    orderCount: 1,
                    totalSpending: 1,
                    avgOrderValue: 1,
                    year: '$_id.year',
                    month: '$_id.month',
                },
            },
        ]);
        return result;
    } catch (error) {
        throw new AggregationError(`聚合查询失败：${error.message}`);
    }
}
