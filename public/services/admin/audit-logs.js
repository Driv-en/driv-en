module.exports = (db) => {
    return {
        // LIST ALL AUDIT LOGS
        async list() {
            return await db.auditLogs.findAll();
        },

        // GET ONE AUDIT LOG ENTRY
        async get(id) {
            const log = await db.auditLogs.findById(id);
            return log || null;
        }
    };
};
