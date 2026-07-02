import express from 'express';
import { listUsersController, createUserController, deleteUserController, updateUserController } from '../controller/users.js';

const usersRouter = express.Router();

// GET /users
usersRouter.get('/', listUsersController);

// GET /users/:id
usersRouter.get('/:id', listUsersController);

// POST /users
usersRouter.post('/', createUserController);

// DELETE /users/:id
usersRouter.delete('/:id', deleteUserController);

// PATCH /users/:id
usersRouter.patch('/:id', updateUserController);

export { usersRouter };
