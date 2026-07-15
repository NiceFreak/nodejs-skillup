import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import User from './models/users.js';

/**
 * 用户种子脚本
 *
 * 运行：  node --env-file=.env seedUsers.js
 * 或：    npm run seed:users
 *
 * 目标：造一批“像真实电商”的客户，供 seedOrders.js 挂订单。
 * 真实感体现在：
 *   - 年龄按正态分布集中在 25~40 岁（不是均匀分布）
 *   - 大部分人 1 个收货地址，少数人 2~3 个
 *   - 姓名从常见姓 + 常见名组合，邮箱保证唯一
 *
 * 用固定随机种子（mulberry32），同一份代码每次生成的数据一致，方便复现/测试。
 */

const USER_COUNT = 2000;
const RANDOM_SEED = 20260710;

// —— 一个可复现的伪随机数发生器，避免引入 faker 之类的额外依赖 ——
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// —— 通用随机工具（都基于同一个 rand，保证整份数据可复现）——
function makeRandom(seed) {
    const rand = mulberry32(seed);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
    // Box-Muller：把均匀分布变成正态分布，用来造“集中在某个值附近”的数据
    const gaussian = (mean, std) => {
        const u1 = rand() || 1e-9;
        const u2 = rand();
        return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    return { rand, pick, randInt, gaussian };
}

// —— 造数据用的词库 ——
const familyNames = [
    '张',
    '王',
    '李',
    '赵',
    '刘',
    '陈',
    '杨',
    '黄',
    '周',
    '吴',
    '徐',
    '孙',
    '马',
    '朱',
    '胡',
    '郭',
    '林',
    '何',
    '高',
    '罗',
];
const givenNames = [
    '伟',
    '芳',
    '娜',
    '秀英',
    '敏',
    '静',
    '强',
    '磊',
    '洋',
    '艳',
    '勇',
    '军',
    '杰',
    '娟',
    '涛',
    '明',
    '超',
    '霞',
    '平',
    '刚',
    '婷',
    '浩',
    '宇',
    '欣',
    '梓涵',
    '子轩',
    '雨桐',
    '思远',
];

// 省份 -> 城市，保证 province / city 搭配合理；靠前的省份人口/网购活跃度更高，给更大权重
const regions = [
    { province: '广东省', cities: ['广州市', '深圳市', '东莞市', '珠海市'], weight: 6 },
    { province: '浙江省', cities: ['杭州市', '宁波市', '温州市', '嘉兴市'], weight: 5 },
    { province: '江苏省', cities: ['南京市', '苏州市', '无锡市', '常州市'], weight: 5 },
    { province: '上海市', cities: ['上海市'], weight: 4 },
    { province: '北京市', cities: ['北京市'], weight: 4 },
    { province: '四川省', cities: ['成都市', '绵阳市', '德阳市'], weight: 3 },
    { province: '湖北省', cities: ['武汉市', '宜昌市', '襄阳市'], weight: 2 },
    { province: '陕西省', cities: ['西安市', '宝鸡市', '咸阳市'], weight: 2 },
];

const streets = [
    '中山路',
    '人民路',
    '解放大道',
    '科技园路',
    '文一西路',
    '长江大道',
    '复兴路',
    '新华街',
    '创业大道',
    '和平里',
];

// 预计算地区的累积权重，用于加权抽样
const regionCumWeights = (() => {
    let sum = 0;
    return regions.map((r) => (sum += r.weight));
})();
const regionTotalWeight = regionCumWeights[regionCumWeights.length - 1];

function buildUsers(count, seed = RANDOM_SEED) {
    const { rand, pick, randInt, gaussian } = makeRandom(seed);

    const pickRegion = () => {
        const x = rand() * regionTotalWeight;
        const idx = regionCumWeights.findIndex((c) => x < c);
        return regions[idx];
    };

    const randomPhone = () => {
        const prefixes = [
            '138',
            '139',
            '150',
            '151',
            '158',
            '186',
            '188',
            '199',
            '177',
            '135',
            '136',
            '159',
        ];
        let tail = '';
        for (let i = 0; i < 8; i++) tail += randInt(0, 9);
        return pick(prefixes) + tail;
    };

    const randomAddress = (recipient) => {
        const region = pickRegion();
        return {
            recipient,
            phone: randomPhone(),
            province: region.province,
            city: pick(region.cities),
            detailAddress: `${pick(streets)}${randInt(1, 200)}号${randInt(1, 30)}栋${randInt(101, 2508)}室`,
        };
    };

    const users = [];
    const usedEmails = new Set();

    for (let i = 0; i < count; i++) {
        const name = pick(familyNames) + pick(givenNames);

        // 邮箱必须唯一（schema 上有 unique 约束），用序号做主键、随机串兜底
        let email = `user${i + 1}@example.com`;
        while (usedEmails.has(email)) email = `user${i + 1}_${randInt(1, 9999)}@example.com`;
        usedEmails.add(email);

        // 年龄：正态分布，集中在 32 岁上下，裁剪到 18~70 的合理区间
        const age = Math.max(18, Math.min(70, Math.round(gaussian(32, 9))));

        // 收货地址数：约 70% 只有 1 个，25% 有 2 个，5% 有 3 个
        const r = rand();
        const addressCount = r < 0.7 ? 1 : r < 0.95 ? 2 : 3;
        const addresses = [];
        for (let a = 0; a < addressCount; a++) addresses.push(randomAddress(name));

        users.push({ name, email, age, addresses });
    }
    return users;
}

async function seedUsers() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('缺少 MONGODB_URI 环境变量，请用 `node --env-file=.env seedUsers.js` 运行');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);

        const users = buildUsers(USER_COUNT);

        // 清空旧用户，保证可重复运行
        await User.deleteMany({});
        const inserted = await User.insertMany(users);

        console.log(`✅ seed users done: 已插入 ${inserted.length} 个用户`);
        console.log(
            '   示例:',
            inserted
                .slice(0, 3)
                .map((u) => `${u.name}/${u.age}岁(${u._id})`)
                .join('  '),
        );
        console.log('   接着运行  npm run seed:orders  给这些用户造订单');
    } catch (err) {
        console.error('❌ seed users failed:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

// 仅当作为脚本直接运行时才连库执行；被 import 时只导出工具函数（方便测试/校验，无副作用）
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) seedUsers();

export { buildUsers, makeRandom, USER_COUNT };
