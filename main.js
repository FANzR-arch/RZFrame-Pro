/*
[INPUT]  : CLI args, Environment Variables, IPC Events
[OUTPUT] : Electron Main Process, Window Management, Native Features
[POS]    : Application Entry Point (Main Process)
[DECISION]: Uses `electron-store` for persistence, handles log rotation, and enforces security via white-listed IPC.
*/

const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
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
    icon: path.join(__dirname, 'assets/icon.ico'), // 设置任务栏图标
    webPreferences: {
      nodeIntegration: false, // 禁用 Node.js 集成 (安全)
      contextIsolation: true, // 开启上下文隔离 (安全)
      webSecurity: true, // 启用 Web 安全
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
      // Handle relative paths (e.g., /assets/logos/...) - treat as relative to app root
      else if (process.platform === 'win32' && !/^[a-zA-Z]:/.test(url)) {
        if (url.startsWith('/') || url.startsWith('\\')) url = url.slice(1);
        url = path.join(__dirname, url);
      }

      // Decode and normalize path
      const filePath = path.normalize(url);
      return callback({ path: filePath });
    } catch (error) {
      console.error('Protocol Error:', error);
    }
  });

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
// 2. 获取系统字体 (Robust PowerShell Fallback - UTF8 JSON Fixed)
ipcMain.handle('query-local-fonts', async () => {
  return new Promise((resolve) => {
    const { exec } = require('child_process');

    // Command explanation:
    // 1. [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; -> Force UTF8 output for non-ASCII chars (Chinese/Japanese)
    // 2. Get-ItemProperty ... | Select-Object -> Get font registry entries
    // 3. ConvertTo-Json -> Output as JSON string
    const psCommand = `powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' | Select-Object -Property * -ExcludeProperty PSPath,PSPrentPath,PSChildName,PSDrive,PSProvider | ConvertTo-Json -Depth 1 -Compress"`;

    exec(psCommand, { maxBuffer: 1024 * 1024 * 10, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        console.error("Font PS error:", err);
        resolve([]);
        return;
      }

      try {
        // PowerShell might wrap JSON in standard array if multiple, or object if single.
        // It might also output some noise? Usually ConvertTo-Json is clean.
        let jsonStr = stdout.trim();
        if (!jsonStr) { resolve([]); return; }

        const data = JSON.parse(jsonStr);
        // Normalize to array
        const fontList = Array.isArray(data) ? data : [data];

        const validFonts = [];

        fontList.forEach(item => {
          // Registry keys in 'Fonts' are: "Font Name (TrueType)" : "Filename.ttf"
          // The JSON object keys are dynamic (the font names themselves are properties?? No.)
          // Wait, Get-ItemProperty on the folder returns ONE object with MANY properties (each property is a font).
          // SO 'data' is usually a single object where keys are font names.

          Object.keys(item).forEach(key => {
            // Filter out system properties if any remained (Select-Object * -Exclude... handles most)
            // Filter out standard PS properties just in case
            if (['PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider'].includes(key)) return;

            // Key is the font name (e.g. "Microsoft YaHei & Microsoft YaHei UI (TrueType)")
            // Value is the filename (e.g. "msyh.ttc")

            let fontName = key;
            // Cleanup: remove (TrueType), (OpenType), (All Res)
            fontName = fontName.replace(/\s*\(TrueType\)/gi, '')
              .replace(/\s*\(OpenType\)/gi, '')
              .replace(/\s*\(All Res\)/gi, '')
              .trim();

            if (fontName && fontName.length > 0) {
              validFonts.push({ family: fontName, file: item[key] });
            }
          });
        });

        // Deduplicate
        const unique = [...new Set(validFonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'zh-CN'));

        resolve(unique.map(f => ({ family: f })));
      } catch (parseErr) {
        console.error("Font JSON parse error:", parseErr);
        // Fallback: Empty list is better than crash
        resolve([]);
      }
    });
  });
});

// --- IO Security: Allowed Paths Whitelist ---
const allowedWritePaths = new Set();

