import { findAll, findById, createUser } from '../repositories/users.js';

export async function listAllUsersService() {
    return findAll();
}

export async function listUserByIdService(id) {
    return findById(id);
}

export async function createUserService(userData) {
    return createUser(userData);
}
