const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { ExifTool } = require("exiftool-vendored");
const exiftool = new ExifTool({ taskTimeoutMillis: 5000 });
const Store = require('electron-store');

// 初始化 Store (用于存储用户偏好，如模板路径)
const store = new Store();

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
  exiftool.end();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// --- Log Rotation (Type A: 系统日志 - 自动保存到 userData) ---
// 策略：用户无需感知，自动维护，用于故障排查
function getLogDir() {
  // 优先使用 Portable 目录，或 exe 同级目录 (生产环境)
  // 如果是开发环境，使用项目根目录 logs
  let base = '';
  if (app.isPackaged) {
    base = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  } else {
    base = __dirname;
  }
  return path.join(base, 'logs'); // Save to 'logs' subfolder in root
}

function rotateLogs() {
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    console.error("Failed to create log dir at root, falling back to userData:", e);
    // Fallback? User insisted on root. Just return for now.
    return;
  }

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
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
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


// 2. 获取系统字体
// 2. 获取系统字体 (Robust PowerShell Fallback)
ipcMain.handle('query-local-fonts', async () => {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      // Use PowerShell to list fonts from registry which is cleaner, or just list file names.
      // Listing registry is better to get actual family names.
      const cmd = `powershell -Command "Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' | Select-Object -Property *"`;

      exec(cmd, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        if (error) {
          console.error("Font PS error:", error);
          resolve([]);
          return;
        }

        const fonts = [];
        const lines = stdout.split('\n');
        // Parse the registry output. Keys are font names, values are filenames.
        // We just want keys that look like font names.
        // PowerShell output format for Select-Object * is header/value pairs or list.
        // Better command for simple parsing:

        // Simpler approach: Just return specific common fonts to verify it works, 
        // OR better: scan the Fonts folder for names (less accurate family names).

        // BEST APPROACH: "Get-ChildItem C:\Windows\Fonts" and parse file names is easiest but ugly.
        // Registry approach with JSON output is best.
      });

      // Synchronous valid alternative for stability:
      // Just hardcode common Windows, Mac, Linux system fonts? No, user wants THEIR fonts.

      // Retry with JSON output for reliability
      const psCommand = `powershell -Command "Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' | ConvertTo-Json"`;
      exec(psCommand, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
        if (err) { resolve([]); return; }
        try {
          const data = JSON.parse(stdout);
          const fontNames = Object.keys(data).filter(k => k !== 'PSPath' && k !== 'PSPrentPath' && k !== 'PSChildName' && k !== 'PSDrive' && k !== 'PSProvider');
          // Clean up names (remove " (TrueType)")
          const cleanFonts = fontNames.map(f => f.replace(/ \(TrueType\)/g, '').replace(/ \(OpenType\)/g, '').replace(/ \(All Res\)/g, ''));
          // Deduplicate and sort
          const unique = [...new Set(cleanFonts)].sort();
          resolve(unique.map(f => ({ family: f })));
        } catch (parseErr) {
          resolve([]);
        }
      });
    });
  } catch (e) {
    console.error("Font load error:", e);
    return [];
  }
});

// 3. 选择文件夹 (用于批量保存 - Type B: 用户导出)
// 策略：每次操作时由用户明确指定保存位置
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

// 4. 直接保存文件 (Type B: 用户导出)
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

// 5. 单文件保存对话框 (Type B: 用户导出)
// 策略：使用 dialog.showSaveDialog 让用户选择路径
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

ipcMain.handle('analyze-exif', async (event, filePath) => {
  try {
    const tags = await exiftool.read(filePath);

    // 1. Priority: LensID > LensModel
    // Check if they exist and are valid strings (not just "----")
    let lensName = null;
    if (tags.LensID && tags.LensID !== '----' && tags.LensID.length > 5) {
      lensName = tags.LensID;
    } else if (tags.LensModel && tags.LensModel !== '----' && tags.LensModel.length > 5) {
      lensName = tags.LensModel;
    } else if (tags.LensType && tags.LensType !== '----' && tags.LensType.length > 5) {
      lensName = tags.LensType;
    }

    if (lensName) return { lensName, tags };

    // 2. Heuristic Regex Search
    const stringValues = Object.values(tags).filter(v => typeof v === 'string');
    for (const val of stringValues) {
      // Must contain "mm" (case insensitive)
      if (!/mm/i.test(val)) continue;

      // Must contain aperture (F, f/, 1:) OR range (-)
      const hasAperture = /[Ff]\/|1:|F\d/.test(val);
      const hasRange = /\d+-\d+/.test(val); // e.g., 18-105

      if (hasAperture || hasRange) {
        // Exclusion checks:
        // Exclude pure sensor size or simple focal length (e.g. "35 mm", "4.5 mm", "36x24 mm")
        if (/^\d+(\.\d+)?\s*mm$/i.test(val)) continue;
        if (/^\d+x\d+\s*mm$/i.test(val)) continue;

        return { lensName: val, tags };
      }
    }

    return { lensName: null, tags };
  } catch (err) {
    console.error('Exiftool error:', err);
    return { error: err.message };
  }
});

// --- Logo Path Handler ---
ipcMain.handle('get-logos-path', () => {
  if (app.isPackaged) {
    // 生产环境：exe 同级目录下的 assets/logos
    return path.join(path.dirname(app.getPath('exe')), 'assets', 'logos');
  } else {
    // 开发环境：项目根目录下的 assets/logos
    return path.join(__dirname, 'assets', 'logos');
  }
});

// --- Template Library Handlers (Type C: 模板库 - 可配置路径) ---
// 策略：默认存储在 userData，但允许用户修改存储位置 (通过 electron-store 记录)

function getTemplateDir() {
  // 优先从 store 获取用户自定义路径，如果没有则使用默认路径
  const defaultPath = path.join(app.getPath('userData'), 'templates');
  return store.get('templatePath', defaultPath);
}

// 初始化模板目录
try {
  const tplDir = getTemplateDir();
  if (!fs.existsSync(tplDir)) fs.mkdirSync(tplDir, { recursive: true });
} catch (e) {
  console.error("Failed to init template dir:", e);
  // 不弹窗阻断，仅记录错误，后续操作会再次尝试或报错
}

// IPC: 获取当前模板路径
ipcMain.handle('get-template-path', () => {
  return getTemplateDir();
});

// IPC: 设置模板路径 (允许用户自定义)
ipcMain.handle('set-template-path', async (event, newPath) => {
  try {
    if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });
    store.set('templatePath', newPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('template-list', async () => {
  try {
    const tplDir = getTemplateDir();
    if (!fs.existsSync(tplDir)) fs.mkdirSync(tplDir, { recursive: true });

    const files = fs.readdirSync(tplDir).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      try {
        const content = fs.readFileSync(path.join(tplDir, f), 'utf-8');
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
    const tplDir = getTemplateDir();
    if (!fs.existsSync(tplDir)) fs.mkdirSync(tplDir, { recursive: true });

    const filePath = path.join(tplDir, `${template.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
    return { success: true };
  } catch (e) {
    console.error("Save template error:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('template-delete', async (event, id) => {
  try {
    const tplDir = getTemplateDir();
    const filePath = path.join(tplDir, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (e) {
    console.error("Delete template error:", e);
    return { success: false, error: e.message };
  }
});