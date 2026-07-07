import { findOrdersWithUser } from './repositories/users.js';
import mongoose from 'mongoose';

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        mongoose.set('debug', true);
        const result = await findOrdersWithUser();
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();

// [
//   {
//     "_id": "6a4c60d8f9dedb5a69170d17",
//     "userId": {
//       "_id": "6a4b124741f7c4ea59f83a59",
//       "name": "Demo User 1",
//       "email": "demo-user-1@example.com",
//       "age": 28,
//       "addresses": [
//         {
//           "recipient": "Demo User",
//           "phone": "13800000000",
//           "province": "Shanghai",
//           "city": "Shanghai",
//           "detailAddress": "Demo Road 1",
//           "_id": "6a4b124741f7c4ea59f83a5a"
//         }
//       ],
//       "__v": 0
//     },
//     "status": "completed",
//     "totalAmount": {
//       "$numberDecimal": "1299.99"
//     },
//     "createdAt": "2026-07-01T06:00:00.000Z",
//     "items": [],
//     "__v": 0
//   },
// ...
// ]
