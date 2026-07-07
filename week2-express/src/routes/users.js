import express from 'express';
import {
    listUsersController,
    createUserController,
    deleteUserController,
    updateUserController,
    getCustomerSpendingReportController,
} from '../controller/users.js';
import { validateIdParam } from '../middlewares/validateIdParamMiddleware.js';
import { validateHasRequestBody } from '../middlewares/validateHasRequestBodyMiddleware.js';
import { validateDaysParam } from '../middlewares/validateDaysParamMiddleware.js';
import { validateStatusParam } from '../middlewares/validateStatusParamsMiddleware.js';

const usersRouter = express.Router();

// GET /users
usersRouter.get('/', listUsersController);

// GET /reports/customer-spending
usersRouter.get('/reports/customer-spending', validateDaysParam, validateStatusParam, getCustomerSpendingReportController);

// GET /users/:id
usersRouter.get('/:id', validateIdParam, listUsersController);

// POST /users
usersRouter.post('/', validateHasRequestBody, createUserController);

// DELETE /users/:id
usersRouter.delete('/:id', validateIdParam, deleteUserController);

// PATCH /users/:id
usersRouter.patch('/:id', validateIdParam, validateHasRequestBody, updateUserController);

export { usersRouter };
