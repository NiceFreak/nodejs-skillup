import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import User from './models/users.js';
import Order from './models/orders.js';
import { makeRandom } from './seedUsers.js';

/**
 * 订单种子脚本 —— 尽量还原真实电商的数据分布
 *
 * 运行：  node --env-file=.env seedOrders.js   （或 npm run seed:orders）
 * 前置：先跑过 seedUsers.js（库里得有用户）。本脚本从数据库读真实用户，
 *       用他们的 _id 当 userId，保证订单能 join 上 users 集合，报表聚合才有意义。
 *
 * 真实电商的几个统计规律，这里都建了模：
 *   1. 复购次数服从幂律（二八效应）：多数是一次性买家，少数老客贡献大量订单，
 *      还有约 18% 的人“只注册不下单”。—— Pareto 分布 + 零单比例
 *   2. 商品有爆款/长尾：少数热销品占大头。—— Zipf 权重抽商品
 *   3. 下单量以 1 件为主，偶尔多件。
 *   4. 时间上有：整体增长趋势 + 周末/大促尖峰（618、双11、双12）+ 春节回落 +
 *      一天内晚间高峰。—— 用强度函数做拒绝采样生成下单时间
 *   5. 订单状态与时效相关：刚下的多为 pending/refunding，老订单几乎都已终态。
 *
 * 数据量不写死：由上述分布自然决定（2000 用户大约产出 6000~8000 单）。
 */

const RANDOM_SEED = 20260711;
const WINDOW_MONTHS = 24; // 订单/注册时间跨度：最近 24 个月
const ZERO_ORDER_RATE = 0.18; // 只注册不下单的用户比例
const PARETO_ALPHA = 1.4; // 复购次数幂律指数，越小尾巴越长（越多老客）
const MAX_ORDERS_PER_USER = 80; // 单个用户订单数上限，防极端值

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const WINDOW_MS = WINDOW_MONTHS * 30 * DAY;
const START = NOW - WINDOW_MS;

// —— 商品目录：按“热销程度”从高到低排列，配合 Zipf 权重形成爆款/长尾 ——
const catalog = [
    { name: '无线蓝牙耳机', price: 199, category: '数码配件' },
    { name: '手机壳', price: 39, category: '数码配件' },
    { name: '钢化膜', price: 25, category: '数码配件' },
    { name: '数据线', price: 29, category: '数码配件' },
    { name: 'T恤', price: 89, category: '服饰' },
    { name: '运动鞋', price: 299, category: '服饰' },
    { name: '面膜', price: 129, category: '美妆' },
    { name: '洗发水', price: 59, category: '日用' },
    { name: '机械键盘', price: 399, category: '电脑外设' },
    { name: '无线鼠标', price: 129, category: '电脑外设' },
    { name: '移动电源', price: 149, category: '数码配件' },
    { name: '保温杯', price: 79, category: '日用' },
    { name: '零食大礼包', price: 69, category: '食品' },
    { name: '咖啡豆', price: 88, category: '食品' },
    { name: '笔记本支架', price: 89, category: '电脑外设' },
    { name: '27寸显示器', price: 1299, category: '数码' },
    { name: '降噪耳机', price: 1099, category: '数码' },
    { name: '人体工学椅', price: 899, category: '家居' },
    { name: '空气炸锅', price: 349, category: '家电' },
    { name: '扫地机器人', price: 1499, category: '家电' },
    { name: '移动固态硬盘1TB', price: 549, category: '数码配件' },
    { name: '4K网络摄像头', price: 329, category: '电脑外设' },
    { name: '智能手表', price: 999, category: '数码' },
    { name: '平板电脑', price: 2299, category: '数码' },
    { name: '羽绒服', price: 599, category: '服饰' },
    { name: '香水', price: 459, category: '美妆' },
    { name: '行李箱', price: 399, category: '出行' },
    { name: '游戏主机', price: 3599, category: '数码' },
];

// Zipf 权重：第 i 个商品权重 ∝ 1/(i+1)^s，s 越大头部越集中
const ZIPF_S = 1.1;
const catalogCumWeights = (() => {
    let sum = 0;
    return catalog.map((_, i) => (sum += 1 / Math.pow(i + 1, ZIPF_S)));
})();
const catalogTotalWeight = catalogCumWeights[catalogCumWeights.length - 1];

