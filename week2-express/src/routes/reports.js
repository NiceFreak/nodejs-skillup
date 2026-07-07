import express from 'express';
import {
    getCustomerSpendingReportController,
} from '../controller/users.js';
import { validateDaysParam } from '../middlewares/validateDaysParamMiddleware.js';
import { validateStatusParam } from '../middlewares/validateStatusParamsMiddleware.js';

const reportRouter = express.Router();

// GET /reports/customer-spending
reportRouter.get(
    '/customer-spending', 
    validateDaysParam, 
    validateStatusParam, 
    getCustomerSpendingReportController
);

export { reportRouter };
