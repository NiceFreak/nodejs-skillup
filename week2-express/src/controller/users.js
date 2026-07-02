import {
    listAllUsersService,
    listUserByIdService,
    createUserService,
    deleteUserService,
    updateUserService,
} from '../services/users.js';
import { validateObjectId, hasRequestBody } from '../utils/validators.js';

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
    if (!hasRequestBody(req.body)) {
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

export async function updateUserController(req, res) {
    const { id } = req.params;
    if (!validateObjectId(id)) {
        return res.status(400).json({ error: `Invalid user id format: ${id}` });
    }
    if (!hasRequestBody(req.body)) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    // Whitelist updatable fields so a client can't slip in `_id`, `__v`,
    // or other fields via PATCH (same principle as createUserController).
    const { name, email, age, addresses } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (age !== undefined) updateData.age = age;
    if (addresses !== undefined) updateData.addresses = addresses;
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided to update' });
    }
    const updatedUser = await updateUserService(id, updateData);
    if (!updatedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json(updatedUser);
}
