import { findAll, findById, createUser, deleteUser, updateUser } from '../repositories/users.js';

export async function listAllUsersService() {
    return findAll();
}

export async function listUserByIdService(id) {
    return findById(id);
}

export async function createUserService(userData) {
    return createUser(userData);
}

export async function deleteUserService(id) {
    return deleteUser(id);
}

export async function updateUserService(id, updateData) {
    return updateUser(id, updateData);
}
