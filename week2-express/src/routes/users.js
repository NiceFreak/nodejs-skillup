import express from 'express';
import { 
    listUsersController, 
    createUserController, 
    deleteUserController, 
    updateUserController
} from '../controller/users.js';
import { validateIdParam } from '../middlewares/validateIdParamMiddleware.js';
import { validateHasRequestBody } from '../middlewares/validateHasRequestBodyMiddleware.js';
import { setUpdateDataWhitelist } from '../middlewares/setUpdateDataWhitelistMiddleware.js';

const usersRouter = express.Router();

// GET /users
usersRouter.get('/', listUsersController);

// GET /users/:id
usersRouter.get('/:id', validateIdParam, listUsersController);

// POST /users
usersRouter.post('/', validateHasRequestBody, createUserController);

// DELETE /users/:id
usersRouter.delete('/:id', validateIdParam, deleteUserController);

// PATCH /users/:id
usersRouter.patch('/:id', validateIdParam, validateHasRequestBody, setUpdateDataWhitelist, updateUserController);

export { usersRouter };
