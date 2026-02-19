// src/middleware/roleMiddleware.js

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        return next();
    }
    return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
    });
};

const isAdminOrTester = (req, res, next) => {
    if (req.user && ['ADMIN', 'TESTER'].includes(req.user.role)) {
        return next();
    }
    return res.status(403).json({
        error: 'Access denied. Beta access required.'
    });
};

module.exports = {
    isAdmin,
    isAdminOrTester
};