// 一天 24 小时的下单权重：凌晨低、午休小高峰、晚间 20~22 点最高
const HOUR_WEIGHTS = [
    2,
    1,
    1,
    1,
    1,
    1,
    2,
    4,
    6,
    8,
    9,
    9, // 0~11
    10,
    8,
    8,
    9,
    9,
    10,
    12,
    15,
    16,
    14,
    9,
    5, // 12~23
];
const hourCumWeights = (() => {
    let sum = 0;
    return HOUR_WEIGHTS.map((w) => (sum += w));
})();
const hourTotalWeight = hourCumWeights[hourCumWeights.length - 1];

/**
 * 下单强度函数：给定一个时刻，返回相对“热度”（无需归一化）。
 * 综合了业务增长、周末效应、大促尖峰、春节回落。
 */
function intensity(t) {
    const d = new Date(t);

    // 1) 增长趋势：越接近现在越热（约 3 倍增长）
    const ageFrac = (NOW - t) / WINDOW_MS; // 0=现在, 1=最久远
    let f = Math.exp(-1.2 * ageFrac);

    // 2) 周末效应
    const dow = d.getDay();
    if (dow === 0 || dow === 6) f *= 1.3;
    else if (dow === 5) f *= 1.1;

    // 3) 大促尖峰（按月/日判断，覆盖窗口内的每一年）
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (m === 11 && day >= 10 && day <= 12)
        f *= 6; // 双11
    else if (m === 6 && day >= 17 && day <= 19)
        f *= 5; // 618
    else if (m === 12 && day >= 11 && day <= 13)
        f *= 3; // 双12
    else if (m === 2 && day <= 15) f *= 0.45; // 春节前后回落

    return f;
}
const INTENSITY_MAX = 8; // 强度上限（1.0 增长 × 1.3 周末 × 6 双11 ≈ 7.8），用于拒绝采样

function buildOrdersForUsers(users, seed = RANDOM_SEED) {
    const { rand } = makeRandom(seed);
    const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

    // 加权抽样：entries 为 [[值, 权重], ...]
    const weightedPick = (entries) => {
        const total = entries.reduce((s, [, w]) => s + w, 0);
        let x = rand() * total;
        for (const [v, w] of entries) {
            if ((x -= w) < 0) return v;
        }
        return entries[entries.length - 1][0];
    };

    const pickProductIndex = () => {
        const x = rand() * catalogTotalWeight;
        return catalogCumWeights.findIndex((c) => x < c);
    };

    const pickHour = () => {
        const x = rand() * hourTotalWeight;
        return hourCumWeights.findIndex((c) => x < c);
    };

    // 按强度函数在 [minTime, NOW] 内采样一个下单时刻（拒绝采样 + 作息决定小时）
    const sampleTime = (minTime) => {
        const span = NOW - minTime;
        let t = minTime + rand() * span;
        for (let iter = 0; iter < 100; iter++) {
            t = minTime + rand() * span;
            if (rand() < intensity(t) / INTENSITY_MAX) break;
        }
        const d = new Date(t);
        d.setHours(pickHour(), randInt(0, 59), randInt(0, 59), 0);
        return d;
    };

    // 复购次数：Pareto 幂律（少数老客拖长尾），另有一部分人零单
    const drawOrderCount = () => {
        if (rand() < ZERO_ORDER_RATE) return 0;
        const u = rand();
        const x = Math.pow(1 - u, -1 / PARETO_ALPHA); // xmin=1
        return Math.min(MAX_ORDERS_PER_USER, Math.max(1, Math.round(x)));
    };

    // 单个订单的状态：越新越可能未终态
    const drawStatus = (createdAt) => {
        const ageDays = (NOW - createdAt.getTime()) / DAY;
        if (ageDays < 2) {
            return weightedPick([
                ['pending', 55],
                ['completed', 30],
                ['canceled', 10],
                ['refunding', 5],
            ]);
        }
        if (ageDays < 14) {
            return weightedPick([
                ['completed', 62],
                ['pending', 8],
                ['canceled', 15],
                ['refunding', 5],
                ['refunded', 10],
            ]);
        }
        return weightedPick([
            ['completed', 76],
            ['canceled', 12],
            ['refunded', 10],
            ['pending', 1],
            ['refunding', 1],
        ]);
    };

    const buildItems = () => {
        // 一单里不同商品的数量：以 1 种为主
        const distinct = weightedPick([
            [1, 60],
            [2, 25],
            [3, 10],
            [4, 5],
        ]);
        const items = [];
        let totalAmount = 0;
        const usedIdx = new Set();

        for (let k = 0; k < distinct; k++) {
            let idx = pickProductIndex();
            // 同一单尽量不重复同款
            let guard = 0;
            while (usedIdx.has(idx) && guard++ < 5) idx = pickProductIndex();
            usedIdx.add(idx);

            const product = catalog[idx];
            // 购买件数：以 1 件为主
            const quantity = weightedPick([
                [1, 70],
                [2, 20],
                [3, 7],
                [4, 2],
                [5, 1],
            ]);
            // 价格轻微浮动（促销/尾数），保留两位小数
            const price = Math.round(product.price * (0.92 + rand() * 0.16) * 100) / 100;

            totalAmount += price * quantity;
            items.push({
                productId: new mongoose.Types.ObjectId(),
                name: product.name,
                price,
                quantity,
            });
        }
        return { items, totalAmount: Math.round(totalAmount * 100) / 100 };
    };

    const orders = [];
    for (const user of users) {
        // 每个用户的“注册/首次活跃”时间也服从增长趋势（近期注册的人更多）
        const joinDate = sampleTime(START);
        const count = drawOrderCount();

        for (let i = 0; i < count; i++) {
            const createdAt = sampleTime(joinDate.getTime());
            const { items, totalAmount } = buildItems();
            orders.push({
                userId: user._id,
                status: drawStatus(createdAt),
                totalAmount,
                items,
                createdAt,
            });
        }
    }
    return orders;
}

