/*
[INPUT]  : CLI args, Environment Variables, IPC Events
[OUTPUT] : Electron Main Process, Window Management, Native Features
[POS]    : Application Entry Point (Main Process)
[DECISION]: Reduced to pure bootstrapper/scheduler. Uses sub-modules in `src/main` for real logic.
*/

const { app, protocol } = require('electron');
const path = require('path');




const { ExifTool } = require("exiftool-vendored");
const exiftool = new ExifTool({ taskTimeoutMillis: 5000 });
const Store = require('electron-store');
const store = new Store();

// 导入主进程服务
const { createWindow, getMainWindow } = require('./src/main/window-manager');
const { rotateLogs, setupLoggerIpc, logMainProcess } = require('./src/main/logger-service');
const { setupSystemServices } = require('./src/main/system-service');
const { setupIpcHandlers } = require('./src/main/ipc-handlers');

app.on('window-all-closed', function () {
  exiftool.end();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (getMainWindow() === null) createWindow(__dirname);
});

// --- Security: Registered Protocols ---
app.whenReady().then(() => {
  // 注册 rz-local 协议 (用于安全加载本地资源)
  protocol.registerFileProtocol('rz-local', (request, callback) => {
    let url = request.url.replace('rz-local://', '');
    try {
      url = decodeURIComponent(url);

      // Fix for Windows: /C:/Path -> C:/Path
      if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(url)) {
        url = url.slice(1);
      }
      // Handle relative paths
      else if (process.platform === 'win32' && !/^[a-zA-Z]:/.test(url)) {
        if (url.startsWith('/') || url.startsWith('\\')) url = url.slice(1);
        url = path.join(__dirname, url);
      }

      const filePath = path.normalize(url);
      return callback({ path: filePath });
    } catch (error) {
      console.error('Protocol Error:', error);
    }
  });

  // 1. 挂载日志机制
  rotateLogs();
  setupLoggerIpc();

  // 2. 创建主窗口
  const mainWindow = createWindow(__dirname);

  // 3. 挂载子进程服务并注入依赖树
  setupSystemServices();
  setupIpcHandlers({ mainWindow, store, exiftool, logMainProcess });
});