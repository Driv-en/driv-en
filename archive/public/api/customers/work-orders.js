const express = require('express');
const router = express.Router();

// GET /customers/work-orders
router.get('/', async (req, res) => {
    try {
        const workOrders = await req.services.customers.workOrders.list(req.session.userId);
        return res.json({ success: true, workOrders });
    } catch (err) {
        console.error('List customer work orders error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /customers/work-orders/:id
router.get('/:id', async (req, res) => {
    try {
        const workOrder = await req.services.customers.workOrders.get(
            req.params.id,
            req.session.userId
        );

        if (!workOrder) {
            return res.status(404).json({ success: false, message: 'Work order not found.' });
        }

        return res.json({ success: true, workOrder });
    } catch (err) {
        console.error('Get customer work order error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /customers/work-orders
router.post('/', async (req, res) => {
    const { equipmentId, projectId, description, priority } = req.body;

    if (!equipmentId || !projectId || !description) {
        return res.status(400).json({
            success: false,
            message: 'equipmentId, projectId, and description are required.'
        });
    }

    try {
        const workOrder = await req.services.customers.workOrders.create({
            equipmentId,
            projectId,
            description,
            priority,
            userId: req.session.userId
        });

        return res.json({ success: true, workOrder });
    } catch (err) {
        console.error('Create customer work order error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /customers/work-orders/:id
router.put('/:id', async (req, res) => {
    const { description, priority, completedDate, notes } = req.body;

    if (!description) {
        return res.status(400).json({
            success: false,
            message: 'description is required.'
        });
    }

    try {
        const updated = await req.services.customers.workOrders.update(
            req.params.id,
            {
                description,
                priority,
                completedDate,
                notes
            },
            req.session.userId
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Work order not found.' });
        }

        return res.json({ success: true, workOrder: updated });
    } catch (err) {
        console.error('Update customer work order error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /customers/work-orders/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.customers.workOrders.delete(
            req.params.id,
            req.session.userId
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Work order not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete customer work order error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
