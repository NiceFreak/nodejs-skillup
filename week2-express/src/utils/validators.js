// Validate ObjectId format (24 hex characters)
export const validateObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};