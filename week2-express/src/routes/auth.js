import express from 'express';
import { registerController } from '../controllers/auth.js';
import { validateRegisterBody } from '../middlewares/validateRegisterBodyMiddleware.js';
import { validateHasRequestBody } from '../middlewares/validateHasRequestBodyMiddleware.js';

const router = express.Router();

router.post(
    '/register',
    validateHasRequestBody,
    validateRegisterBody,
    registerController
);

export const authRouter = router;
