import { listUsersService } from '../services/users.js';

export async function listUsersController(req, res) {
    console.log('listUsersController: ', req.params);
    const { id } = req.params;
    if (!id) {
        const users = await listUsersService();
        return res.json(users);
    }
    const users = await listUsersService(id);
    return res.json(users);
}
