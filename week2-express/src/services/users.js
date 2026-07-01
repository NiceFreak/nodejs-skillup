import { findAll, findById, createUser } from '../repositories/users.js';

export async function listAllUsersService() {
    return await findAll();
}

export async function listUserByIdService(id) {
    return await findById(id);
}

export async function createUserService(userData) {
    return await createUser(userData);
}