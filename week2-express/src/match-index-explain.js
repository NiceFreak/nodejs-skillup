import mongoose from 'mongoose';
import Order from './models/orders.js';

async function runReport() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        Order.collection.createIndex({ status: 1, createdAt: 1 });

        const filter = {
            status: 'completed',
            createdAt: {
                $gte: new Date(2026, 1, 1),
                $lt: new Date(2026, 7, 1),
            },
        };

        const collscan = db.orders.find(filter).hint({ $natural: 1 }).explain('executionStats');

        const ixscan = db.orders
            .find(filter)
            .hint({ status: 1, createdAt: 1 })
            .explain('executionStats');

        printjson({
            COLLSCAN: {
                stage: collscan.queryPlanner.winningPlan.stage,
                nReturned: collscan.executionStats.nReturned,
                totalDocsExamined: collscan.executionStats.totalDocsExamined,
                totalKeysExamined: collscan.executionStats.totalKeysExamined,
            },
            INDEX: {
                stage: ixscan.queryPlanner.winningPlan.stage,
                inputStage: ixscan.queryPlanner.winningPlan.inputStage.stage,
                indexName: ixscan.queryPlanner.winningPlan.inputStage.indexName,
                nReturned: ixscan.executionStats.nReturned,
                totalDocsExamined: ixscan.executionStats.totalDocsExamined,
                totalKeysExamined: ixscan.executionStats.totalKeysExamined,
            },
        });
    } catch (err) {
        console.error('report failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runReport();
