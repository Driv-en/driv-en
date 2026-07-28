const express = require('express');
const router = express.Router();

// GET /auth/me
router.get('/me', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.json({
                authenticated: false
            });
        }

        return res.json({
            authenticated: true,
            id: req.session.userId,
            role: req.session.role
        });

    } catch (err) {
        console.error('Auth me error:', err);
        return res.status(500).json({
            authenticated: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;
