/*
[INPUT]  : Electron app, native bindings
[OUTPUT] : BrowserWindow instance
[POS]    : Main Process -> Window Management
[DECISION]: Isolates window creation, prevents global namespace pollution, abstracts UI presentation layer.
*/

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow(appDir) {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        frame: false, // 无边框模式
        transparent: false, // 禁用透明背景以避免窗口不可见
        backgroundColor: '#1a1a1a', // 深色背景
        icon: path.join(appDir, 'assets/icon.ico'), // 设置任务栏图标
        webPreferences: {
            nodeIntegration: false, // 禁用 Node.js 集成 (安全)
            contextIsolation: true, // 开启上下文隔离 (安全)
            webSecurity: true, // 启用 Web 安全
            preload: path.join(appDir, 'preload.js'), // 确保预加载脚本路径正确
            devTools: true
        }
    });

    mainWindow.loadFile('index.html');

    // 窗口关闭时释放引用
    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    setupWindowIpc();

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

function setupWindowIpc() {
    // 1. 窗口控制
    ipcMain.on('window-min', () => mainWindow?.minimize());
    ipcMain.on('window-max', () => {
        if (!mainWindow) return;
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow?.close());
}

module.exports = {
    createWindow,
    getMainWindow
};
