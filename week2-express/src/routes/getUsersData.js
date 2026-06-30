// 客户端发起 http 请求, /users 路径, 服务器端返回 users 数据
import { createUsersData } from "../controller/users.js";

export async function getUsersData(req, res) {
    await createUsersData(req, res);
    console.log('getUsersData: ', res.json);
}
