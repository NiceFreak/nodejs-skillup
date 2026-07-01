import { findAll, findById, createUser } from '../repositories/users.js';

export async function listAllUsersService() {
    try {
        return await findAll();
    } catch (error) {
        throw error;
    }
}

export async function listUserByIdService(id) {
    try {
        return await findById(id);
    } catch (error) {
        throw error;
    }
}

export async function createUserService(userData) {
    try {
        return await createUser(userData);
    } catch (error) {
        throw error;
    }
}