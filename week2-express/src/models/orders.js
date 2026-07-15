import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const Decimal128 = mongoose.Schema.Types.Decimal128;

const orderSchema = new mongoose.Schema(
    {
        // 订单 id 使用 _id 字段，Mongoose 会自动生成
        // 订单关联的用户 id
        userId: {
            type: ObjectId,
            ref: 'User',
            required: true,
        },
        // 订单状态: 付款中, 完成, 取消, 退款中, 已退款
        status: {
            type: String,
            enum: ['pending', 'completed', 'canceled', 'refunding', 'refunded'],
            default: 'pending',
        },
        // 订单总金额
        totalAmount: {
            type: Decimal128,
            required: true,
        },
        // 商品信息
        items: [
            {
                productId: {
                    type: ObjectId,
                    ref: 'Product',
                    required: true,
                },
                name: {
                    type: String,
                    required: true,
                },
                price: {
                    type: Decimal128,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                },
            },
        ],
    },
    {
        // 订单创建时间, 使用 mongoose
        timestamps: true,
    },
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
