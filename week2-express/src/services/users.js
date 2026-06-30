import { findAll, findById } from '../repositories/users.js';

export async function listUsersService(id = null) {
    if (!id) {
        return await findAll();
    } else {
        return await findById(id);
    }
}
