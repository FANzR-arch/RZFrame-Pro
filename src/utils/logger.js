/*
[INPUT]  : Runtime Events, Errors, User Actions
[OUTPUT] : Console output, Persistent Log File
[POS]    : Utility / Infrastructure
[DECISION]: Implements dual-transport logging (Console + File) to support both development debugging and production troubleshooting.
*/

// src/utils/logger.js
import { ipc, isElectron } from './ipc.js';

const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    ACTION: 'ACTION'
};

export const logger = {
    info: (message, data) => log(LOG_LEVELS.INFO, message, data),
    warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
    error: (message, error) => {
        const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error;
        log(LOG_LEVELS.ERROR, message, errorData);
    },
    action: (actionName, details) => log(LOG_LEVELS.ACTION, actionName, details)
};

function log(level, message, data) {
    const logEntry = {
        level,
        message,
        data,
        timestamp: new Date().toISOString()
    };

    // Console output
    const consoleMsg = `[${level}] ${message}`;
    if (level === LOG_LEVELS.ERROR) console.error(consoleMsg, data);
    else if (level === LOG_LEVELS.WARN) console.warn(consoleMsg, data);
    else console.log(consoleMsg, data || '');

    // Send to main process for file storage
    if (isElectron()) {
        ipc.send('log-message', logEntry);
    }
}

export function initLogger() {
    // 1. Global Error Handler
    window.addEventListener('error', (event) => {
        logger.error("Global Script Error", {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    // 2. Unhandled Promise Rejection
    window.addEventListener('unhandledrejection', (event) => {
        logger.error("Unhandled Promise Rejection", {
            reason: event.reason
        });
    });

    // 3. User Action Tracker (Clicks)
    document.addEventListener('click', (event) => {
        const target = event.target.closest('button, input, select, .clickable');
        if (target) {
            let elementId = target.id || target.className || target.tagName;
            let elementText = target.innerText || target.value || '';
            // Truncate long text
            if (elementText.length > 20) elementText = elementText.substring(0, 20) + '...';

            logger.action("User Click", {
                element: elementId,
                text: elementText
            });
        }
    }, true); // Capture phase

    logger.info("Logger Initialized");
}
