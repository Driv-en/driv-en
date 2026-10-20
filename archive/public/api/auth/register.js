const express = require('express');
const router = express.Router();

// POST /auth/register
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required.'
        });
    }

    try {
        // Placeholder: call your registration service
        const user = await req.services.auth.register({
            firstName,
            lastName,
            email,
            password
        });

        if (!user) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists.'
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
        console.error('Registration error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
});

module.exports = router;
