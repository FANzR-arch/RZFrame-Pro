/*
[INPUT]  : None
[OUTPUT] : Safe IPC Wrapper
[POS]    : Utility / Bridge Layer
[DECISION]: Encapsulates Electron IPC to support potential web-only fallback (graceful degradation).
*/

// src/utils/ipc.js

export const ipc = {
    send: (channel, data) => {
        if (window.api && window.api.send) {
            window.api.send(channel, data);
        } else {
            console.warn(`IPC send failed: ${channel}`, data);
        }
    },
    invoke: async (channel, data, ...args) => {
        if (window.api && window.api.invoke) {
            return await window.api.invoke(channel, data, ...args);
        } else {
            console.warn(`IPC invoke failed: ${channel}`);
            return null;
        }
    },
    on: (channel, func) => {
        if (window.api && window.api.on) {
            window.api.on(channel, func);
        }
    }
};

export const isElectron = () => {
    return !!window.api;
};
