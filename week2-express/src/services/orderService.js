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

    const setDate = new Date();
    setDate.setMonth(setDate.getMonth() - months);
    const result = await getMonthlySalesTrend(status, setDate);

    return result.map(item => {
        const { totalSpending, avgOrderValue, ...rest } = item;
        return {
            ...rest,
            totalSpending: Number(totalSpending.toString()),
            avgOrderValue: Number(avgOrderValue.toString())
        };
    })
}