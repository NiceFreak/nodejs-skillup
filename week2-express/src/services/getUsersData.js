// 从 repositories/getUsers.js 导入 getUsers 函数, 并创建 users 变量
// 将数据返回给 controller/users.js 的 getUsersData 函数
import { getUsers } from "../repositories/getUsers.js";

export async function getUsersData() {
    const users = await getUsers();
    return users;
}
