const express = require('express');
const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required.'
        });
    }

    try {
        // Placeholder: call your authentication service
        const user = await req.services.auth.login(email, password);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Session creation handled by your middleware
        req.session.userId = user.id;
        req.session.role = user.role;

        return res.json({
            success: true,
            role: user.role
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;
