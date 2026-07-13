import { getCustomerSpending, getMonthlySalesTrend } from '../repositories/users.js';

export async function getCustomerSpendingReport({ status, days }) {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await getCustomerSpending(status, date);

    return result.map(item => {
        const { totalSpending, avgOrderValue, ...rest } = item;
        return {
            ...rest,
            totalSpending: Number(totalSpending.toString()),
            avgOrderValue: Number(avgOrderValue.toString())
        };
    });
}

export async function getMonthlySalesTrendReport({ status, months }) {

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // 起始日期：往前推 (months - 1) 个月
    const startDate = new Date(currentMonthStart);
    startDate.setMonth(startDate.getMonth() - (months - 1));

    // 结束日期：往后推 1 个月
    const endDate = new Date(currentMonthStart);
    endDate.setMonth(endDate.getMonth() + 1);

    const result = await getMonthlySalesTrend(status, { startDate, endDate });

    return result.map(item => {
        const { totalSpending, avgOrderValue, ...rest } = item;
        return {
            ...rest,
            totalSpending: Number(totalSpending.toString()),
            avgOrderValue: Number(avgOrderValue.toString())
        };
    })
}