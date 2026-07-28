const express = require('express');
const router = express.Router();

// GET /customers/equipment
router.get('/', async (req, res) => {
    try {
        const equipment = await req.services.customers.equipment.list(req.session.userId);
        return res.json({ success: true, equipment });
    } catch (err) {
        console.error('List customer equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /customers/equipment/:id
router.get('/:id', async (req, res) => {
    try {
        const item = await req.services.customers.equipment.get(
            req.params.id,
            req.session.userId
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }

        return res.json({ success: true, equipment: item });
    } catch (err) {
        console.error('Get customer equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /customers/equipment
router.post('/', async (req, res) => {
    const { name, equipmentTypeId, divisionId } = req.body;

    if (!name || !equipmentTypeId || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'Name, equipmentTypeId, and divisionId are required.'
        });
    }

    try {
        const item = await req.services.customers.equipment.create({
            name,
            equipmentTypeId,
            divisionId,
            userId: req.session.userId
        });

        return res.json({ success: true, equipment: item });
    } catch (err) {
        console.error('Create customer equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /customers/equipment/:id
router.put('/:id', async (req, res) => {
    const { name, equipmentTypeId, divisionId } = req.body;

    if (!name || !equipmentTypeId || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'Name, equipmentTypeId, and divisionId are required.'
        });
    }

    try {
        const updated = await req.services.customers.equipment.update(
            req.params.id,
            {
                name,
                equipmentTypeId,
                divisionId
            },
            req.session.userId
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }

        return res.json({ success: true, equipment: updated });
    } catch (err) {
        console.error('Update customer equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /customers/equipment/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.customers.equipment.delete(
            req.params.id,
            req.session.userId
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete customer equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
