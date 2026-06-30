// mock data
const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
];

export async function findAll() {
    return users;
}

export async function findById(id) {
    const user = users.find(user => user.id === parseInt(id));
    return user;
}