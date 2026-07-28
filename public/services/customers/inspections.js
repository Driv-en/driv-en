module.exports = (db) => {
    return {
        // LIST ALL INSPECTIONS FOR THIS CUSTOMER
        async list(userId) {
            return await db.inspections.findAllByCustomer(userId);
        },

        // GET ONE INSPECTION (scoped to customer)
        async get(id, userId) {
            const inspection = await db.inspections.findById(id);
            if (!inspection) return null;
            if (inspection.customerId !== userId) return null;

            return inspection;
        },

        // CREATE INSPECTION (customer-owned)
        async create({ equipmentId, projectId, inspectionTemplateId, date, userId }) {
            const inspection = await db.inspections.create({
                equipmentId,
                projectId,
                inspectionTemplateId,
                date,
                customerId: userId
            });

            return inspection;
        },

        // UPDATE INSPECTION (scoped to customer)
        async update(id, { date, completedDate, notes }, userId) {
            const existing = await db.inspections.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            const updated = await db.inspections.update(id, {
                date,
                completedDate,
                notes
            });

            return updated;
        },

        // DELETE INSPECTION (scoped to customer)
        async delete(id, userId) {
            const existing = await db.inspections.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            await db.inspections.delete(id);
            return true;
        }
    };
};
