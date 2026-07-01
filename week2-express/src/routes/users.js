import express from 'express';
import { listUsersController, createUserController } from '../controller/users.js';

const listUsersRouter = express.Router();
const createUserRouter = express.Router();

// GET /users
listUsersRouter.get('/', listUsersController);

// GET /users:id
listUsersRouter.get('/:id', listUsersController);

// POST /users
createUserRouter.post('/', createUserController);

export { listUsersRouter, createUserRouter };
