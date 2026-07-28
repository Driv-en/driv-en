module.exports = (db) => {
    return {
        // LIST ALL PROJECTS
        async list() {
            return await db.projects.findAll();
        },

        // GET ONE PROJECT
        async get(id) {
            const project = await db.projects.findById(id);
            return project || null;
        },

        // CREATE PROJECT
        async create({ name, divisionId, customerId }) {
            const project = await db.projects.create({
                name,
                divisionId,
                customerId
            });

            return project;
        },

        // UPDATE PROJECT
        async update(id, { name, divisionId, customerId }) {
            const existing = await db.projects.findById(id);
            if (!existing) return null;

            const updated = await db.projects.update(id, {
                name,
                divisionId,
                customerId
            });

            return updated;
        },

        // DELETE PROJECT
        async delete(id) {
            const existing = await db.projects.findById(id);
            if (!existing) return null;

            await db.projects.delete(id);
            return true;
        }
    };
};
