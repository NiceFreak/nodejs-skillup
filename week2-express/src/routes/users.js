import express from 'express';
import { listUsersController } from '../controller/users.js';

const listUsersRouter = express.Router();

// GET /users:id
listUsersRouter.get('/users/:id', async (req, res) => {
    await listUsersController(req, res);
});

export { listUsersRouter };
