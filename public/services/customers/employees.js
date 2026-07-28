module.exports = (db) => {
    return {
        // LIST ALL EMPLOYEES FOR THIS CUSTOMER
        async list(userId) {
            return await db.employees.findAllByCustomer(userId);
        },

        // GET ONE EMPLOYEE (scoped to customer)
        async get(id, userId) {
            const employee = await db.employees.findById(id);
            if (!employee) return null;
            if (employee.customerId !== userId) return null;

            return employee;
        },

        // CREATE EMPLOYEE (customer-owned)
        async create({ firstName, lastName, roleId, email, userId }) {
            const employee = await db.employees.create({
                firstName,
                lastName,
                roleId,
                email,
                customerId: userId
            });

            return employee;
        },

        // UPDATE EMPLOYEE (scoped to customer)
        async update(id, { firstName, lastName, roleId, email }, userId) {
            const existing = await db.employees.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            const updated = await db.employees.update(id, {
                firstName,
                lastName,
                roleId,
                email
            });

            return updated;
        },

        // DELETE EMPLOYEE (scoped to customer)
        async delete(id, userId) {
            const existing = await db.employees.findById(id);
            if (!existing) return null;
            if (existing.customerId !== userId) return null;

            await db.employees.delete(id);
            return true;
        }
    };
};
