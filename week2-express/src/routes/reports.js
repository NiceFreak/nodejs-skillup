import express from 'express';
import {
    getCustomerSpendingReportController,
    getMonthlySalesTrendReportController,
} from '../controllers/users.js';
import { validateDaysParam } from '../middlewares/validateDaysParamMiddleware.js';
import { validateStatusParam } from '../middlewares/validateStatusParamsMiddleware.js';
import { validateMonthsParam } from '../middlewares/validateMonthsParamMiddleware.js';
import { validateToken } from '../middlewares/validateTokenMiddleware.js';
import { requireRole } from '../middlewares/validateRoleMiddleware.js';

const reportRouter = express.Router();

// GET /reports/customer-spending
reportRouter.get(
    '/customer-spending',
    validateToken,
    requireRole('admin'),   // 新增：仅 admin 可访问
    validateDaysParam,
    validateStatusParam,
    getCustomerSpendingReportController,
);

// GET /reports/monthly-sales
reportRouter.get(
    '/monthly-sales',
    validateToken,
    requireRole('admin'),   // 新增：仅 admin 可访问
    validateMonthsParam,
    validateStatusParam,
    getMonthlySalesTrendReportController,
);

export { reportRouter };
