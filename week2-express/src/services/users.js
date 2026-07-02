import { findAll, findById, createUser, deleteUser, updateUser } from '../repositories/users.js';
import { UserValidationError } from '../errors/userErrors.js';

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
    // Whitelist updatable fields so a client can't slip in `_id`, `__v`,
    // or other fields via PATCH (same principle as createUserService).
    if (Object.keys(updateData).length === 0) {
        throw new UserValidationError('No valid fields provided for update');
    }
    const allowedFields = ['name', 'email', 'age', 'addresses'];
    const filteredUpdateData = {};
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            filteredUpdateData[field] = updateData[field];
        }
    }
    return updateUser(id, filteredUpdateData);
}
