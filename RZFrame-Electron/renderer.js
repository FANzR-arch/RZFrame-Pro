// renderer.js
import { state, resetState, updateState, defaultConfig } from './src/core/state.js';
import { initCanvas, render, getCanvas } from './src/core/canvas.js';
import { setupCanvasListeners, handleWindowControl } from './src/ui/events.js';
import { ipc, isElectron } from './src/utils/ipc.js';
import { initLogger } from './src/utils/logger.js';

// === EXPORT GLOBALS FOR HTML ACCESS ===
Object.assign(window, {
    toggleTheme: () => toggleTheme(),
    resetAll: () => resetAll(),
    setLanguage: (l) => setLanguage(l),
    handleWindowControl: (a) => handleWindowControl(a),
    setTemplate: (t) => setTemplate(t),
    setAspectRatio: (r) => setAspectRatio(r),
    toggleRatioOrientation: () => toggleRatioOrientation(),
    updateImageScale: (v) => updateImageScale(v),
    updateConfig: (k, v) => updateConfig(k, v),
    loadSystemFonts: () => loadSystemFonts(),
    setFont: (v) => setFont(v),
    setCustomFont: (v) => setCustomFont(v),
    toggleBrandMode: (m) => toggleBrandMode(m),
    updateLogoScale: (v) => updateLogoScale(v),
    toggleLogoInvert: () => toggleLogoInvert(),
    resetLogoUI: () => resetLogoUI(),
    clearFilmstrip: () => clearFilmstrip(),
    saveCurrentTemplate: () => saveCurrentTemplate(),
    downloadImage: () => downloadImage(),
    batchSave: () => batchSave(),
    applySettingsToAll: () => applySettingsToAll(),
    exportTemplate: (id, e) => exportTemplate(id, e),
    deleteTemplate: (id, e) => deleteTemplate(id, e),
    importTemplates: (i) => importTemplates(i),
    handleFileSelect: (e) => handleFileSelect(e),
    handleLogoUpload: (e) => handleLogoUpload(e)
});

// --- Translations ---
const translations = {
    cn: { loading: "正在解析...", subtitle: "By F.Z.R", templateStyle: "模版风格", tplGallery: "画廊", tplCinema: "电影", tplFloat: "悬浮", styleParam: "样式参数", fontScale: "字体大小", borderScale: "边框尺寸", radius: "悬浮圆角", frameBg: "边框背景", textColor: "文字颜色", auto: "自动", cameraLogo: "相机 LOGO", invert: "反色", scale: "缩放", typography: "字体设置", fontDefault: "默认 (Inter)", fontSerif: "衬线体 (Song)", fontMono: "等宽体 (Mono)", fontCustom: "自定义系统字体...", paramEdit: "参数设定", labelMake: "品牌", labelModel: "型号", labelLens: "镜头", labelFocal: "焦距", labelAperture: "光圈", labelShutter: "快门", labelISO: "ISO", labelDate: "日期", exportSettings: "导出", saveImage: "保存", clickToUpload: "点击或拖拽导入照片", supportedFormats: "支持 JPG / PNG / WebP / HEIC", filmstrip: "图库", add: "添加", clear: "清空", noPhotos: "暂无照片", exifInspector: "EXIF 信息", metaFile: "文件", metaSize: "大小", metaDim: "分辨率", metaMake: "厂商", metaModel: "型号", metaLens: "镜头", metaSoftware: "软件", tplLibrary: "模版库", noSavedTpl: "暂无保存的预设", tplPlaceholder: "预设名称...", filePlaceholder: "文件名 (默认自动)", btnText: "文字", btnLogo: "图片", canvasRatio: "画布比例", ratioOriginal: "原图 + 边框", imgZoom: "图片缩放", dragTip: "提示: 拖拽画面可平移照片", bgBrightness: "背景亮度", metaTip: "如未显示内容，请检查是否存在照片信息", applyAll: "应用到所有", importingPrefix: "正在导入 ", importingSuffix: " 张图片", batch: "批量保存", saveSuccess: "图片保存成功！", btnSaved: "已保存" },
    en: { loading: "Parsing...", subtitle: "By F.Z.R", templateStyle: "STYLE", tplGallery: "Gallery", tplCinema: "Cinema", tplFloat: "Float", styleParam: "PARAMETERS", fontScale: "Font Size", borderScale: "Border", radius: "Radius", frameBg: "Frame Color", textColor: "Text Color", auto: "Auto", cameraLogo: "LOGO", invert: "Invert", scale: "Scale", typography: "TYPOGRAPHY", fontDefault: "Default", fontSerif: "Serif", fontMono: "Mono", fontCustom: "Custom...", paramEdit: "METADATA", labelMake: "Make", labelModel: "Model", labelLens: "Lens", labelFocal: "Focal", labelAperture: "Aperture", labelShutter: "Time", labelISO: "ISO", labelDate: "Date", exportSettings: "EXPORT", saveImage: "SAVE", clickToUpload: "DROP IMAGE HERE", supportedFormats: "JPG/PNG", filmstrip: "GALLERY", add: "Add", clear: "Clear", noPhotos: "No photos", exifInspector: "EXIF DATA", metaFile: "FILE", metaSize: "SIZE", metaDim: "DIM", metaMake: "MAKE", metaModel: "MODEL", metaLens: "LENS", metaSoftware: "SOFTWARE", tplLibrary: "LIBRARY", noSavedTpl: "Empty", tplPlaceholder: "Name...", filePlaceholder: "Filename", btnText: "TEXT", btnLogo: "LOGO", canvasRatio: "CANVAS RATIO", ratioOriginal: "Original + Border", imgZoom: "Image Zoom", dragTip: "Tip: Drag image to pan", bgBrightness: "Bg Brightness", metaTip: "Missing info? Check original photo metadata", applyAll: "Apply All", importingPrefix: "Importing ", importingSuffix: " images", batch: "BATCH", saveSuccess: "Image saved successfully!", btnSaved: "SAVED" },
    jp: { loading: "解析中...", subtitle: "By F.Z.R", templateStyle: "スタイル", tplGallery: "ギャラリー", tplCinema: "シネマ", tplFloat: "フロート", styleParam: "パラメータ", fontScale: "文字サイズ", borderScale: "枠線", radius: "半径", frameBg: "枠色", textColor: "文字色", auto: "自動", cameraLogo: "ロゴ", invert: "反転", scale: "サイズ", typography: "フォント", fontDefault: "標準", fontSerif: "明朝", fontMono: "等幅", fontCustom: "カスタム...", paramEdit: "メタデータ", labelMake: "メーカー", labelModel: "モデル", labelLens: "レンズ", labelFocal: "焦点距離", labelAperture: "絞り", labelShutter: "シャッター", labelISO: "ISO", labelDate: "日付", exportSettings: "保存", saveImage: "保存", clickToUpload: "画像をアップロード", supportedFormats: "JPG/PNG", filmstrip: "ギャラリー", add: "追加", clear: "クリア", noPhotos: "なし", exifInspector: "EXIF情報", metaFile: "ファイル", metaSize: "サイズ", metaDim: "解像度", metaMake: "メーカー", metaModel: "モデル", metaLens: "レンズ", metaSoftware: "ソフト", tplLibrary: "ライブラリ", noSavedTpl: "空", tplPlaceholder: "名前...", filePlaceholder: "ファイル名", btnText: "テキスト", btnLogo: "ロゴ", canvasRatio: "比率", ratioOriginal: "オリジナル", imgZoom: "ズーム", dragTip: "ヒント: ドラッグして移動", bgBrightness: "背景の明るさ", metaTip: "情報が表示されない場合は、元の写真を確認してください", applyAll: "すべてに適用", importingPrefix: "", importingSuffix: " 枚の画像を読み込み中", batch: "一括保存", saveSuccess: "画像の保存に成功しました！", btnSaved: "保存完了" }
};

