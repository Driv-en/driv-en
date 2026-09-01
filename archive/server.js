const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./public/db');
const api = require('./public/api');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
    session({
        secret: 'driv-en-secret',
        resave: false,
        saveUninitialized: false
    })
);

// Inject services into req
app.use((req, res, next) => {
    req.db = db;

    req.services = {
        auth: require('./public/services/auth')(db),

        admin: {
            projects: require('./public/services/admin/projects')(db),
            equipment: require('./public/services/admin/equipment')(db),
            employees: require('./public/services/admin/employees')(db),
            auditLogs: require('./public/services/admin/audit-logs')(db)
        },

        customers: {
            projects: require('./public/services/customers/projects')(db),
            equipment: require('./public/services/customers/equipment')(db),
            pm: require('./public/services/customers/pm')(db),
            inspections: require('./public/services/customers/inspections')(db),
            workOrders: require('./public/services/customers/work-orders')(db),
            employees: require('./public/services/customers/employees')(db)
        }
    };

    next();
});

// Mount API
app.use('/api', api);

// Static files (root directory - for icons and other root assets)
app.use(express.static(path.join(__dirname)));

// Static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`DRIV-EN backend running on port ${PORT}`);
});
