/*
[INPUT]  : IPC Trigger for fonts
[OUTPUT] : List of system fonts
[POS]    : Main Process -> System Integrations
[DECISION]: Isolates heavy shell executions (PowerShell) from the main logical flow.
*/

const { ipcMain } = require('electron');
const { exec } = require('child_process');

function setupSystemServices() {
    ipcMain.handle('query-local-fonts', async () => {
        return new Promise((resolve) => {
            // Force UTF8 output for non-ASCII chars
            const psCommand = `powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' | Select-Object -Property * -ExcludeProperty PSPath,PSPrentPath,PSChildName,PSDrive,PSProvider | ConvertTo-Json -Depth 1 -Compress"`;

            exec(psCommand, { maxBuffer: 1024 * 1024 * 10, encoding: 'utf8' }, (err, stdout, stderr) => {
                if (err) {
                    console.error("Font PS error:", err);
                    resolve([]);
                    return;
                }

                try {
                    let jsonStr = stdout.trim();
                    if (!jsonStr) { resolve([]); return; }

                    const data = JSON.parse(jsonStr);
                    const fontList = Array.isArray(data) ? data : [data];
                    const validFonts = [];

                    fontList.forEach(item => {
                        Object.keys(item).forEach(key => {
                            if (['PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider'].includes(key)) return;

                            let fontName = key;
                            fontName = fontName.replace(/\s*\(TrueType\)/gi, '')
                                .replace(/\s*\(OpenType\)/gi, '')
                                .replace(/\s*\(All Res\)/gi, '')
                                .trim();

                            if (fontName && fontName.length > 0) {
                                validFonts.push({ family: fontName, file: item[key] });
                            }
                        });
                    });

                    const unique = [...new Set(validFonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
                    resolve(unique.map(f => ({ family: f })));
                } catch (parseErr) {
                    console.error("Font JSON parse error:", parseErr);
                    resolve([]);
                }
            });
        });
    });
}

module.exports = {
    setupSystemServices
};
