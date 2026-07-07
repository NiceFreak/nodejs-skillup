import { getCustomerSpending } from '../repositories/users.js';

export async function getCustomerSpendingReport(status, days) {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let result = await getCustomerSpending(status, date);
    result = result.map(({ _id, orderCount, totalSpending, avgOrderValue }) => ({
        userId: _id.toString(),
        orderCount,
        totalSpending: Number(totalSpending.toString()),
        avgOrderValue: Number(avgOrderValue.toString())
    }));
    return result;
}
