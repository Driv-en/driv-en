module.exports = (db) => {
    return {
        // LIST ALL EQUIPMENT
        async list() {
            return await db.equipment.findAll();
        },

        // GET ONE EQUIPMENT ITEM
        async get(id) {
            const item = await db.equipment.findById(id);
            return item || null;
        },

        // CREATE EQUIPMENT
        async create({ name, equipmentTypeId, divisionId }) {
            const item = await db.equipment.create({
                name,
                equipmentTypeId,
                divisionId
            });

            return item;
        },

        // UPDATE EQUIPMENT
        async update(id, { name, equipmentTypeId, divisionId }) {
            const existing = await db.equipment.findById(id);
            if (!existing) return null;

            const updated = await db.equipment.update(id, {
                name,
                equipmentTypeId,
                divisionId
            });

            return updated;
        },

        // DELETE EQUIPMENT
        async delete(id) {
            const existing = await db.equipment.findById(id);
            if (!existing) return null;

            await db.equipment.delete(id);
            return true;
        }
    };
};
