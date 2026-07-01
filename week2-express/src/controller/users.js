import { listAllUsersService, listUserByIdService, createUserService } from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    // _id 参考值: 6a446ddadcf00cc5b20ba285, 是 MongoDB ObjectId 的字符串表示形式,可以直接传给 findById 方法。
    if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ error: `Invalid user id format: ${id}` });
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

export async function createUserController(req, res) {
    const { name, email, age, addresses } = req.body;
    const newUser = await createUserService({ name, email, age, addresses });
    return res.status(201).json(newUser);
}
