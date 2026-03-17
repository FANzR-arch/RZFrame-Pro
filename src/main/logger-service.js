/*
[INPUT]  : main.js events, backend logs
[OUTPUT] : log file written to disk
[POS]    : Main Process -> Logging Service
[DECISION]: Centralizes system level logging and log rotation rules for easier maintenance.
*/

const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

function getLogDir() {
    let base = '';
    if (app.isPackaged) {
        base = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
    } else {
        base = path.join(__dirname, '..', '..'); // Up from src/main to root
    }
    return path.join(base, 'logs');
}

function rotateLogs() {
    const logDir = getLogDir();
    try {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
        console.error("Failed to create log dir at root:", e);
        return;
    }

    const currentLog = path.join(logDir, 'app.log');
    if (fs.existsSync(currentLog)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newName = path.join(logDir, `app-${timestamp}.log`);
        try {
            fs.renameSync(currentLog, newName);
        } catch (e) {
            console.error("Failed to rotate log:", e);
        }
    }

    fs.readdir(logDir, (err, files) => {
        if (err) return;
        const logs = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
        logs.sort();

        if (logs.length > 5) {
            const toDelete = logs.slice(0, logs.length - 5);
            toDelete.forEach(f => {
                fs.unlink(path.join(logDir, f), err => {
                    if (err) console.error("Failed to delete old log:", f);
                });
            });
        }
    });
}

function setupLoggerIpc() {
    ipcMain.on('log-message', (event, logData) => {
        const logDir = getLogDir();
        try {
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        } catch (e) {
            console.error("Failed to create log dir:", e);
            return;
        }
        const logPath = path.join(logDir, 'app.log');
        const logEntry = `[${new Date().toISOString()}] [${logData.level}] ${logData.message} ${logData.data ? JSON.stringify(logData.data) : ''}\n`;
        fs.appendFile(logPath, logEntry, (err) => {
            if (err) console.error("Failed to write log:", err);
        });
    });
}

// Global static helper for main process errors
function logMainProcess(level, msg) {
    const logDir = getLogDir();
    try {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, 'app.log');
        const logEntry = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
        fs.appendFile(logPath, logEntry, () => { });
    } catch (e) { }
}

module.exports = {
    getLogDir,
    rotateLogs,
    setupLoggerIpc,
    logMainProcess
};
