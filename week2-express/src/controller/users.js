// 从 routes/getUsersData.js 导入 getUsersData 函数的 request handler
// 从 services/getUsersData.js 导入 getUsersData 函数的返回值, 并创建 response 对象
import { getUsersData } from "../services/getUsersData.js";

export async function createUsersData(req, res) {
    const users = await getUsersData();
    res.json(users);
}
