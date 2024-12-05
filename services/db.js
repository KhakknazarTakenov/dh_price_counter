import path from "path";
import pkg from "sqlite3";
import fs from "fs";

import { logMessage } from "../logger/logger.js";

const { verbose } = pkg;

/**
 * The `Db` class encapsulates SQLite database operations.
 * It provides utility methods to manage database schemas and perform CRUD operations.
 */
class Db {

    /**
     * Constructor for the `Db` class.
     * Initializes the database file path and sets up SQLite in verbose mode.
     * If database.db file is not exist, it will be created automatically
     */
    constructor() {
        this.dbPath = path.join(process.cwd(), 'db', 'database.db');
        this.sqlite3 = verbose();

        try {
            const dbDir = path.dirname(this.dbPath);

            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            if (!fs.existsSync(this.dbPath)) {
                const db = new this.sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        logMessage(LOG_TYPES.E, "Db service constructor", `Failed to create database file: ${err.message}`);
                    } else {
                        logMessage(LOG_TYPES.I, "Db service constructor", "Database file created successfully.");
                    }
                });
                db.close();
            }
        } catch (error) {
            logMessage("error", "Db service constructor", error.message);
        }
    }

    /**
     * Creates the necessary tables in the database if they do not already exist.
     * This method defines the schema required for the application to function.
     * It runs SQL `CREATE TABLE` statements to ensure the database has the required tables.
     *
     * By default, creates:
     * * deals (id, title, assigned_id, date_create, category_id)
     * * products (id, offer_id, name, section_id, price)
     * * contacts (id, name, last_name, second_name)
     *
     * How it works:
     * - Opens a connection to the database.
     * - Executes SQL queries using the `serialize()` method for sequential execution.
     * - Ensures tables are only created if they don't already exist (using `IF NOT EXISTS`).
     * - Closes the database connection after the operation.
     *
     * Example:
     * If a table for users is required, you can include the following SQL:
     *   CREATE TABLE IF NOT EXISTS users (
     *       id INTEGER PRIMARY KEY AUTOINCREMENT,
     *       name TEXT NOT NULL,
     *       age INTEGER,
     *       email TEXT UNIQUE
     *   );
     */
    createTables() {
        let db;
        try {
            db = new this.sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logMessage(LOG_TYPES.E, 'Db service createTables', `Error opening database: ${err}`);
                }
            });

            db.serialize(() => {
               db.run(
                   `CREATE TABLE IF NOT EXISTS deals (
                        id INTEGER NOT NULL PRIMARY KEY,
                        title TEXT,
                        category_id INTEGER,
                        price_type INTEGER,
                        date_create DATE
                   );`
               );
                db.run(
                    `
                        CREATE TABLE IF NOT EXISTS deals_products (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            deal_id INTEGER,
                            product_id INTEGER,
                            product_name TEXT,
                            price FLOAT,
                            discount FLOAT,
                            FOREIGN KEY (deal_id) REFERENCES deals(id),
                            UNIQUE (deal_id, product_id)
                        );
                    `
                )
            });

            logMessage(LOG_TYPES.I, 'Db service createTables', 'Tables created successfully');
        } catch (error) {
            logMessage(LOG_TYPES.E, 'Db service createTables', error);
        } finally {
            db.close();
        }
    }

    /**
     * Inserts an array of objects into a table.
     *
     * @param {string} tableName - The name of the table to insert data into.
     * @param {Array<Object>} records - An array of objects containing field-value pairs to insert.
     *                                   Example: [{ "user_name": "Tommy" }, { "user_name": "Anna" }]
     * @throws {Error} If the table name or records are invalid.
     * @returns {void}
     */
    insertMultipleInTable(tableName, records) {
        let db;
        try {
            // Validate inputs
            if (!tableName || typeof tableName !== "string") {
                throw new Error("Invalid table name provided.");
            }
            if (!Array.isArray(records) || records.length === 0 || typeof records[0] !== "object") {
                throw new Error("Invalid records provided. Expected an array of objects with field-value pairs.");
            }

            // Open database connection
            db = new this.sqlite3.Database(this.dbPath);

            // Generate dynamic SQL query and placeholders for the first record
            const fields = Object.keys(records[0]);
            const placeholders = fields.map(() => "?").join(", ");
            const query = `INSERT OR REPLACE INTO ${tableName} (${fields.join(", ")}) VALUES (${placeholders})`;

            // Begin a transaction
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                // Prepare the statement once
                const stmt = db.prepare(query);

                // Iterate over each record and bind values
                for (const record of records) {
                    const values = fields.map((field) => record[field] || null); // Handle missing fields gracefully
                    stmt.run(values, function (err) {
                        if (err) {
                            logMessage(LOG_TYPES.E, "Db service insertMultipleInTable", `Error inserting row: ${err.message}`);
                        }
                    });
                }

                // Finalize the statement and commit the transaction
                stmt.finalize();
                db.run("COMMIT");
            });
        } catch (error) {
            logMessage(LOG_TYPES.E, "Db service insertMultipleInTable", error);
        } finally {
            if (db) {
                db.close((err) => {
                    if (err) {
                        logMessage(LOG_TYPES.E, "Db service insertMultipleInTable", `Error closing database: ${err.message}`);
                    }
                });
            }
        }
    }


    /**
     * Inserts data into a table.
     *
     * @param {string} tableName - The name of the table to insert data into.
     * @param {Object} insertFields - An object containing field-value pairs to insert. Example: "user_name": "Tommy"
     * @throws {Error} If the table name or insert fields are invalid.
     * @returns {void}
     */
    insertInTable(tableName, insertFields) {
        let db;
        try {
            // Validate inputs
            if (!tableName || typeof tableName !== "string") {
                throw new Error("Invalid table name provided.");
            }
            if (!insertFields || typeof insertFields !== "object" || Array.isArray(insertFields)) {
                throw new Error("Invalid insertFields provided. Expected an object with field-value pairs.");
            }

            // Open database connection
            db = new this.sqlite3.Database(this.dbPath);

            // Generate dynamic SQL query and placeholders
            const fields = Object.keys(insertFields);
            const placeholders = fields.map(() => "?").join(", ");
            const values = Object.values(insertFields);

            const query = `INSERT OR REPLACE INTO ${tableName} (${fields.join(", ")}) VALUES (${placeholders})`;

            // Execute query
            db.run(query, values, function (err) {
                if (err) {
                    logMessage(LOG_TYPES.E, "Db service insertInTable", `Error inserting into ${tableName}: ${err.message}`);
                } else {
                    logMessage(
                        LOG_TYPES.I,
                        "Db service insertInTable",
                        `Successfully inserted data into ${tableName}. Row ID: ${this.lastID}`
                    );
                }
            });
        } catch (error) {
            logMessage(LOG_TYPES.E, "Db service insertInTable", error);
        } finally {
            if (db) {
                db.close((err) => {
                    if (err) {
                        logMessage(LOG_TYPES.E, "Db service insertInTable", `Error closing database: ${err.message}`);
                    }
                });
            }
        }
    }

    /**
     * Updates records in a table.
     *
     * @param {string} tableName - The name of the table to update.
     * @param {Object} updateFields - An object containing field-value pairs to update. Example: "user_name": "new name"
     * @param {Object} filter - An object containing filter conditions.
     * @throws {Error} If parameters are invalid.
     * @returns {void}
     */
    updateTable(tableName, updateFields, filter) {
        let db;
        try {
            if (!tableName || typeof tableName !== "string" || !updateFields || typeof updateFields !== "object" || !filter) {
                throw new Error("Invalid parameters for update.");
            }

            db = new this.sqlite3.Database(this.dbPath);

            const updates = Object.keys(updateFields).map(field => `${field} = ?`).join(", ");
            const values = [...Object.values(updateFields), ...Object.values(filter)];
            const filterCondition = Object.keys(filter).map(field => `${field} = ?`).join(" AND ");
            const query = `UPDATE ${tableName} SET ${updates} WHERE ${filterCondition}`;

            db.run(query, values, function (err) {
                if (err) {
                    logMessage(LOG_TYPES.E, "Db service updateTable", `Error updating ${tableName}: ${err.message}`);
                } else {
                    logMessage(LOG_TYPES.I, "Db service updateTable", `Updated ${this.changes} row(s) in ${tableName}.`);
                }
            });
        } catch (error) {
            logMessage(LOG_TYPES.E, "Db service updateTable", error.message);
        } finally {
            if (db) db.close();
        }
    }

    /**
     * Deletes records from a table based on filter conditions.
     *
     * @param {string} tableName - The name of the table to delete records from.
     * @param {Object} filter - An object containing filter conditions.
     * @throws {Error} If parameters are invalid.
     * @returns {void}
     */
    deleteFromTable(tableName, filter) {
        let db;
        try {
            if (!tableName || typeof tableName !== "string" || !filter) {
                throw new Error("Invalid parameters for delete.");
            }

            db = new this.sqlite3.Database(this.dbPath);

            const filterCondition = Object.keys(filter).map(field => `${field} = ?`).join(" AND ");
            const values = Object.values(filter);
            const query = `DELETE FROM ${tableName} WHERE ${filterCondition}`;

            db.run(query, values, function (err) {
                if (err) {
                    logMessage(LOG_TYPES.E, "Db service deleteFromTable", `Error deleting from ${tableName}: ${err.message}`);
                } else {
                    logMessage(LOG_TYPES.I, "Db service deleteFromTable", `Deleted ${this.changes} row(s) from ${tableName}.`);
                }
            });
        } catch (error) {
            logMessage(LOG_TYPES.E, "Db service deleteFromTable", error.message);
        } finally {
            if (db) db.close();
        }
    }

    /**
     * Retrieves all records from a table.
     *
     * @param {string} tableName - The name of the table to retrieve records from.
     * @throws {Error} If the table name is invalid.
     * @returns {Promise<Array>} A promise that resolves with the retrieved rows.
     */
    async getAll(tableName) {
        if (!tableName || typeof tableName !== "string") {
            throw new Error("Invalid parameters for getAll.");
        }

        return new Promise((resolve, reject) => {
            const db = new this.sqlite3.Database(this.dbPath);
            const query = `SELECT * FROM ${tableName}`;

            db.all(query, [], (err, rows) => {
                if (err) {
                    logMessage(LOG_TYPES.E, "Db service getAll", `Error fetching from ${tableName}: ${err.message}`);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });

            db.close();
        });
    }

    /**
     * Retrieves records from a table based on filter conditions.
     *
     * @param {string} tableName - The name of the table to retrieve records from.
     * @param {Object} filter - An object containing filter conditions as key-value pairs. Example: { "id": 1, "name": Tommy }
     * @throws {Error} If the table name or filter is invalid.
     * @returns {Promise<Array>} A promise that resolves with the retrieved rows.
     */
    async getByFilter(tableName, filter) {
        if (!tableName || typeof tableName !== "string" || !filter || typeof filter !== "object") {
            throw new Error("Invalid parameters for getByFilter.");
        }

        return new Promise((resolve, reject) => {
            const db = new this.sqlite3.Database(this.dbPath);

            const filterCondition = Object.keys(filter)
                .map(field => `${field} = ?`)
                .join(" AND ");
            const values = Object.values(filter);
            const query = `SELECT * FROM ${tableName} WHERE ${filterCondition}`;

            db.all(query, values, (err, rows) => {
                if (err) {
                    logMessage(LOG_TYPES.E, "Db service getByFilter", `Error fetching from ${tableName}: ${err.message}`);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });

            db.close();
        });
    }


}

export { Db };