// 3. 选择文件夹 (用于批量保存 - Type B: 用户导出)
// 策略：每次操作时由用户明确指定保存位置，并将该路径加入白名单
ipcMain.handle('select-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return { success: false };
  } else {
    const selectedPath = result.filePaths[0];
    allowedWritePaths.add(selectedPath); // Join whitelist
    return { success: true, path: selectedPath };
  }
});

// 4. 直接保存文件 (Type B: 用户导出)
// 安全增强：仅允许写入白名单目录及其子目录
ipcMain.handle('save-file-direct', async (event, filePath, dataUrl) => {
  try {
    // 校验路径权限
    const targetDir = path.dirname(filePath);
    let isAllowed = false;
    for (const allowedPath of allowedWritePaths) {
      const rel = path.relative(allowedPath, targetDir);
      // 如果 rel 为空(同一目录)或不以 '..' 开头(子目录)且不包含绝对路径，则允许
      // path.relative 返回空字符串表示相同路径？不，是 ''。
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      throw new Error(`Permission Denied: Writing to ${filePath} is not allowed. Please select the folder first.`);
    }

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
  // DEBUG: Inspect path
  const logDir = getLogDir();
  const logPath = path.join(logDir, 'app.log');

  try {
    const exists = fs.existsSync(filePath);
    const stat = exists ? fs.statSync(filePath) : null;
    const debugMsg = `[${new Date().toISOString()}] [DEBUG] Analyze Request: "${filePath}" Exists: ${exists} Size: ${stat ? stat.size : 'N/A'}\n`;
    fs.appendFile(logPath, debugMsg, () => { });

    if (!exists) {
      throw new Error(`File detection failed: ${filePath}`);
    }

    const tags = await exiftool.read(filePath);

    // DEBUG: Log Tags
    const debugTags = {
      Make: tags.Make,
      Model: tags.Model,
      Lens: tags.Lens,
      LensID: tags.LensID,
      LensModel: tags.LensModel,
      LensInfo: tags.LensInfo,
      KeyCount: Object.keys(tags).length
    };
    const succMsg = `[${new Date().toISOString()}] [DEBUG] ExifTool Success. Keys: ${Object.keys(tags).join(',')} Data: ${JSON.stringify(debugTags)}\n`;
    fs.appendFile(logPath, succMsg, () => { });

    // 1. Priority: LensID > LensModel > LensType > Lens
    let lensName = null;



    if (tags.LensID && tags.LensID !== '----' && tags.LensID.length > 5) {
      lensName = tags.LensID;
    } else if (tags.LensModel && tags.LensModel !== '----' && tags.LensModel.length > 5) {
      lensName = tags.LensModel;
    } else if (tags.LensType && tags.LensType !== '----' && tags.LensType.length > 5) {
      lensName = tags.LensType;
    } else if (tags.Lens && tags.Lens !== '----' && tags.Lens.length > 5) {
      lensName = tags.Lens;
    }



    // Helper to extract safe tags
    const getSafeTags = (t) => ({
      Make: t.Make,
      Model: t.Model,
      Lens: t.Lens,
      LensID: t.LensID,
      LensModel: t.LensModel,
      LensInfo: t.LensInfo,
      ISO: t.ISO,
      ISOSpeedRatings: t.ISOSpeedRatings,
      FNumber: t.FNumber,
      ExposureTime: t.ExposureTime,
      FocalLength: t.FocalLength,
      DateTimeOriginal: t.DateTimeOriginal,
      DateTime: t.DateTime,
      CreateDate: t.CreateDate,
      Software: t.Software,
      Flash: t.Flash
    });

    if (lensName) {
      return { lensName, tags: getSafeTags(tags) };
    }

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
        if (/^\d+(\.\d+)?\s*mm$/i.test(val)) continue;
        if (/^\d+x\d+\s*mm$/i.test(val)) continue;

        return { lensName: val, tags: getSafeTags(tags) };
      }
    }

    return { lensName: null, tags: getSafeTags(tags) };
  } catch (err) {
    console.error('Exiftool error:', err);

    // Log ERROR to file
    const logMsg = `[${new Date().toISOString()}] [ERROR] ExifTool Failed: ${filePath} Error: ${err.message}\n`;
    fs.appendFile(path.join(getLogDir(), 'app.log'), logMsg, () => { });

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