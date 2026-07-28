module.exports = (db) => {
    return {
        // LIST ALL WORK ORDERS FOR THIS CUSTOMER
        async list(userId) {
            return await db.workOrders.findAllByCustomer(userId);
        },

        // GET ONE WORK ORDER (scoped to customer)
        async get(id, userId) {
            const workOrder = await db.workOrders.findById(id);
            if (!workOrder) return null;
            if (workOrder.customerId !== userId) return null;

            return workOrder;
        },

        // CREATE WORK ORDER (customer-owned)
        async create({ equipmentId, projectId, description, priority, userId }) {
            const workOrder = await db.workOrders.create({
                equipmentId,
                projectId,
                description,
                priority,
                customerId: userId
            });

            return workOrder;
        },

        // UPDATE WORK ORDER (scoped to customer)
        async update(id, { description, priority, completedDate, notes }, userId) {
            const existing = await db.workOrders.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            const updated = await db.workOrders.update(id, {
                description,
                priority,
                completedDate,
                notes
            });

            return updated;
        },

        // DELETE WORK ORDER (scoped to customer)
        async delete(id, userId) {
            const existing = await db.workOrders.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            await db.workOrders.delete(id);
            return true;
        }
    };
};
