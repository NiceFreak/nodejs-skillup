import {
    listAllUsersService,
    listUserByIdService,
    createUserService,
    deleteUserService,
    updateUserService,
} from '../services/users.js';

import {
    getCustomerSpendingReport,
    getMonthlySalesTrendReport,
} from '../services/orderService.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (!id) {
        const users = await listAllUsersService();
        return res.json(users);
    } else {
        const user = await listUserByIdService(id);
        if (!user) {
            return res.status(404).json({ error: `未找到 id 为 ${id} 的用户` });
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
        return res.status(404).json({ error: `未找到 id 为 ${id} 的用户` });
    }
    return res.status(200).json({ message: `User with id ${id} deleted successfully` });
}

export async function updateUserController(req, res) {
    const { id } = req.params;
    const updateData = req.body;
    const updatedUser = await updateUserService(id, updateData);
    if (!updatedUser) {
        return res.status(404).json({ error: `未找到 id 为 ${id} 的用户` });
    }
    return res.status(200).json(updatedUser);
}

export async function getCustomerSpendingReportController(req, res) {
    const status = req.status;
    const days = req.days;
    const reportData = await getCustomerSpendingReport({ status, days });
    return res.json(reportData);
}

export async function getMonthlySalesTrendReportController(req, res) {
    const status = req.status;
    const months = req.months;
    const reportData = await getMonthlySalesTrendReport({ status, months });
    return res.json(reportData);
}