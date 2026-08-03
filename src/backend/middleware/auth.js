const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access Denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access Denied. Invalid token format.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'mot_app_secure_secret_token_2026');
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid authentication token.' });
  }
}

module.exports = authMiddleware;
