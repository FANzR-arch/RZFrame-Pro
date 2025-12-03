const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const SystemFonts = require('system-font-families').default;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // 无边框模式
    transparent: true, // 允许透明背景
    backgroundColor: '#00000000', // 初始完全透明
    icon: path.join(__dirname, 'assets/icon.png'), // 设置任务栏图标
    webPreferences: {
      nodeIntegration: false, // 禁用 Node.js 集成 (安全)
      contextIsolation: true, // 开启上下文隔离 (安全)
      webSecurity: false, // 保持关闭以允许加载本地图片 (注意：生产环境建议开启并使用自定义协议)
      preload: path.join(__dirname, 'preload.js'), // 确保预加载脚本路径正确
      devTools: true
    }
  });

  mainWindow.loadFile('index.html');

  // 窗口关闭时释放引用
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// app.whenReady().then(createWindow); // Moved to rotateLogs block

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// --- Log Rotation ---
function rotateLogs() {
  const logDir = path.join(__dirname, 'log');
  if (!fs.existsSync(logDir)) return;

  // 1. Rename current app.log to app-{timestamp}.log
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

  // 2. Keep only last 5 logs
  fs.readdir(logDir, (err, files) => {
    if (err) return;
    const logs = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
    logs.sort(); // Sorts by timestamp (ISO format sorts correctly)

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

app.whenReady().then(() => {
  rotateLogs();
  createWindow();
});

// 1. 窗口控制
ipcMain.on('window-min', () => mainWindow.minimize());
ipcMain.on('window-max', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow.close());

// 日志记录
ipcMain.on('log-message', (event, logData) => {
  const logDir = path.join(__dirname, 'log');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, 'app.log');
  const logEntry = `[${new Date().toISOString()}] [${logData.level}] ${logData.message} ${logData.data ? JSON.stringify(logData.data) : ''}\n`;
  fs.appendFile(logPath, logEntry, (err) => {
    if (err) console.error("Failed to write log:", err);
  });
});

// 2. 获取系统字体
ipcMain.handle('query-local-fonts', async () => {
  try {
    const systemFonts = new SystemFonts();
    const fontList = await systemFonts.getFonts();
    // 返回格式适配前端: [{ family: 'Arial' }, ...]
    return fontList.map(f => ({ family: f }));
  } catch (e) {
    console.error("Font load error:", e);
    return []; // 失败降级返回空数组，使用默认字体
  }
});

// 3. 选择文件夹 (用于批量保存)
ipcMain.handle('select-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return { success: false };
  } else {
    return { success: true, path: result.filePaths[0] };
  }
});

// 4. 直接保存文件 (核心：处理 Base64 并写入磁盘)
ipcMain.handle('save-file-direct', async (event, filePath, dataUrl) => {
  try {
    // 移除 DataURL 前缀 (e.g., "data:image/jpeg;base64,")
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (err) {
    console.error("Save direct error:", err);
    throw err;
  }
});

// 5. 单文件保存对话框
ipcMain.handle('save-file-dialog', async (event, dataUrl, defaultName) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'Images', extensions: ['jpg'] }]
  });

  if (filePath) {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  }
  return { success: false };
});

// --- Template Library Handlers ---
const TPL_DIR = path.join(__dirname, 'templates');
if (!fs.existsSync(TPL_DIR)) fs.mkdirSync(TPL_DIR);

ipcMain.handle('template-list', async () => {
  try {
    const files = fs.readdirSync(TPL_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      try {
        const content = fs.readFileSync(path.join(TPL_DIR, f), 'utf-8');
        return JSON.parse(content);
      } catch (e) { return null; }
    }).filter(t => t !== null);
    return templates;
  } catch (e) {
    console.error("List templates error:", e);
    return [];
  }
});

ipcMain.handle('template-save', async (event, template) => {
  try {
    const filePath = path.join(TPL_DIR, `${template.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
    return { success: true };
  } catch (e) {
    console.error("Save template error:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('template-delete', async (event, id) => {
  try {
    const filePath = path.join(TPL_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (e) {
    console.error("Delete template error:", e);
    return { success: false, error: e.message };
  }
});