import { listAllUsersService, listUserByIdService, createUserService, deleteUserService } from '../services/users.js';

// Validate ObjectId format (24 hex characters)
const validateObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (id && !validateObjectId(id)) {
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
    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    const { name, email, age, addresses } = req.body;
    const newUser = await createUserService({ name, email, age, addresses });
    return res.status(201).json(newUser);
}

export async function deleteUserController(req, res) {
    const { id } = req.params;
    if (!validateObjectId(id)) {
        return res.status(400).json({ error: `Invalid user id format: ${id}` });
    }
    const deletedUser = await deleteUserService(id);
    if (!deletedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json({ message: `User with id ${id} deleted successfully` });
}