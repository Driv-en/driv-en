const express = require('express');
const router = express.Router();

// GET /admin/projects
router.get('/', async (req, res) => {
    try {
        const projects = await req.services.admin.projects.list();
        return res.json({ success: true, projects });
    } catch (err) {
        console.error('List projects error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /admin/projects/:id
router.get('/:id', async (req, res) => {
    try {
        const project = await req.services.admin.projects.get(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }
        return res.json({ success: true, project });
    } catch (err) {
        console.error('Get project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /admin/projects
router.post('/', async (req, res) => {
    const { name, divisionId, customerId } = req.body;

    if (!name || !divisionId || !customerId) {
        return res.status(400).json({
            success: false,
            message: 'Name, divisionId, and customerId are required.'
        });
    }

    try {
        const project = await req.services.admin.projects.create({
            name,
            divisionId,
            customerId
        });

        return res.json({ success: true, project });
    } catch (err) {
        console.error('Create project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /admin/projects/:id
router.put('/:id', async (req, res) => {
    const { name, divisionId, customerId } = req.body;

    if (!name || !divisionId || !customerId) {
        return res.status(400).json({
            success: false,
            message: 'Name, divisionId, and customerId are required.'
        });
    }

    try {
        const updated = await req.services.admin.projects.update(req.params.id, {
            name,
            divisionId,
            customerId
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        return res.json({ success: true, project: updated });
    } catch (err) {
        console.error('Update project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /admin/projects/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await req.services.admin.projects.delete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Delete project error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
