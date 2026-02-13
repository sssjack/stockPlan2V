
const mysql = require('mysql2/promise');

const dbConfig = {
    host: '8.141.121.133',
    user: 'root',
    password: 'chenkexin',
    port: 3306,
    database: 'wealthwise'
};

async function updateDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);

        try {
            await connection.execute("ALTER TABLE users ADD COLUMN nickname VARCHAR(50) DEFAULT '用户'");
            console.log("Added nickname column");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.log(e.message);
        }

        try {
            await connection.execute("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT ''");
            console.log("Added avatar column");
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.log(e.message);
        }

        await connection.end();
        console.log("Database update complete");
    } catch (err) {
        console.error("DB Connection Error:", err);
    }
}

updateDB();
