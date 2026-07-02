import {
    listAllUsersService,
    listUserByIdService,
    createUserService,
    deleteUserService,
    updateUserService,
} from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
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

export async function deleteUserController(req, res) {
    const { id } = req.params;
    const deletedUser = await deleteUserService(id);
    if (!deletedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json({ message: `User with id ${id} deleted successfully` });
}

export async function updateUserController(req, res) {
    const { id } = req.params;
    const updateData = req.updateData;
    const updatedUser = await updateUserService(id, updateData);
    if (!updatedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json(updatedUser);
}
