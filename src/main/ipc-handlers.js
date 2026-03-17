/*
[INPUT]  : renderer ipc events with data payload
[OUTPUT] : native node operations (fs, dialog, exiftool)
[POS]    : Main Process -> IPC Handlers
[DECISION]: Groups data-persistence and I/O logic. Limits native capabilities exposed to renderer via predefined channels.
*/

const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, app } = require('electron');

function setupIpcHandlers(deps) {
    const { mainWindow, store, exiftool, logMainProcess } = deps;

    // --- IO Security: Allowed Paths Whitelist ---
    const allowedWritePaths = new Set();

    // 1. 选择文件夹 (用于批量保存 - Type B: 用户导出)
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

    // 2. 直接保存文件 (Type B: 用户导出)
    ipcMain.handle('save-file-direct', async (event, filePath, dataUrl) => {
        try {
            // 校验路径权限
            const targetDir = path.dirname(filePath);
            let isAllowed = false;
            for (const allowedPath of allowedWritePaths) {
                const rel = path.relative(allowedPath, targetDir);
                if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                    isAllowed = true;
                    break;
                }
            }

            if (!isAllowed) {
                throw new Error(`Permission Denied: Writing to ${filePath} is not allowed. Please select the folder first.`);
            }

            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            fs.writeFileSync(filePath, buffer);
            return { success: true };
        } catch (err) {
            logMainProcess("ERROR", `Save direct error: ${err.message}`);
            throw err;
        }
    });

    // 3. 单文件保存对话框 (Type B: 用户导出)
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

    // EXIF Tool Handler
    ipcMain.handle('analyze-exif', async (event, filePath) => {
        try {
            const exists = fs.existsSync(filePath);
            const stat = exists ? fs.statSync(filePath) : null;
            logMainProcess("DEBUG", `Analyze Request: "${filePath}" Exists: ${exists} Size: ${stat ? stat.size : 'N/A'}`);

            if (!exists) {
                throw new Error(`File detection failed: ${filePath}`);
            }

            const tags = await exiftool.read(filePath);

            // Priority: LensID > LensModel > LensType > Lens
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

            const getSafeTags = (t) => ({
                Make: t.Make, Model: t.Model, Lens: t.Lens, LensID: t.LensID,
                LensModel: t.LensModel, LensInfo: t.LensInfo, ISO: t.ISO,
                ISOSpeedRatings: t.ISOSpeedRatings, FNumber: t.FNumber,
                ExposureTime: t.ExposureTime, FocalLength: t.FocalLength,
                DateTimeOriginal: t.DateTimeOriginal, DateTime: t.DateTime,
                CreateDate: t.CreateDate, Software: t.Software, Flash: t.Flash
            });

            if (lensName) {
                return { lensName, tags: getSafeTags(tags) };
            }

            // Regex Search for fallback
            const stringValues = Object.values(tags).filter(v => typeof v === 'string');
            for (const val of stringValues) {
                if (!/mm/i.test(val)) continue;
                const hasAperture = /[Ff]\/|1:|F\d/.test(val);
                const hasRange = /\d+-\d+/.test(val);
                if (hasAperture || hasRange) {
                    if (/^\d+(\.\d+)?\s*mm$/i.test(val)) continue;
                    if (/^\d+x\d+\s*mm$/i.test(val)) continue;
                    return { lensName: val, tags: getSafeTags(tags) };
                }
            }

            return { lensName: null, tags: getSafeTags(tags) };
        } catch (err) {
            logMainProcess("ERROR", `ExifTool Failed: ${filePath} Error: ${err.message}`);
            return { error: err.message };
        }
    });

    // --- Logo Path Handler ---
    function getBuiltinLogoDir() {
        if (app.isPackaged) {
            return path.join(path.dirname(app.getPath('exe')), 'assets', 'logos', 'Svg');
        } else {
            // relative from root
            return path.join(__dirname, '..', '..', 'assets', 'logos', 'Svg');
        }
    }

    function getCustomLogoDir() {
        const dir = path.join(app.getPath('userData'), 'custom_logos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    ipcMain.handle('get-logos-path', () => {
        return getBuiltinLogoDir();
    });

    ipcMain.handle('find-brand-logos', async (event, make) => {
        if (!make) return [];
        const builtinDir = getBuiltinLogoDir();
        const customDir = getCustomLogoDir();
        const results = [];

        const scanDir = (dir, type) => {
            try {
                let normalizedMake = make.trim().toLowerCase();
                normalizedMake = normalizedMake.replace(/corporation/g, '').replace(/co\./g, '').replace(/ltd\.?/g, '').replace(/inc\.?/g, '');
                normalizedMake = normalizedMake.replace(/[^a-z0-9]/g, '');

                if (!fs.existsSync(dir)) return;
                const files = fs.readdirSync(dir);

                files.forEach(file => {
                    if (!file.toLowerCase().endsWith('.svg') && !file.toLowerCase().endsWith('.png')) return;
                    const normalizedFile = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normalizedFile.includes(normalizedMake)) {
                        results.push({ name: file, path: path.join(dir, file), type: type });
                    }
                });
            } catch (e) {
                console.error(`Error scanning logos in ${dir}:`, e);
            }
        };

        scanDir(builtinDir, 'builtin');
        scanDir(customDir, 'custom');

        const sorted = results.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'custom' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        if (sorted.length === 0) {
            return [{ type: 'debug', name: 'Debug Info', path: '', debug: "Not Found" }];
        }
        return sorted;
    });

    ipcMain.handle('import-logo-folder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        if (result.canceled) return { success: false };

        const srcDir = result.filePaths[0];
        const destDir = getCustomLogoDir();
        let count = 0;

        try {
            const files = fs.readdirSync(srcDir);
            files.forEach(file => {
                if (file.toLowerCase().endsWith('.svg') || file.toLowerCase().endsWith('.png')) {
                    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
                    count++;
                }
            });
            return { success: true, count };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('save-custom-logo', async (event, filePath, brandName) => {
        try {
            const destDir = getCustomLogoDir();
            const ext = path.extname(filePath);
            const safeBrand = brandName.trim().replace(/[^a-z0-9]/gi, '_');
            const destName = `Custom_${safeBrand}_${Date.now()}${ext}`;
            fs.copyFileSync(filePath, path.join(destDir, destName));
            return { success: true, path: path.join(destDir, destName) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // --- Template Library Handlers ---
    function getTemplateDir() {
        const defaultPath = path.join(app.getPath('userData'), 'templates');
        return store.get('templatePath', defaultPath);
    }

    try {
        const tplDir = getTemplateDir();
        if (!fs.existsSync(tplDir)) fs.mkdirSync(tplDir, { recursive: true });
    } catch (e) {
        logMainProcess("ERROR", `Failed to init template dir: ${e.message}`);
    }

    ipcMain.handle('get-template-path', () => getTemplateDir());

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
            return { success: false, error: e.message };
        }
    });
}

module.exports = { setupIpcHandlers };
