import { listUsersController } from '../controller/users.js';

export async function listUsersRoute(req, res) {
    await listUsersController(req, res);
}
