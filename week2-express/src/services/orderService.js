import { getCustomerSpending } from '../repositories/users.js';

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
