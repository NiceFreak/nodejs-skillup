export const setUpdateDataWhitelist = (req, res, next) => {
    const { name, email, age, addresses } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (age !== undefined) updateData.age = age;
    if (addresses !== undefined) updateData.addresses = addresses;
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided to update' });
    }
    req.updateData = updateData;
    next();
};