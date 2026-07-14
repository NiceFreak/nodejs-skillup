import express from 'express';
import {
    getCustomerSpendingReportController,
    getMonthlySalesTrendReportController
} from '../controllers/users.js';
import { validateDaysParam } from '../middlewares/validateDaysParamMiddleware.js';
import { validateStatusParam } from '../middlewares/validateStatusParamsMiddleware.js';
import { validateMonthsParam } from '../middlewares/validateMonthsParamMiddleware.js';

const reportRouter = express.Router();

// GET /reports/customer-spending
reportRouter.get(
    '/customer-spending', 
    validateDaysParam, 
    validateStatusParam, 
    getCustomerSpendingReportController
);

// GET /reports/monthly-sales
reportRouter.get(
    '/monthly-sales',
    validateMonthsParam,
    validateStatusParam,
    getMonthlySalesTrendReportController
)

export { reportRouter };
