import express from 'express';
import { listUsersController } from '../controller/users.js';

const listUsersRouter = express.Router();

// GET /users
listUsersRouter.get('/', async (req, res) => {
    await listUsersController(req, res);
});

// GET /users:id
listUsersRouter.get('/:id', async (req, res) => {
    await listUsersController(req, res);
});

export { listUsersRouter };
