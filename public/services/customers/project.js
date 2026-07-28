module.exports = (db) => {
    return {
        // LIST ALL PROJECTS FOR THIS CUSTOMER
        async list(userId) {
            return await db.projects.findAllByCustomer(userId);
        },

        // GET ONE PROJECT (scoped to customer)
        async get(id, userId) {
            const project = await db.projects.findById(id);
            if (!project) return null;
            if (project.customerId !== userId) return null;

            return project;
        },

        // CREATE PROJECT (customer-owned)
        async create({ name, divisionId, userId }) {
            const project = await db.projects.create({
                name,
                divisionId,
                customerId: userId
            });

            return project;
        },

        // UPDATE PROJECT (scoped to customer)
        async update(id, { name, divisionId }, userId) {
            const existing = await db.projects.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            const updated = await db.projects.update(id, {
                name,
                divisionId
            });

            return updated;
        },

        // DELETE PROJECT (scoped to customer)
        async delete(id, userId) {
            const existing = await db.projects.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            await db.projects.delete(id);
            return true;
        }
    };
};
