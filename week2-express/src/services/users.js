import { findAll, findById } from '../repositories/users.js';

export async function listAllUsersService() {
    return await findAll();
}

export async function listUserByIdService(id) {
    return await findById(id);
}
