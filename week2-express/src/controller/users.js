import { listUsersService } from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (!id) {
        const users = await listUsersService();
        return res.json(users);
    } else {
        const user = await listUsersService(id);
        if (!user) {
            return res.status(404).json({ error: `User with id ${id} not found` });
        }
        return res.json(user);
    }
}
