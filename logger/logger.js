import fs from 'fs';
import path from 'path';

/**
 * Logs a message to a file based on the log type.
 *
 * @param {string} type - The type of log (error, access, or info).
 * @param {string} source - The source of the log (e.g., the function or module name).
 * @param {string|Error} messageOrError - The message to log, or an error object if the log type is 'error'.
 */
function logMessage(type, source, messageOrError) {
    try {
        const currentTime = new Date().toLocaleString();
        const isError = type === 'error';
        const isInfo = type === 'info'; // Added check for 'info' type
        const formattedMessage = isError
            ? `${currentTime} - Source: ${source}\nError: ${messageOrError?.stack || messageOrError}\n\n`
            : (isInfo
                ? `${currentTime} - Source: ${source}\nInfo: ${messageOrError}\n\n`
                : `${currentTime} - Source: ${source}\nMessage: ${messageOrError}\n\n`);

        // Get the current working directory of the project using process.cwd()
        const logsDir = path.join(process.cwd(), 'logger', 'logs', isError ? 'error' : isInfo ? 'info' : 'access');

        // Ensure the directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Generate the log file name based on the log type and current date
        const logFileName = `${type}_${formatDate(new Date())}.log`;
        const logFilePath = path.join(logsDir, logFileName);

        // Write the log to the file
        fs.appendFile(logFilePath, formattedMessage, (err) => {
            if (err) {
                console.error('Error writing to log file:', err);
            } else {
                console.log(`${currentTime} Log written to ${type} file`);
            }
        });
    } catch (error) {
        console.error('Unexpected logging error:', error);
    }
}

/**
 * Helper function to format dates in the format YYYY-MM-DD.
 *
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Writes data to a JSON file with the current date and time in the filename.
 *
 * @param {Array} data - The data to write to the JSON file.
 */
function writeDataToJsonFile(data) {
    try {
        // Get the current date and time
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        // Generate the filename in dd_mm_yyyy_hh_mm format
        const fileName = `${day}_${month}_${year}_${hours}_${minutes}.json`;

        // Define the path to the backlogs directory
        const backlogsDir = path.join(process.cwd(), 'logger', 'backlogs');

        // Ensure the directory exists
        if (!fs.existsSync(backlogsDir)) {
            fs.mkdirSync(backlogsDir, { recursive: true });
        }

        // Define the full path to the JSON file
        const filePath = path.join(backlogsDir, fileName);

        // Write the data to the JSON file
        fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                console.error('Error writing to JSON file:', err);
            } else {
                console.log(`Data successfully written to ${filePath}`);
            }
        });
    } catch (error) {
        console.error('Unexpected error writing JSON file:', error);
    }
}




export { logMessage, writeDataToJsonFile };