let logosPath = 'assets/logos'; // Default fallback

// --- Logic Functions ---

function findLensInfo(tags) {
    if (tags.LensModel && tags.LensModel !== "" && tags.LensModel !== "----") return tags.LensModel;
    if (tags.Lens && tags.Lens !== "" && tags.Lens !== "----") return tags.Lens;
    if (tags.LensInfo && tags.LensInfo !== "" && tags.LensInfo !== "----") return tags.LensInfo;
    if (tags.LensID && tags.LensID !== "" && tags.LensID !== "----") return tags.LensID;            // New check
    if (tags.LensType && tags.LensType !== "" && tags.LensType !== "----") return tags.LensType;    // New check

    // Fallback: Construct from Focal/Aperture
    let focal = tags.FocalLength ? `${tags.FocalLength}mm` : "";
    let ap = tags.FNumber ? `f/${tags.FNumber}` : "";
    if (focal && ap) return `${focal} ${ap}`;
    if (focal) return focal;
    return "Lens Info";
}

function tryLoadBrandLogo(make) {
    return new Promise((resolve) => {
        if (!make) { resolve(null); return; }
        let cleanMake = make.toLowerCase().trim();

        // Map known brands to filenames
        const map = {
            'phase one': 'Phase_One',
            'pentax': 'Pentax',
            'hasselblad': 'hasselblad',
            'leica': 'leica',
            'fujifilm': 'fujifilm',
            'olympus': 'olympus',
            'panasonic': 'panasonic',
            'ricoh': 'ricoh',
            'sigma': 'sigma',
            'sony': 'sony',
            'canon': 'canon',
            'nikon': 'nikon',
            'dji': 'dji',
            'gopro': 'gopro'
        };

        let filename = null;
        for (const key in map) {
            if (cleanMake.includes(key)) {
                filename = map[key];
                break;
            }
        }

        if (!filename) {
            filename = cleanMake.replace(/corporation/g, '').replace(/\./g, '').trim().split(' ')[0];
        }

        // Use absolute path with file protocol (3 slashes for Windows drive paths)
        const logoPath = `file:///${logosPath}/${filename}.png`;
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = logoPath;
    });
}

function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}

async function loadSystemFonts() {
    if (!isElectron()) return;
    try {
        const fonts = await ipc.invoke('query-local-fonts');
        if (!fonts) return;
        const uniqueFonts = [...new Set(fonts.map(f => f.family))].sort();
        const select = document.getElementById('fontSelector');
        while (select.options.length > 3) { select.remove(3); }
        const sep = document.createElement('option'); sep.disabled = true; sep.text = "--- System Fonts ---"; select.add(sep);
        uniqueFonts.forEach(font => { const opt = document.createElement('option'); opt.value = font; opt.text = font; select.add(opt); });
        const customOpt = document.createElement('option'); customOpt.value = "custom"; customOpt.text = "Custom Font..."; customOpt.setAttribute('data-i18n', 'fontCustom'); select.add(customOpt);
    } catch (err) {
        console.error("Font error:", err);
        alert("Font loading failed: " + err.message);
    }
}

function applySettingsToAll() {
    if (state.currentIndex === -1 || state.images.length <= 1) return;
    if (!confirm("Apply current style to all photos?")) return;

    const sourceConfig = state.images[state.currentIndex].config;

    // Deep copy config to all other images
    state.images.forEach((img, idx) => {
        if (idx === state.currentIndex) return;

        // Clone config
        const newConfig = JSON.parse(JSON.stringify(sourceConfig));

        // Preserve image-specific properties if any (currently none, but good practice)
        // Actually, we want to preserve the imageScale/Offset if they were manually set? 
        // The user request says "apply style", usually implies border/font/logo, but maybe not crop?
        // "Adjust border style independently... apply to all". 
        // I'll assume they want to copy everything including ratio, but maybe reset crop if ratio changes.
        // For simplicity and consistency, I'll copy everything. 
        // But I need to restore the logo image object if it's a custom uploaded one, 
        // because JSON.stringify/parse will lose the Image object reference.

        newConfig.logo.img = sourceConfig.logo.img; // Restore reference

        img.config = newConfig;
    });

    alert("Settings applied to all photos!");
}

// --- File Handling ---

async function handleFileSelect(event) {
    console.log("handleFileSelect triggered");
    const files = Array.from(event.target.files);
    console.log("Files selected:", files.length);
    await processFiles(files);
    event.target.value = ''; // Reset input
}

