import { listUsersService } from '../services/users.js';

export async function listUsersController(req, res) {
    const users = await listUsersService();
    return res.json(users);
}
