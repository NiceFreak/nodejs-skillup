import { listAllUsersService, listUserByIdService } from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (id && isNaN(parseInt(id))) {
        return res.status(400).json({ error: `Invalid id: ${id}` });
    }
    if (!id) {
        const users = await listAllUsersService();
        return res.json(users);
    } else {
        const user = await listUserByIdService(id);
        if (!user) {
            return res.status(404).json({ error: `User with id ${id} not found` });
        }
        return res.json(user);
    }
}
