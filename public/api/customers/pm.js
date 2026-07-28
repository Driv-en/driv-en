const express = require('express');
const router = express.Router();

// GET /customers/pm
router.get('/', async (req, res) => {
    try {
        const pms = await req.services.customers.pm.list(req.session.userId);
        return res.json({ success: true, pms });
    } catch (err) {
        console.error('List customer PMs error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /customers/pm/:id
router.get('/:id', async (req, res) => {
    try {
        const pm = await req.services.customers.pm.get(
            req.params.id,
            req.session.userId
        );

        if (!pm) {
            return res.status(404).json({ success: false, message: 'PM not found.' });
        }

        return res.json({ success: true, pm });
    } catch (err) {
        console.error('Get customer PM error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /customers/pm
router.post('/', async (req, res) => {
    const { equipmentId, projectId, pmTemplateId, dueDate } = req.body;

    if (!equipmentId || !projectId || !pmTemplateId || !dueDate) {
        return res.status(400).json({
            success: false,
            message: 'equipmentId, projectId, pmTemplateId, and dueDate are required.'
        });
    }

    try {
        const pm = await req.services.customers.pm.create({
            equipmentId,
            projectId,
            pmTemplateId,
            dueDate,
            userId: req.session.userId
        });

        return res.json({ success: true, pm });
    } catch (err) {
        console.error('Create customer PM error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /customers/pm/:id
router.put('/:id', async (req, res) => {
    const { dueDate, completedDate, notes } = req.body;

    if (!dueDate) {
        return res.status(400).json({
            success: false,
            message: 'dueDate is required.'
        });
    }

    try {
        const updated = await req.services.customers.pm.update(
            req.params.id,
            {
                dueDate,
                completedDate,
                notes
            },
            req.session.userId
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'PM not found.' });
        }

        return res.json({ success: true, pm: updated });
    } catch (err) {
        console.error('Update customer PM error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /customers/pm/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.customers.pm.delete(
            req.params.id,
            req.session.userId
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'PM not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete customer PM error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
