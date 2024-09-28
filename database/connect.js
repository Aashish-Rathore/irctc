// connect.js
import mysql from 'mysql2/promise';

const connect = async () => {
    console.log("Database connection is being established...");
    try {
        const connection = await mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "Rathore1309",
            database: "irctc",
        });

        console.log("Connected to the MySQL database.");
        return connection;
    } catch (err) {
        console.error("Error connecting to the database:", err.message);
        throw err; // Throwing the error to handle it in the main server file if necessary
    }
};

export default connect;
