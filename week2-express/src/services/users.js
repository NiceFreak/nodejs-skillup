import { findAllUsers } from '../repositories/users.js';

export async function listUsersService(id = null) {
    const users = await findAllUsers(id);
    return users;
}
