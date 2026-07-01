import User from '../models/users.js';
import { EmailConflictError, ValidationError } from '../errors/userErrors.js';

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
            // 翻译成领域错误
            throw new ValidationError(`Validation Error: ${error.message}`); // 400 Bad Request
        } else if (error.code === 11000) {
            // 翻译成领域错误
            const email = error.keyValue.email;
            throw new EmailConflictError(`User with email ${email} already exists`); // 409 Conflict
        }
        throw error;
    }

}