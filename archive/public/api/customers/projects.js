const express = require('express');
const router = express.Router();

// GET /customers/projects
router.get('/', async (req, res) => {
    try {
        const projects = await req.services.customers.projects.list(req.session.userId);
        return res.json({ success: true, projects });
    } catch (err) {
        console.error('List customer projects error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /customers/projects/:id
router.get('/:id', async (req, res) => {
    try {
        const project = await req.services.customers.projects.get(req.params.id, req.session.userId);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        return res.json({ success: true, project });
    } catch (err) {
        console.error('Get customer project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /customers/projects
router.post('/', async (req, res) => {
    const { name, divisionId } = req.body;

    if (!name || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'Name and divisionId are required.'
        });
    }

    try {
        const project = await req.services.customers.projects.create({
            name,
            divisionId,
            userId: req.session.userId
        });

        return res.json({ success: true, project });
    } catch (err) {
        console.error('Create customer project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /customers/projects/:id
router.put('/:id', async (req, res) => {
    const { name, divisionId } = req.body;

    if (!name || !divisionId) {
        return res.status(400).json({
            success: false,
            message: 'Name and divisionId are required.'
        });
    }

    try {
        const updated = await req.services.customers.projects.update(
            req.params.id,
            {
                name,
                divisionId
            },
            req.session.userId
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        return res.json({ success: true, project: updated });
    } catch (err) {
        console.error('Update customer project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /customers/projects/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.customers.projects.delete(
            req.params.id,
            req.session.userId
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete customer project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
