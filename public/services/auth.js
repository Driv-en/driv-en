module.exports = (db) => {
    return {
        // LOGIN
        async login(email, password) {
            // Placeholder: replace with your data layer lookup
            const user = await db.users.findByEmail(email);

            if (!user) return null;
            if (user.password !== password) return null;

            return {
                id: user.id,
                role: user.role
            };
        },

        // LOGOUT (placeholder — session handled in route)
        async logout(userId) {
            return true;
        },

        // REGISTER
        async register({ firstName, lastName, email, password }) {
            const existing = await db.users.findByEmail(email);
            if (existing) return null;

            const user = await db.users.create({
                firstName,
                lastName,
                email,
                password,
                role: 'customer'
            });

            return {
                id: user.id,
                role: user.role
            };
        },

        // ME
        async me(userId) {
            const user = await db.users.findById(userId);
            if (!user) return null;

            return {
                id: user.id,
                role: user.role
            };
        }
    };
};
