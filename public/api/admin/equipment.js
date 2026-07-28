const express = require('express');
const router = express.Router();

// GET /admin/equipment
router.get('/', async (req, res) => {
    try {
        const equipment = await req.services.admin.equipment.list();
        return res.json({ success: true, equipment });
    } catch (err) {
        console.error('List equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /admin/equipment/:id
router.get('/:id', async (req, res) => {
    try {
        const item = await req.services.admin.equipment.get(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }
        return res.json({ success: true, equipment: item });
    } catch (err) {
        console.error('Get equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /admin/equipment
router.post('/', async (req, res) => {
    const { name, equipmentTypeId, divisionId } = req.body;

    if (!name || !equipmentTypeId || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'Name, equipmentTypeId, and divisionId are required.'
        });
    }

    try {
        const item = await req.services.admin.equipment.create({
            name,
            equipmentTypeId,
            divisionId
        });

        return res.json({ success: true, equipment: item });
    } catch (err) {
        console.error('Create equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /admin/equipment/:id
router.put('/:id', async (req, res) => {
    const { name, equipmentTypeId, divisionId } = req.body;

    if (!name || !equipmentTypeId || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'Name, equipmentTypeId, and divisionId are required.'
        });
    }

    try {
        const updated = await req.services.admin.equipment.update(req.params.id, {
            name,
            equipmentTypeId,
            divisionId
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }

        return res.json({ success: true, equipment: updated });
    } catch (err) {
        console.error('Update equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /admin/equipment/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.admin.equipment.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete equipment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
