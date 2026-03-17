/*
[INPUT]  : IPC Renderer events
[OUTPUT] : Secure `window.api` bridge
[POS]    : Preload Script (Bridge between Main and Renderer)
[DECISION]: Uses `contextIsolation: true` for security, exposing only white-listed channels.
*/

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 发送消息到主进程
  send: (channel, data) => {
    // 白名单机制，只允许发送特定的事件
    let validChannels = ['window-min', 'window-max', 'window-close', 'log-message', 'open-log-folder'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // 调用主进程方法并等待结果
  invoke: (channel, data, ...args) => {
    let validChannels = [
      'query-local-fonts',
      'select-folder-dialog',
      'save-file-direct',
      'save-file-dialog',
      'template-list',
      'template-save',
      'template-delete',
      'analyze-exif',
      'find-brand-logos', // Added
      'import-logo-folder', // Added
      'get-logos-path' // Added
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data, ...args);
    }
  },
  // 监听主进程发来的消息 (如果需要)
  on: (channel, func) => {
    let validChannels = ['logo-debug-info']; // Added debug channel
    if (validChannels.includes(channel)) {
      // Strip event as it includes sender
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});