// —— 把生成结果的分布打印出来，方便核对“像不像真实数据” ——
function summarize(orders, userCount) {
    const buyers = new Map();
    const byStatus = {};
    const byMonth = {};
    let revenue = 0;
    const amounts = [];

    for (const o of orders) {
        buyers.set(String(o.userId), (buyers.get(String(o.userId)) || 0) + 1);
        byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        const ym = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
        byMonth[ym] = (byMonth[ym] || 0) + 1;
        revenue += o.totalAmount;
        amounts.push(o.totalAmount);
    }

    const perBuyer = [...buyers.values()].sort((a, b) => a - b);
    amounts.sort((a, b) => a - b);
    const q = (arr, p) => (arr.length ? arr[Math.floor((arr.length - 1) * p)] : 0);

    console.log(
        `   订单总数: ${orders.length}  |  下过单的用户: ${buyers.size}/${userCount}  |  零单用户: ${userCount - buyers.size}`,
    );
    console.log(
        `   人均订单(下单用户): 中位数 ${q(perBuyer, 0.5)} / P90 ${q(perBuyer, 0.9)} / 最多 ${perBuyer[perBuyer.length - 1] || 0}`,
    );
    console.log(
        `   客单价(AOV): 中位数 ¥${q(amounts, 0.5)} / P90 ¥${q(amounts, 0.9)} / 最高 ¥${amounts[amounts.length - 1] || 0}`,
    );
    console.log(`   总 GMV: ¥${Math.round(revenue).toLocaleString()}`);
    console.log(
        '   各状态占比:',
        Object.fromEntries(
            Object.entries(byStatus).map(([k, v]) => [
                k,
                `${((v / orders.length) * 100).toFixed(1)}%`,
            ]),
        ),
    );

    // 近 12 个月订单量，能看出增长趋势和大促尖峰
    const recentMonths = Object.keys(byMonth).sort().slice(-12);
    const maxCount = Math.max(...recentMonths.map((m) => byMonth[m]));
    console.log('   近12个月订单量走势:');
    for (const m of recentMonths) {
        const bar = '█'.repeat(Math.round((byMonth[m] / maxCount) * 30));
        console.log(`     ${m}  ${String(byMonth[m]).padStart(4)}  ${bar}`);
    }
}

async function seedOrders() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('缺少 MONGODB_URI 环境变量，请用 `node --env-file=.env seedOrders.js` 运行');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);

        const users = await User.find({}, { _id: 1 });
        if (users.length === 0) {
            console.error('❌ 数据库里没有用户，请先运行  npm run seed:users');
            process.exitCode = 1;
            return;
        }

        const orders = buildOrdersForUsers(users);

        // 清空旧订单，保证可重复运行
        await Order.deleteMany({});
        // timestamps: false —— 让 createdAt 用我们指定的值，而不是被插入时刻覆盖
        // 分批插入，避免一次 insertMany 文档过多
        const BATCH = 2000;
        for (let i = 0; i < orders.length; i += BATCH) {
            await Order.insertMany(orders.slice(i, i + BATCH), { timestamps: false });
        }

        console.log(`✅ seed orders done: 为 ${users.length} 个用户造了 ${orders.length} 笔订单`);
        summarize(orders, users.length);
    } catch (err) {
        console.error('❌ seed orders failed:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

// 仅当作为脚本直接运行时才连库执行；被 import 时只导出工具函数（方便测试/校验，无副作用）
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) seedOrders();

export { buildOrdersForUsers, summarize };
