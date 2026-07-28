module.exports = (db) => {
    return {
        // LIST ALL EQUIPMENT FOR THIS CUSTOMER
        async list(userId) {
            return await db.equipment.findAllByCustomer(userId);
        },

        // GET ONE EQUIPMENT ITEM (scoped to customer)
        async get(id, userId) {
            const item = await db.equipment.findById(id);
            if (!item) return null;
            if (item.customerId !== userId) return null;

            return item;
        },

        // CREATE EQUIPMENT (customer-owned)
        async create({ name, equipmentTypeId, divisionId, userId }) {
            const item = await db.equipment.create({
                name,
                equipmentTypeId,
                divisionId,
                customerId: userId
            });

            return item;
        },

        // UPDATE EQUIPMENT (scoped to customer)
        async update(id, { name, equipmentTypeId, divisionId }, userId) {
            const existing = await db.equipment.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            const updated = await db.equipment.update(id, {
                name,
                equipmentTypeId,
                divisionId
            });

            return updated;
        },

        // DELETE EQUIPMENT (scoped to customer)
        async delete(id, userId) {
            const existing = await db.equipment.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            await db.equipment.delete(id);
            return true;
        }
    };
};
