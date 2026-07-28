module.exports = (db) => {
    return {
        // LIST ALL PMs FOR THIS CUSTOMER
        async list(userId) {
            return await db.pm.findAllByCustomer(userId);
        },

        // GET ONE PM (scoped to customer)
        async get(id, userId) {
            const pm = await db.pm.findById(id);
            if (!pm) return null;
            if (pm.customerId !== userId) return null;

            return pm;
        },

        // CREATE PM (customer-owned)
        async create({ equipmentId, projectId, pmTemplateId, dueDate, userId }) {
            const pm = await db.pm.create({
                equipmentId,
                projectId,
                pmTemplateId,
                dueDate,
                customerId: userId
            });

            return pm;
        },

        // UPDATE PM (scoped to customer)
        async update(id, { dueDate, completedDate, notes }, userId) {
            const existing = await db.pm.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            const updated = await db.pm.update(id, {
                dueDate,
                completedDate,
                notes
            });

            return updated;
        },

        // DELETE PM (scoped to customer)
        async delete(id, userId) {
            const existing = await db.pm.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            await db.pm.delete(id);
            return true;
        }
    };
};
