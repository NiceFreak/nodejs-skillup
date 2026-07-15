import express from 'express';
import {
    getCustomerSpendingReportController,
    getMonthlySalesTrendReportController
} from '../controllers/users.js';
import { validateDaysParam } from '../middlewares/validateDaysParamMiddleware.js';
import { validateStatusParam } from '../middlewares/validateStatusParamsMiddleware.js';
import { validateMonthsParam } from '../middlewares/validateMonthsParamMiddleware.js';
import { validateToken } from '../middlewares/validateTokenMiddleware.js';

const reportRouter = express.Router();

// GET /reports/customer-spending
reportRouter.get(
    '/customer-spending', 
    validateToken,
    validateDaysParam, 
    validateStatusParam, 
    getCustomerSpendingReportController
);

// GET /reports/monthly-sales
reportRouter.get(
    '/monthly-sales',
    validateToken,
    validateMonthsParam,
    validateStatusParam,
    getMonthlySalesTrendReportController
)

export { reportRouter };
