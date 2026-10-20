const express = require('express');
const router = express.Router();

// GET /customers/inspections
router.get('/', async (req, res) => {
    try {
        const inspections = await req.services.customers.inspections.list(req.session.userId);
        return res.json({ success: true, inspections });
    } catch (err) {
        console.error('List customer inspections error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /customers/inspections/:id
router.get('/:id', async (req, res) => {
    try {
        const inspection = await req.services.customers.inspections.get(
            req.params.id,
            req.session.userId
        );

        if (!inspection) {
            return res.status(404).json({ success: false, message: 'Inspection not found.' });
        }

        return res.json({ success: true, inspection });
    } catch (err) {
        console.error('Get customer inspection error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /customers/inspections
router.post('/', async (req, res) => {
    const { equipmentId, projectId, inspectionTemplateId, date } = req.body;

    if (!equipmentId || !projectId || !inspectionTemplateId || !date) {
        return res.status(400).json({
            success: false,
            message: 'equipmentId, projectId, inspectionTemplateId, and date are required.'
        });
    }

    try {
        const inspection = await req.services.customers.inspections.create({
            equipmentId,
            projectId,
            inspectionTemplateId,
            date,
            userId: req.session.userId
        });

        return res.json({ success: true, inspection });
    } catch (err) {
        console.error('Create customer inspection error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /customers/inspections/:id
router.put('/:id', async (req, res) => {
    const { date, completedDate, notes } = req.body;

    if (!date) {
        return res.status(400).json({
            success: false,
            message: 'date is required.'
        });
    }

    try {
        const updated = await req.services.customers.inspections.update(
            req.params.id,
            {
                date,
                completedDate,
                notes
            },
            req.session.userId
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Inspection not found.' });
        }

        return res.json({ success: true, inspection: updated });
    } catch (err) {
        console.error('Update customer inspection error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /customers/inspections/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.customers.inspections.delete(
            req.params.id,
            req.session.userId
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Inspection not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete customer inspection error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
