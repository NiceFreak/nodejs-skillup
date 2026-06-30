// mock data
const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
];

export async function findAllUsers(id = null) {
    if (id) {
        const user = users.find(user => user.id === parseInt(id));
        return user ? [user] : [];
    }
    return users;
}
