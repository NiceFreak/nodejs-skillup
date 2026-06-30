import { findAllUsers } from '../repositories/users.js';

export async function listUsersService() {
    const users = await findAllUsers();
    return users;
}