async function processFiles(files) {
    if (files.length === 0) return;
    console.log("processFiles starting");

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        console.log("Showing overlay...");
        // Aggressive visibility force
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.zIndex = '9999';
        overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');

        document.getElementById('loadPercent').innerText = '0';
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            const t = translations[state.lang];
            loadingText.innerText = `${t.importingPrefix}${files.length}${t.importingSuffix}`;
        }
    } else {
        console.error("Overlay element not found!");
    }

    // Force a reflow and paint with a longer delay
    await new Promise(resolve => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                console.log("Initial delay done, starting processing");
                resolve();
            }, 500);
        });
    });

    let loadedCount = 0;
    const total = files.length;

    // Process files one by one with UI yields
    const processNext = async (index) => {
        if (index >= total) {
            console.log("All files processed");
            // All done
            if (state.currentIndex === -1 && state.images.length > 0) {
                selectImage(0);
            } else {
                updateFilmstrip();
            }

            if (overlay) {
                console.log("Hiding overlay");
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.add('hidden');
                    // Reset inline styles
                    overlay.style.zIndex = '';
                }, 300);
            }
            return;
        }

        const file = files[index];
        try {
            await processNewImage(file);
        } catch (err) {
            console.error("Error processing file:", file.name, err);
        }

        loadedCount++;
        if (overlay) {
            document.getElementById('loadPercent').innerText = Math.round((loadedCount / total) * 100);
            const loadingText = document.getElementById('loadingText');
            if (loadingText) {
                const t = translations[state.lang];
                loadingText.innerText = `${t.importingPrefix}${loadedCount}/${total}${t.importingSuffix}`;
            }
        }

        // Schedule next iteration
        setTimeout(() => processNext(index + 1), 20);
    };

    // Start processing
    processNext(0);
}

function setupDragAndDrop() {
    const body = document.body;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        body.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        document.getElementById('emptyState')?.classList.add('border-blue-500', 'bg-blue-50/10');
    }

    function unhighlight(e) {
        document.getElementById('emptyState')?.classList.remove('border-blue-500', 'bg-blue-50/10');
    }

    body.addEventListener('drop', handleDrop, false);

    async function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
        await processFiles(files);
    }
}


async function batchSave() {
    if (!isElectron()) { alert("Batch save is only available in desktop version."); return; }
    if (state.images.length === 0) return;
    const result = await ipc.invoke('select-folder-dialog');
    if (!result || !result.success) return;
    const targetFolder = result.path;
    const loader = document.getElementById('loadingOverlay');
    const loadPercent = document.getElementById('loadPercent');
    const originalIndex = state.currentIndex;
    loader.classList.remove('hidden', 'opacity-0');
    try {
        for (let i = 0; i < state.images.length; i++) {
            selectImage(i);
            await new Promise(r => setTimeout(r, 50));
            const originalName = state.images[i].file.name.split('.')[0];
            const sep = targetFolder.includes('/') ? '/' : '\\';
            const fileName = targetFolder.endsWith(sep) ? targetFolder + `${originalName}_ExifFrame.jpg` : targetFolder + sep + `${originalName}_ExifFrame.jpg`;
            const dataURL = getCanvas().toDataURL('image/jpeg', 0.95);
            await ipc.invoke('save-file-direct', fileName, dataURL);
            loadPercent.innerText = Math.round(((i + 1) / state.images.length) * 100);
        }
        alert(translations[state.lang].saveSuccess);
    } catch (err) { alert("Batch save failed: " + err); } finally { loader.classList.add('opacity-0'); setTimeout(() => loader.classList.add('hidden'), 300); if (originalIndex !== -1) selectImage(originalIndex); }
}

function deleteImage(index, event) {
    if (event) event.stopPropagation();
    if (!confirm("Remove this image?")) return;
    state.images.splice(index, 1);
    if (state.images.length === 0) { state.currentIndex = -1; clearPhotosUI(); } else { if (state.currentIndex >= index) { state.currentIndex = Math.max(0, state.currentIndex - 1); } selectImage(state.currentIndex); }
}

async function downloadImage() {
    if (state.currentIndex === -1) return;
    const customName = document.getElementById('exportFilename').value.trim();
    const originalName = state.images[state.currentIndex].file.name.split('.')[0];
    const fileName = customName ? `${customName}.jpg` : `${originalName}_ExifFrame.jpg`;
    const dataURL = getCanvas().toDataURL('image/jpeg', 0.95);
    if (isElectron()) {
        try { const result = await ipc.invoke('save-file-dialog', dataURL, fileName); if (result && result.success) showSaveFeedback(); } catch (err) { alert("Save failed: " + err); }
    } else {
        const link = document.createElement('a'); link.download = fileName; link.href = dataURL; link.click(); showSaveFeedback();
    }
}

function showSaveFeedback() {
    const btn = document.querySelector('button[onclick="downloadImage()"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> ${translations[state.lang].btnSaved}`;
    btn.classList.replace('bg-zinc-800', 'bg-green-500'); btn.classList.replace('dark:bg-white', 'bg-green-500');
    setTimeout(() => { btn.innerHTML = originalContent; btn.classList.replace('bg-green-500', 'bg-zinc-800'); btn.classList.replace('bg-green-500', 'dark:bg-white'); refreshIcons(); }, 2000);
    refreshIcons();
}

// --- Initialization Logic ---
let isInitialized = false;

function init() {
    if (isInitialized) return;

    // Fetch logos path from main process
    if (isElectron()) {
        ipc.invoke('get-logos-path').then(path => {
            if (path) logosPath = path.replace(/\\/g, '/');
            console.log("Logos path set to:", logosPath);
        });
    }

    initLogger();
    setupDragAndDrop();

    // Attempt to get canvas
    if (!initCanvas('mainCanvas')) {
        console.warn("Canvas element not found yet.");
        return;
    }

    isInitialized = true;

    const savedTpls = localStorage.getItem('exifFrame_templates');
    if (savedTpls) {
        try {
            state.savedTemplates = JSON.parse(savedTpls);
        } catch (e) { console.error("Failed to load templates", e); }
    }

    initTemplates();
    setTemplate('classic');
    setLanguage('en');
    toggleBrandMode('text');

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        state.theme = 'dark';
        document.documentElement.classList.add('dark');
        updateThemeIcon();
    }

    setTimeout(loadSystemFonts, 1000);

    if (window.lucide) {
        refreshIcons();
    } else {
        console.warn("Lucide icons not loaded. Check network connection.");
        alert("Warning: Icons failed to load. Please check your network connection.");
    }

    setupCanvasListeners();
    console.log("RZFrame Initialized Successfully");

    // Hide loading overlay
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 500);
    }

    // Add Event Listeners
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    const logoInput = document.getElementById('logoInput');
    if (logoInput) {
        logoInput.addEventListener('change', handleLogoUpload);
    }

    refreshIcons();
}

