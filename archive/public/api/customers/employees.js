const express = require('express');
const router = express.Router();

// GET /customers/employees
router.get('/', async (req, res) => {
    try {
        const employees = await req.services.customers.employees.list(req.session.userId);
        return res.json({ success: true, employees });
    } catch (err) {
        console.error('List customer employees error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /customers/employees/:id
router.get('/:id', async (req, res) => {
    try {
        const employee = await req.services.customers.employees.get(
            req.params.id,
            req.session.userId
        );

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        return res.json({ success: true, employee });
    } catch (err) {
        console.error('Get customer employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /customers/employees
router.post('/', async (req, res) => {
    const { firstName, lastName, roleId, email } = req.body;

    if (!firstName || !lastName || !roleId) {
        return res.status(400).json({
            success: false,
            message: 'firstName, lastName, and roleId are required.'
        });
    }

    try {
        const employee = await req.services.customers.employees.create({
            firstName,
            lastName,
            roleId,
            email,
            userId: req.session.userId
        });

        return res.json({ success: true, employee });
    } catch (err) {
        console.error('Create customer employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /customers/employees/:id
router.put('/:id', async (req, res) => {
    const { firstName, lastName, roleId, email } = req.body;

    if (!firstName || !lastName || !roleId) {
        return res.status(400).json({
            success: false,
            message: 'firstName, lastName, and roleId are required.'
        });
    }

    try {
        const updated = await req.services.customers.employees.update(
            req.params.id,
            {
                firstName,
                lastName,
                roleId,
                email
            },
            req.session.userId
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        return res.json({ success: true, employee: updated });
    } catch (err) {
        console.error('Update customer employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /customers/employees/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.customers.employees.delete(
            req.params.id,
            req.session.userId
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete customer employee error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
