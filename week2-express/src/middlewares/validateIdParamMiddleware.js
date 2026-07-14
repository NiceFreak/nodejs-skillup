import { validateObjectId } from "../utils/validators.js";

export const validateIdParam = (req, res, next) => {
  const { id } = req.params;
  if (!validateObjectId(id)) {
    return res.status(400).json({ error: 'ID 格式不合法' });
  }
  next();
};
