import express from 'express';
import { registerController, loginController } from '../controllers/auth.js';
import { validateRegisterBody } from '../middlewares/validateRegisterBodyMiddleware.js';
import { validateHasRequestBody } from '../middlewares/validateHasRequestBodyMiddleware.js';
import { validateLoginBody } from '../middlewares/validateLoginBodyMiddleware.js';

const router = express.Router();

router.post('/register', validateHasRequestBody, validateRegisterBody, registerController);

router.post('/login', validateHasRequestBody, validateLoginBody, loginController);

export const authRouter = router;
