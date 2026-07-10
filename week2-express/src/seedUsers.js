import mongoose from "mongoose";
import User from "./models/users.js";

/**
 * 用户种子脚本
 *
 * 运行：  node --env-file=.env seedUsers.js
 * 或：    npm run seed:users
 *
 * 作用：清空 users 集合并批量生成 USER_COUNT 个用户（含收货地址）。
 * 生成的用户会被 seedOrders.js 读取，用来给订单挂 userId。
 *
 * 用固定随机种子（mulberry32），每次运行生成的数据完全一致，方便测试/复现。
 */

const USER_COUNT = 30;
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
const rand = mulberry32(RANDOM_SEED);

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// —— 造数据用的词库 ——
const familyNames = ["张", "王", "李", "赵", "刘", "陈", "杨", "黄", "周", "吴", "徐", "孙", "马", "朱", "胡"];
const givenNames = ["伟", "芳", "娜", "秀英", "敏", "静", "强", "磊", "洋", "艳", "勇", "军", "杰", "娟", "涛", "明", "超", "霞", "平", "刚"];

// 省份 -> 城市，保证 province / city 搭配合理
const regions = [
    { province: "北京市", cities: ["北京市"] },
    { province: "上海市", cities: ["上海市"] },
    { province: "广东省", cities: ["广州市", "深圳市", "东莞市", "珠海市"] },
    { province: "浙江省", cities: ["杭州市", "宁波市", "温州市", "嘉兴市"] },
    { province: "江苏省", cities: ["南京市", "苏州市", "无锡市", "常州市"] },
    { province: "四川省", cities: ["成都市", "绵阳市", "德阳市"] },
    { province: "湖北省", cities: ["武汉市", "宜昌市", "襄阳市"] },
    { province: "陕西省", cities: ["西安市", "宝鸡市", "咸阳市"] },
];

const streets = ["中山路", "人民路", "解放大道", "科技园路", "文一西路", "长江大道", "复兴路", "新华街", "创业大道", "和平里"];

function randomPhone() {
    const prefixes = ["138", "139", "150", "151", "158", "186", "188", "199", "177"];
    let tail = "";
    for (let i = 0; i < 8; i++) tail += randInt(0, 9);
    return pick(prefixes) + tail;
}

function randomAddress(recipient) {
    const region = pick(regions);
    return {
        recipient,
        phone: randomPhone(),
        province: region.province,
        city: pick(region.cities),
        detailAddress: `${pick(streets)}${randInt(1, 200)}号${randInt(1, 30)}栋${randInt(101, 2508)}室`,
    };
}

function buildUsers(count) {
    const users = [];
    const usedEmails = new Set();

    for (let i = 0; i < count; i++) {
        const name = pick(familyNames) + pick(givenNames);

        // 邮箱必须唯一（schema 上有 unique 约束），用序号兜底
        let email = `user${i + 1}@example.com`;
        while (usedEmails.has(email)) email = `user${i + 1}_${randInt(1, 9999)}@example.com`;
        usedEmails.add(email);

        // 每个用户 1~2 个收货地址
        const addressCount = randInt(1, 2);
        const addresses = [];
        for (let a = 0; a < addressCount; a++) addresses.push(randomAddress(name));

        users.push({
            name,
            email,
            age: randInt(18, 65),
            addresses,
        });
    }
    return users;
}

async function seedUsers() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("缺少 MONGODB_URI 环境变量，请用 `node --env-file=.env seedUsers.js` 运行");
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);

        const users = buildUsers(USER_COUNT);

        // 清空旧用户，保证可重复运行
        await User.deleteMany({});
        const inserted = await User.insertMany(users);

        console.log(`✅ seed users done: 已插入 ${inserted.length} 个用户`);
        console.log("   示例 _id:", inserted.slice(0, 3).map((u) => `${u.name}(${u._id})`).join(", "));
        console.log("   接着运行  npm run seed:orders  给这些用户造订单");
    } catch (err) {
        console.error("❌ seed users failed:", err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedUsers();
