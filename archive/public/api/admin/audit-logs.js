const express = require('express');
const router = express.Router();

// GET /admin/audit-logs
router.get('/', async (req, res) => {
    try {
        const logs = await req.services.admin.auditLogs.list();
        return res.json({ success: true, logs });
    } catch (err) {
        console.error('List audit logs error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /admin/audit-logs/:id
router.get('/:id', async (req, res) => {
    try {
        const log = await req.services.admin.auditLogs.get(req.params.id);

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Audit log not found.'
            });
        }

        return res.json({ success: true, log });
    } catch (err) {
        console.error('Get audit log error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
