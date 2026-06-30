// 写死一个 users 数组,导出一个函数(比如 `findAll()`)返回它。这层最简单,先落地。
export async function getUsers() {
    // mock data
    const users = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
    ];
    return users;
}
