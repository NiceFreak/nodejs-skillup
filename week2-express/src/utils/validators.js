// Validate ObjectId format (24 hex characters)
export const validateObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

// Check request body is a present, non-null, non-array object.
// express.json() leaves req.body as `undefined` when Content-Type isn't
// application/json, but `{}` when the JSON body is empty - `!req.body`
// alone only catches the first case.
export const hasRequestBody = (body) => {
    return typeof body === 'object' && body !== null && !Array.isArray(body);
};