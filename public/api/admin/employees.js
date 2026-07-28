const express = require('express');
const router = express.Router();

// GET /admin/employees
router.get('/', async (req, res) => {
    try {
        const employees = await req.services.admin.employees.list();
        return res.json({ success: true, employees });
    } catch (err) {
        console.error('List employees error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /admin/employees/:id
router.get('/:id', async (req, res) => {
    try {
        const employee = await req.services.admin.employees.get(req.params.id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        return res.json({ success: true, employee });
    } catch (err) {
        console.error('Get employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /admin/employees
router.post('/', async (req, res) => {
    const { firstName, lastName, roleId, divisionId, email } = req.body;

    if (!firstName || !lastName || !roleId || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'firstName, lastName, roleId, and divisionId are required.'
        });
    }

    try {
        const employee = await req.services.admin.employees.create({
            firstName,
            lastName,
            roleId,
            divisionId,
            email
        });

        return res.json({ success: true, employee });
    } catch (err) {
        console.error('Create employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /admin/employees/:id
router.put('/:id', async (req, res) => {
    const { firstName, lastName, roleId, divisionId, email } = req.body;

    if (!firstName || !lastName || !roleId || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'firstName, lastName, roleId, and divisionId are required.'
        });
    }

    try {
        const updated = await req.services.admin.employees.update(req.params.id, {
            firstName,
            lastName,
            roleId,
            divisionId,
            email
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        return res.json({ success: true, employee: updated });
    } catch (err) {
        console.error('Update employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /admin/employees/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.admin.employees.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
