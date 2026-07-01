import User from '../models/users.js';

export async function findAll() {
    const users = await User.find();
    return users;
}

export async function findById(id) {
    const user = await User.findById(id);
    return user;
}