function updateConfig(key, val) {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;

    if (['radius', 'fontScale', 'borderScale', 'bgBrightness'].includes(key)) config[key] = parseFloat(val);
    else config[key] = val;

    if (key === 'radius') document.getElementById('radiusVal').innerText = val + 'px';
    if (key === 'fontScale') document.getElementById('fontScaleVal').innerText = parseFloat(val).toFixed(1) + 'x';
    if (key === 'borderScale') document.getElementById('borderScaleVal').innerText = parseFloat(val).toFixed(1) + 'x';
    if (key === 'bgBrightness') document.getElementById('bgBrightnessVal').innerText = parseFloat(val).toFixed(2);

    render();
}

function setLanguage(lang) { updateState('lang', lang); updateLanguageUI(); }
function updateLanguageUI() { const t = translations[state.lang]; document.querySelectorAll('.lang-opt').forEach(el => el.classList.remove('active')); const opts = document.querySelectorAll('.lang-opt'); if (state.lang === 'en') opts[0].classList.add('active'); if (state.lang === 'jp') opts[1].classList.add('active'); if (state.lang === 'cn') opts[2].classList.add('active'); document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (t[key]) el.innerText = t[key]; }); document.getElementById('templateName').placeholder = t.tplPlaceholder; document.getElementById('exportFilename').placeholder = t.filePlaceholder; }

function resetAll() {
    if (!confirm("Reset?")) return;

    // If we have images, reset the current image's config to default
    if (state.currentIndex !== -1) {
        state.images[state.currentIndex].config = JSON.parse(JSON.stringify(defaultConfig));
        // Re-apply auto logo if exists
        if (state.images[state.currentIndex].autoLogo) {
            state.images[state.currentIndex].config.logo.img = state.images[state.currentIndex].autoLogo;
            state.images[state.currentIndex].config.logo.useImage = true;
        }
        selectImage(state.currentIndex); // Reload UI
    } else {
        // Just clear everything
        resetState();
        clearPhotosUI();
    }

    const i = ['inp-make', 'inp-model', 'inp-lens', 'inp-focal', 'inp-aperture', 'inp-shutter', 'inp-iso', 'inp-date'];
    i.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    updateLanguageUI();
    refreshIcons();
}

function clearFilmstrip() { if (state.images.length === 0) return; if (!confirm("Clear all?")) return; state.images = []; state.currentIndex = -1; clearPhotosUI(); }
function clearPhotosUI() { document.getElementById('thumbnailStrip').innerHTML = `<div class="text-xs opacity-40 w-full text-center pt-6 font-bold" data-i18n="noPhotos">${translations[state.lang].noPhotos}</div>`; document.getElementById('imgCount').innerText = '0'; document.getElementById('emptyState').classList.remove('hidden'); const canvas = getCanvas(); canvas.classList.add('hidden'); document.getElementById('bg-layer').style.opacity = '0'; setTimeout(() => { document.getElementById('bg-layer').style.backgroundImage = 'none'; }, 800); document.querySelectorAll('[id^="meta-"]').forEach(el => el.innerText = '--'); const i = ['inp-make', 'inp-model', 'inp-lens', 'inp-focal', 'inp-aperture', 'inp-shutter', 'inp-iso', 'inp-date']; i.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }

function toggleBrandMode(m) {
    if (state.currentIndex === -1) {
        // UI-only update for initial state
        const t = document.getElementById('modeTextBtn'); const i = document.getElementById('modeImgBtn'); const ti = document.getElementById('inp-make'); const lc = document.getElementById('brandLogoControls');
        if (!t || !i || !ti || !lc) { console.warn("toggleBrandMode: Elements not found"); return; }
        if (m === 'image') { t.classList.remove('active'); i.classList.add('active'); ti.classList.add('hidden'); lc.classList.remove('hidden'); } else { i.classList.remove('active'); t.classList.add('active'); lc.classList.add('hidden'); ti.classList.remove('hidden'); }
        return;
    }
    const config = state.images[state.currentIndex].config;
    config.logo.useImage = (m === 'image');
    const t = document.getElementById('modeTextBtn'); const i = document.getElementById('modeImgBtn'); const ti = document.getElementById('inp-make'); const lc = document.getElementById('brandLogoControls');
    if (!t || !i || !ti || !lc) return;
    if (m === 'image') { t.classList.remove('active'); i.classList.add('active'); ti.classList.add('hidden'); lc.classList.remove('hidden'); } else { i.classList.remove('active'); t.classList.add('active'); lc.classList.add('hidden'); ti.classList.remove('hidden'); }
    render();
}

function handleLogoUpload(event) {
    const f = event.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => {
        const i = new Image(); i.onload = () => {
            if (state.currentIndex === -1) return;
            state.images[state.currentIndex].config.logo.img = i;
            state.images[state.currentIndex].config.logo.useImage = true;
            document.getElementById('logoPreview').src = ev.target.result; document.getElementById('logoPreview').classList.remove('hidden'); document.getElementById('logoPlaceholderIcon').classList.add('hidden'); updateLogoPreviewFilter(); render();
        }; i.src = ev.target.result;
    }; r.readAsDataURL(f);
    event.target.value = '';
}

