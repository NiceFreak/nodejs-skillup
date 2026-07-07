import User from '../models/users.js';
import Order from "../models/orders.js";
import { EmailConflictError, UserValidationError, AggregationError } from '../errors/userErrors.js';

export async function findAll() {
    const users = await User.find();
    return users;
}

export async function findById(id) {
    const user = await User.findById(id);
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
            throw new UserValidationError(`User Validation Error: ${error.message}`, { cause: error });
        } else if (error.code === 11000) {
            // 翻译成业务错误
            // 409 Conflict
            const email = Object.entries(error.keyValue).map(([key, value]) => `${key}: ${value}`).join(', ');
            throw new EmailConflictError(`User with ${email} already exists`, { cause: error });
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
        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        return updatedUser;
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new UserValidationError(`User Validation Error: ${error.message}`, { cause: error });
        } else if (error.code === 11000) {
            const email = Object.entries(error.keyValue).map(([key, value]) => `${key}: ${value}`).join(', ');
            throw new EmailConflictError(`User with ${email} already exists`, { cause: error });
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
                        $gte: date
                    }
                }
            },
            {
                $group: {
                    _id: "$userId",
                    orderCount: {
                        $sum: 1
                    },
                    totalSpending: {
                        $sum: "$totalAmount"
                    },
                    avgOrderValue: {
                        $avg: "$totalAmount"
                    }
                }
            },
            {
                $sort: {
                    totalSpending: -1,
                }
            }
        ]);
        return result;
    } catch (error) {
        throw new AggregationError(`Aggregation Error: `, { cause: error })
    }
}