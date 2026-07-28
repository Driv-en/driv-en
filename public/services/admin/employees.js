module.exports = (db) => {
    return {
        // LIST ALL EMPLOYEES
        async list() {
            return await db.employees.findAll();
        },

        // GET ONE EMPLOYEE
        async get(id) {
            const employee = await db.employees.findById(id);
            return employee || null;
        },

        // CREATE EMPLOYEE
        async create({ firstName, lastName, roleId, divisionId, email }) {
            const employee = await db.employees.create({
                firstName,
                lastName,
                roleId,
                divisionId,
                email
            });

            return employee;
        },

        // UPDATE EMPLOYEE
        async update(id, { firstName, lastName, roleId, divisionId, email }) {
            const existing = await db.employees.findById(id);
            if (!existing) return null;

            const updated = await db.employees.update(id, {
                firstName,
                lastName,
                roleId,
                divisionId,
                email
            });

            return updated;
        },

        // DELETE EMPLOYEE
        async delete(id) {
            const existing = await db.employees.findById(id);
            if (!existing) return null;

            await db.employees.delete(id);
            return true;
        }
    };
};