function resetLogoUI() {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    config.logo.img = null;
    config.logo.invert = false;
    document.getElementById('logoPreview').classList.add('hidden');
    document.getElementById('logoPlaceholderIcon').classList.remove('hidden');
    document.getElementById('logoInput').value = '';
}

function toggleLogoInvert() {
    if (state.currentIndex === -1) return;
    state.images[state.currentIndex].config.logo.invert = !state.images[state.currentIndex].config.logo.invert;
    updateLogoPreviewFilter();
    render();
}

function updateLogoScale(v) {
    if (state.currentIndex === -1) return;
    state.images[state.currentIndex].config.logo.scale = v / 100;
    document.getElementById('scaleVal').innerText = v + '%';
    render();
}

function updateLogoPreviewFilter() {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    const p = document.getElementById('logoPreview');
    const b = document.getElementById('invertBtn');
    if (config.logo.invert) { p.style.filter = 'invert(1)'; b.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black'); } else { p.style.filter = 'none'; b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black'); }
}

function setTemplate(t) {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    config.template = t;

    ['classic', 'cinema', 'float'].forEach(id => { const b = document.getElementById(`btn-${id}`); if (id === t) b.classList.add('active'); else b.classList.remove('active'); });
    const rc = document.getElementById('radiusControl');
    const bc = document.getElementById('bgBrightnessControl');
    const fc = document.getElementById('frameColorGroup');
    if (t === 'float') {
        rc.classList.remove('hidden');
        bc.classList.remove('hidden');
        fc.classList.add('hidden');
    } else {
        rc.classList.add('hidden');
        bc.classList.add('hidden');
        fc.classList.remove('hidden');
    }
    config.layout.left.y = 0; config.layout.right.y = 0;
    render();
}

function setAspectRatio(ratio) {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    config.aspectRatio = ratio;

    const cropControls = document.getElementById('cropControls');
    if (ratio === 'original') {
        cropControls.classList.add('hidden');
        config.imageScale = 1.0;
        config.imageOffset = { x: 0, y: 0 };
    } else {
        cropControls.classList.remove('hidden');

        const img = state.images[state.currentIndex].imgObj;
        const w = img.width;
        const h = img.height;

        let padding = 0, footerH = 0;
        if (config.template === 'classic') {
            padding = Math.round(Math.max(w, h) * 0.03 * config.borderScale);
            footerH = Math.round(h * 0.12 * config.borderScale);
            if (config.borderScale < 0.1 && config.borderScale > 0) footerH = Math.round(h * 0.05);
        }
        else if (config.template === 'cinema') { footerH = Math.round(h * 0.10 * config.borderScale); }
        else if (config.template === 'float') { padding = Math.round(Math.max(w, h) * 0.08 * config.borderScale); }
        if (footerH < h * 0.02 && config.template !== 'float') footerH = h * 0.02;

        const [rw, rh] = ratio.split(':').map(Number);
        const targetRatio = rw / rh;
        const baseDim = Math.max(w, h) + (padding * 2);

        let canvasW, canvasH;
        if (targetRatio > 1) { canvasW = baseDim; canvasH = baseDim / targetRatio; }
        else { canvasW = baseDim * targetRatio; canvasH = baseDim; }

        let maskW, maskH;
        if (config.template === 'classic') {
            maskW = canvasW - (padding * 2); maskH = canvasH - (padding + footerH);
        } else if (config.template === 'cinema') {
            maskW = canvasW; maskH = canvasH - footerH;
        } else if (config.template === 'float') {
            maskW = canvasW - (padding * 2); maskH = canvasH - (padding * 2);
        }

        const scaleX = maskW / w;
        const scaleY = maskH / h;
        config.imageScale = Math.max(scaleX, scaleY);

        const sliderVal = Math.round(config.imageScale * 100);
        document.getElementById('imgScaleInput').value = sliderVal;
        document.getElementById('imgScaleVal').innerText = sliderVal + '%';
        config.imageOffset = { x: 0, y: 0 };
    }
    render();
}

function toggleRatioOrientation() {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;

    if (config.aspectRatio === 'original') return;
    const parts = config.aspectRatio.split(':');
    if (parts.length !== 2) return;
    const newRatio = `${parts[1]}:${parts[0]}`;

    // Check if option exists, if not add it temporarily or just set value
    const select = document.getElementById('ratioSelector');
    let exists = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === newRatio) {
            select.selectedIndex = i;
            exists = true;
            break;
        }
    }

    if (!exists) {
        // Create temporary option if it's a valid swap but not in list
        const opt = document.createElement('option');
        opt.value = newRatio;
        opt.text = `${newRatio} (Swapped)`;
        select.add(opt);
        select.value = newRatio;
    }

    setAspectRatio(newRatio);
}

function updateImageScale(val) {
    if (state.currentIndex === -1) return;
    state.images[state.currentIndex].config.imageScale = parseFloat(val) / 100;
    document.getElementById('imgScaleVal').innerText = val + '%';
    render();
}

function updateBackground(img) { const bg = document.getElementById('bg-layer'); if (!img) { bg.style.opacity = '0'; return; } const c = document.createElement('canvas'); c.width = 100; c.height = 100; c.getContext('2d').drawImage(img, 0, 0, 100, 100); bg.style.backgroundImage = `url(${c.toDataURL()})`; bg.style.opacity = '1'; }

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    if (state.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    updateThemeIcon();
    render();
}

function updateThemeIcon() { document.getElementById('themeBtn').innerHTML = state.theme === 'dark' ? '<i data-lucide="sun" class="w-4 h-4"></i>' : '<i data-lucide="moon" class="w-4 h-4"></i>'; refreshIcons(); }
function setFont(v) {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    const i = document.getElementById('customFontInput');
    if (v === 'custom') {
        i.classList.remove('hidden');
        config.font = i.value || 'Arial';
    } else {
        i.classList.add('hidden');
        config.font = v;
    }
    render();
}

function setCustomFont(v) {
    if (state.currentIndex === -1) return;
    if (v) {
        state.images[state.currentIndex].config.font = v;
        render();
    }
}



function processNewImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                const imgData = {
                    file: file,
                    imgObj: img,
                    thumbUrl: createThumbnail(img),
                    metaDisplay: {},
                    userEdit: {},
                    autoLogo: null,
                    config: JSON.parse(JSON.stringify(defaultConfig))
                };
                if (isElectron()) {
                    // Use backend robust analysis
                    ipc.invoke('analyze-exif', file.path).then(async (result) => {
                        console.log("EXIF Result (Backend):", result);
                        const tags = result.tags || {};
                        const lensInfo = result.lensName || "Lens Info";

                        const make = (tags.Make || 'Unknown').replace(/\0/g, '');
                        const model = (tags.Model || 'Unknown').replace(/\0/g, '');

                        // const lensInfo = findLensInfo(tags); // Deprecated in favor of backend


                        // Parse Date
                        const rawDate = tags.DateTimeOriginal || tags.DateTime || tags.CreateDate;
                        let dateStr = '--';
                        if (rawDate) {
                            if (typeof rawDate === 'string') {
                                dateStr = rawDate;
                            } else if (typeof rawDate === 'object') {
                                // Handle ExifDateTime object structure from exiftool-vendored
                                if (rawDate.rawValue) {
                                    dateStr = rawDate.rawValue;
                                } else if (rawDate.year && rawDate.month && rawDate.day) {
                                    // Manually construct standard EXIF date format: YYYY:MM:DD HH:mm:ss
                                    const pad = (n) => n.toString().padStart(2, '0');
                                    dateStr = `${rawDate.year}:${pad(rawDate.month)}:${pad(rawDate.day)}`;
                                    if (rawDate.hour !== undefined) {
                                        dateStr += ` ${pad(rawDate.hour)}:${pad(rawDate.minute)}:${pad(rawDate.second || 0)}`;
                                    }
                                } else {
                                    dateStr = String(rawDate); // Fallback
                                }
                            }
                        }

                        // Parse ISO
                        const isoVal = tags.ISO || tags.ISOSpeedRatings || '--';

                        imgData.metaDisplay = {
                            filename: file.name,
                            filesize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                            dimensions: `${img.width} x ${img.height}`,
                            make: make,
                            model: model,
                            lens: lensInfo,
                            software: tags.Software || '--',
                            date: dateStr,
                            focal: tags.FocalLength ? `${parseFloat(tags.FocalLength)}mm` : '--',
                            aperture: tags.FNumber ? `f/${tags.FNumber}` : '--',
                            shutter: tags.ExposureTime ? (tags.ExposureTime < 1 ? `1/${Math.round(1 / tags.ExposureTime)}` : `${tags.ExposureTime}"`) : '--',
                            iso: isoVal,
                            flash: tags.Flash === undefined ? '--' : (tags.Flash & 1 ? 'Fired' : 'Off')
                        };

                        let modelClean = imgData.metaDisplay.model;
                        if (modelClean.includes('ILCE-7RM2')) modelClean = 'Sony A7R II';

                        // Fix for date object/string mismatch causing crash
                        let dateClean = '--';
                        try {
                            // Ensure we rely on our nicely formatted dateStr from above
                            dateClean = imgData.metaDisplay.date.split(' ')[0].replace(/:/g, '.');
                        } catch (e) {
                            console.warn("Date parse error", e);
                            dateClean = imgData.metaDisplay.date;
                        }

                        imgData.userEdit = {
                            make: imgData.metaDisplay.make,
                            model: modelClean,
                            lens: imgData.metaDisplay.lens,
                            focal: imgData.metaDisplay.focal,
                            aperture: imgData.metaDisplay.aperture,
                            shutter: imgData.metaDisplay.shutter,
                            iso: imgData.metaDisplay.iso,
                            date: dateClean
                        };

                        const autoLogo = await tryLoadBrandLogo(imgData.userEdit.make);
                        if (autoLogo) {
                            imgData.autoLogo = autoLogo;
                            imgData.config.logo.img = autoLogo;
                            imgData.config.logo.useImage = true;
                        }

                        state.images.push(imgData);
                        resolve();
                    })
                        .catch(err => {
                            console.error("EXIF IPC Failed:", err);
                            if (window.api && window.api.send) {
                                window.api.send('log-message', { level: 'error', message: `EXIF Analysis Failed: ${file.name}`, data: err.message });
                            }

                            // Fallback data
                            imgData.metaDisplay = { filename: file.name, filesize: (file.size / 1024 / 1024).toFixed(2) + ' MB', dimensions: `${img.width} x ${img.height}`, make: 'Unknown', model: 'Unknown', lens: '--', software: '--', date: '--', focal: '--', aperture: '--', shutter: '--', iso: '--', flash: '--' };
                            imgData.userEdit = { make: 'Unknown', model: 'Unknown', lens: '--', focal: '--', aperture: '--', shutter: '--', iso: '--', date: '--' };

                            state.images.push(imgData);
                            resolve();
                        });
                } else {
                    console.warn("EXIF library not loaded");
                    // Fallback for no EXIF
                    imgData.metaDisplay = { filename: file.name, filesize: (file.size / 1024 / 1024).toFixed(2) + ' MB', dimensions: `${img.width} x ${img.height}`, make: 'Unknown', model: 'Unknown', lens: '--', software: '--', date: '--', focal: '--', aperture: '--', shutter: '--', iso: '--', flash: '--' };
                    imgData.userEdit = { make: 'Unknown', model: 'Unknown', lens: '--', focal: '--', aperture: '--', shutter: '--', iso: '--', date: '--' };
                    state.images.push(imgData);
                    resolve();
                }
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function createThumbnail(img) { const c = document.createElement('canvas'); const h = 100; const a = img.width / img.height; c.height = h; c.width = h * a; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL(); }
async function initTemplates() {
    if (isElectron()) {
        const tpls = await ipc.invoke('template-list');
        if (tpls) {
            state.savedTemplates = tpls;
            renderTemplateList();
        }
    } else {
        const s = localStorage.getItem('exifFrame_templates');
        if (s) {
            state.savedTemplates = JSON.parse(s);
            renderTemplateList();
        }
    }
}
function updateFilmstrip() { const s = document.getElementById('thumbnailStrip'); s.innerHTML = ''; document.getElementById('imgCount').innerText = state.images.length; state.images.forEach((d, i) => { const div = document.createElement('div'); const sel = i === state.currentIndex; div.className = `relative h-full w-auto shrink-0 cursor-pointer rounded-lg overflow-hidden transition-all duration-200 group ${sel ? 'ring-2 ring-white opacity-100 shadow-lg scale-105 z-10' : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'}`; div.onclick = () => selectImage(i); const delBtn = document.createElement('button'); delBtn.className = "absolute top-1 right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-20 shadow-sm"; delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`; delBtn.onclick = (e) => deleteImage(i, e); const t = document.createElement('img'); t.src = d.thumbUrl; t.className = "h-full w-auto object-contain"; div.appendChild(t); div.appendChild(delBtn); s.appendChild(div); }); refreshIcons(); }

function selectImage(idx) {
    if (state.images.length === 0) { clearPhotosUI(); return; }
    state.currentIndex = idx;
    const d = state.images[idx];
    const config = d.config;

    updateBackground(d.imgObj);

    // Show Canvas, Hide Empty State
    document.getElementById('emptyState').classList.add('hidden');
    const canvas = getCanvas();
    if (canvas) canvas.classList.remove('hidden');

    // Sync UI with Image Config
    document.getElementById('fontSelector').value = config.font;
    document.getElementById('radiusInput').value = config.radius;
    document.getElementById('radiusVal').innerText = config.radius + 'px';
    document.getElementById('fontScaleInput').value = config.fontScale;
    document.getElementById('fontScaleVal').innerText = config.fontScale.toFixed(1) + 'x';
    document.getElementById('borderScaleInput').value = config.borderScale;
    document.getElementById('borderScaleVal').innerText = config.borderScale.toFixed(1) + 'x';
    document.getElementById('ratioSelector').value = config.aspectRatio;
    document.getElementById('bgBrightnessInput').value = config.bgBrightness;
    document.getElementById('bgBrightnessVal').innerText = config.bgBrightness.toFixed(2);
    document.getElementById('imgScaleInput').value = Math.round(config.imageScale * 100);
    document.getElementById('imgScaleVal').innerText = Math.round(config.imageScale * 100) + '%';

    // Logo UI
    document.getElementById('logoScaleInput').value = Math.round(config.logo.scale * 100);
    document.getElementById('scaleVal').innerText = Math.round(config.logo.scale * 100) + '%';

    if (config.logo.useImage && config.logo.img) {
        document.getElementById('logoPreview').src = config.logo.img.src;
        document.getElementById('logoPreview').classList.remove('hidden');
        document.getElementById('logoPlaceholderIcon').classList.add('hidden');
    } else {
        document.getElementById('logoPreview').classList.add('hidden');
        document.getElementById('logoPlaceholderIcon').classList.remove('hidden');
    }

    // Sync Template Buttons
    ['classic', 'cinema', 'float'].forEach(id => {
        const b = document.getElementById(`btn-${id}`);
        if (id === config.template) b.classList.add('active');
        else b.classList.remove('active');
    });

    // Sync Visibility
    const rc = document.getElementById('radiusControl');
    const bc = document.getElementById('bgBrightnessControl');
    const fc = document.getElementById('frameColorGroup');
    if (config.template === 'float') {
        rc.classList.remove('hidden');
        bc.classList.remove('hidden');
        fc.classList.add('hidden');
    } else {
        rc.classList.add('hidden');
        bc.classList.add('hidden');
        fc.classList.remove('hidden');
    }

    const cropControls = document.getElementById('cropControls');
    if (config.aspectRatio === 'original') cropControls.classList.add('hidden');
    else cropControls.classList.remove('hidden');

    toggleBrandMode(config.logo.useImage ? 'image' : 'text');

    // Sync Metadata Inputs
    const ids = ['make', 'model', 'lens', 'focal', 'aperture', 'shutter', 'iso', 'date'];
    ids.forEach(k => { const el = document.getElementById(`inp-${k}`); if (el) el.value = d.userEdit[k]; });

    // Sync EXIF Panel
    document.getElementById('meta-filename').innerText = d.metaDisplay.filename;
    document.getElementById('meta-filesize').innerText = d.metaDisplay.filesize;
    document.getElementById('meta-dim').innerText = d.metaDisplay.dimensions;
    document.getElementById('meta-make').innerText = d.metaDisplay.make;
    document.getElementById('meta-model').innerText = d.metaDisplay.model;
    document.getElementById('meta-lens').innerText = d.metaDisplay.lens;
    const ms = document.getElementById('meta-software'); if (ms) ms.innerText = d.metaDisplay.software;
    document.getElementById('meta-focal').innerText = d.metaDisplay.focal;
    document.getElementById('meta-aperture').innerText = d.metaDisplay.aperture;
    document.getElementById('meta-shutter').innerText = d.metaDisplay.shutter;
    document.getElementById('meta-iso').innerText = d.metaDisplay.iso;
    const mf = document.getElementById('meta-flash'); if (mf) mf.innerText = `Flash: ${d.metaDisplay.flash}`;
    const md = document.getElementById('meta-date'); if (md) md.innerText = `Date: ${d.metaDisplay.date}`;
    document.getElementById('exportFilename').value = "";
    updateFilmstrip();
    render();
}

const im = { 'inp-make': 'make', 'inp-model': 'model', 'inp-lens': 'lens', 'inp-focal': 'focal', 'inp-aperture': 'aperture', 'inp-shutter': 'shutter', 'inp-iso': 'iso', 'inp-date': 'date' }; Object.keys(im).forEach(id => { document.getElementById(id).addEventListener('input', (e) => { if (state.currentIndex === -1) return; state.images[state.currentIndex].userEdit[im[id]] = e.target.value; render(); }); });

function resizeImageToBase64(img, maxWidth = 600) {
    const c = document.createElement('canvas');
    let w = img.width;
    let h = img.height;
    if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
    }
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/png');
}

async function saveCurrentTemplate() {
    const n = document.getElementById('templateName').value.trim();
    if (!n) return;

    if (state.currentIndex === -1) {
        alert("Please select an image to save its style.");
        return;
    }

    const currentConfig = state.images[state.currentIndex].config;

    const t = {
        id: Date.now(),
        name: n,
        config: {
            template: currentConfig.template,
            font: currentConfig.font,
            radius: currentConfig.radius,
            frameColor: currentConfig.frameColor,
            fontColor: currentConfig.fontColor,
            fontScale: currentConfig.fontScale,
            borderScale: currentConfig.borderScale,
            logoScale: currentConfig.logo.scale,
            logoInvert: currentConfig.logo.invert,
            layout: currentConfig.layout,
            useImage: currentConfig.logo.useImage,
            aspectRatio: currentConfig.aspectRatio,
            bgBrightness: currentConfig.bgBrightness,
            logoData: (currentConfig.logo.useImage && currentConfig.logo.img) ? resizeImageToBase64(currentConfig.logo.img) : null
        }
    };

    if (isElectron()) {
        const result = await ipc.invoke('template-save', t);
        if (result && result.success) {
            state.savedTemplates.push(t);
            renderTemplateList();
        } else {
            alert("Failed to save template: " + (result ? result.error : 'Unknown error'));
        }
    } else {
        // Fallback for web
        state.savedTemplates.push(t);
        localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
        renderTemplateList();
    }

    document.getElementById('templateName').value = '';
}

function loadTemplate(id) {
    if (state.currentIndex === -1) {
        alert("Please select an image to apply the template.");
        return;
    }
    const t = state.savedTemplates.find(x => x.id === id);
    if (!t) return;
    const c = t.config;
    const config = state.images[state.currentIndex].config;

    config.template = c.template;
    config.font = c.font;
    config.radius = c.radius;
    config.frameColor = c.frameColor;
    config.fontColor = c.fontColor;
    config.fontScale = c.fontScale;
    config.borderScale = c.borderScale;
    config.logo.scale = c.logoScale;
    config.logo.invert = c.logoInvert;
    config.layout = { ...defaultConfig.layout, ...c.layout };
    if (!config.layout.left) config.layout.left = { ...defaultConfig.layout.left };
    if (!config.layout.right) config.layout.right = { ...defaultConfig.layout.right };
    config.logo.useImage = c.useImage;

    if (c.aspectRatio) config.aspectRatio = c.aspectRatio;
    if (c.bgBrightness) config.bgBrightness = c.bgBrightness;

    if (c.logoData) {
        const img = new Image();
        img.onload = () => {
            config.logo.img = img;
            document.getElementById('logoPreview').src = img.src;
            document.getElementById('logoPreview').classList.remove('hidden');
            document.getElementById('logoPlaceholderIcon').classList.add('hidden');
            updateLogoPreviewFilter();
            render();
        };
        img.src = c.logoData;
        config.logo.useImage = true;
    } else {
        if (!config.logo.useImage) {
            toggleBrandMode('text');
        }
    }

    setTemplate(config.template);
    updateConfig('radius', config.radius);
    updateConfig('fontScale', config.fontScale);
    updateConfig('borderScale', config.borderScale);
    updateConfig('bgBrightness', config.bgBrightness);
    document.getElementById('logoScaleInput').value = config.logo.scale * 100;
    updateLogoScale(config.logo.scale * 100);
    updateLogoPreviewFilter();
    document.getElementById('fontSelector').value = config.font;
    toggleBrandMode(config.logo.useImage ? 'image' : 'text');
    document.getElementById('ratioSelector').value = config.aspectRatio;
    setAspectRatio(config.aspectRatio);
    render();
}

async function deleteTemplate(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this template?")) return;

    if (isElectron()) {
        const result = await ipc.invoke('template-delete', id);
        if (result && result.success) {
            state.savedTemplates = state.savedTemplates.filter(x => x.id !== id);
            renderTemplateList();
        } else {
            alert("Failed to delete template: " + (result ? result.error : 'Unknown error'));
        }
    } else {
        state.savedTemplates = state.savedTemplates.filter(x => x.id !== id);
        localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
        renderTemplateList();
    }
}

function exportTemplate(id, e) {
    e.stopPropagation();
    const t = state.savedTemplates.find(x => x.id === id);
    if (!t) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(t));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", t.name + ".rzf");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

async function importTemplates(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const t = JSON.parse(e.target.result);
            if (!t.config || !t.name) throw new Error("Invalid template format");

            t.id = Date.now();
            t.name = "[Import] " + t.name;

            if (isElectron()) {
                await ipc.invoke('template-save', t);
                state.savedTemplates.push(t);
            } else {
                state.savedTemplates.push(t);
                localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
            }

            renderTemplateList();
            alert("Template imported successfully!");
        } catch (err) {
            alert("Failed to import: " + err.message);
        }
        input.value = '';
    };
    reader.readAsText(file);
}

function renderTemplateList() {
    const c = document.getElementById('templateList');
    if (state.savedTemplates.length === 0) {
        c.innerHTML = `<div class="text-[10px] opacity-40 text-center py-4 italic" data-i18n="noSavedTpl">${translations[state.lang].noSavedTpl}</div>`;
        return;
    }
    c.innerHTML = '';
    state.savedTemplates.forEach(t => {
        const el = document.createElement('div');
        el.className = "flex justify-between items-center bg-black/5 dark:bg-white/5 hover:bg-white dark:hover:bg-white/20 p-2 rounded-lg cursor-pointer group transition border border-transparent hover:border-black/10";
        el.onclick = () => loadTemplate(t.id);
        el.innerHTML = `
            <span class="text-[10px] font-medium truncate opacity-80 flex-1">${t.name}</span>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onclick="exportTemplate(${t.id},event)" class="hover:text-blue-500 p-1" title="Export"><i data-lucide="share" class="w-3 h-3"></i></button>
                <button onclick="deleteTemplate(${t.id},event)" class="hover:text-red-500 p-1" title="Delete"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
            </div>`;
        c.appendChild(el);
    });
    refreshIcons();
    loadSystemFonts();
}

function attemptStart() {
    if (document.getElementById('mainCanvas')) {
        init();
    } else {
        setTimeout(attemptStart, 50);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    attemptStart();
}
window.addEventListener('load', init);
