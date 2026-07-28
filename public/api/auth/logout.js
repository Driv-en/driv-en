const express = require('express');
const router = express.Router();

// POST /auth/logout
router.post('/logout', async (req, res) => {
    try {
        if (req.session) {
            req.session.destroy(() => {});
        }

        return res.json({
            success: true
        });

    } catch (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;
