/*
[INPUT]  : DOM Elements, IPC Events, User Inputs
[OUTPUT] : UI Updates, Canvas Rendering calls
[POS]    : Main Renderer Process Entry Point
[DECISION]: Refactored to act as an orchestration layer, delegating logic to specialized managers (File, Template, Export, Logo).
*/

import { state, resetState, updateState, defaultConfig, setActiveImage, getActiveImage } from './src/core/state.js';
import { initCanvas, render, getCanvas, loadImage } from './src/core/canvas.js';
import { setupCanvasListeners, handleWindowControl } from './src/ui/events.js';
import { ipc, isElectron } from './src/utils/ipc.js';
import { initLogger } from './src/utils/logger.js';
import { translations } from './src/locales/translations.js';

// Managers
import * as FileManager from './src/ui/file-manager.js';
import * as TemplateManager from './src/core/template-manager.js';
import * as ExportManager from './src/core/export-manager.js';
import * as LogoManager from './src/ui/logo-manager.js';

// Expose Managers Globally for cross-module access if needed (e.g. from file-manager)
window.LogoManager = LogoManager;
window.ExportManager = ExportManager;

// === NAMESPACE EXPOSURE ===
const RZApp = {
    toggleTheme: () => toggleTheme(),
    resetAll: () => resetAll(),
    setLanguage: (l) => setLanguage(l),
    handleWindowControl: (a) => handleWindowControl(a),
    showXHSPrompt: () => showXHSPrompt(), // NEW
    hideXHSPrompt: () => hideXHSPrompt(), // NEW

    // Delegated to TemplateManager
    setTemplate: (t) => TemplateManager.setTemplate(t),
    setAspectRatio: (r) => TemplateManager.setAspectRatio(r),
    toggleRatioOrientation: () => TemplateManager.toggleRatioOrientation(),
    updateImageScale: (v) => TemplateManager.updateImageScale(v),
    updateConfig: (k, v) => TemplateManager.updateConfig(k, v),
    setFont: (v) => TemplateManager.setFont(v),
    setCustomFont: (v) => TemplateManager.setCustomFont(v),
    applySettingsToAll: () => TemplateManager.applySettingsToAll(),

    // Delegated to LogoManager
    toggleBrandMode: (m) => LogoManager.toggleBrandMode(m),
    updateLogoScale: (v) => LogoManager.updateLogoScale(v),
    toggleLogoInvert: () => LogoManager.toggleLogoInvert(),
    resetLogoUI: () => LogoManager.resetLogoUI(),
    handleLogoUpload: (e) => LogoManager.handleLogoUpload(e),
    cycleLogo: () => LogoManager.cycleLogo(), // NEW
    importLogoFolder: () => LogoManager.importLogoFolder(), // NEW

    // Delegated to ExportManager
    saveCurrentTemplate: () => ExportManager.saveCurrentTemplate(),
    downloadImage: () => ExportManager.downloadImage(),
    batchSave: () => ExportManager.batchSave(selectImage),
    exportTemplate: (id, e) => ExportManager.exportTemplate && ExportManager.exportTemplate(id, e),
    deleteTemplate: (id, e) => ExportManager.deleteTemplate && ExportManager.deleteTemplate(id, e),
    importTemplates: (i) => ExportManager.importTemplates && ExportManager.importTemplates(i),

    // Delegated to FileManager
    handleFileSelect: (e) => FileManager.handleFileSelect(e, selectImage, updateFilmstrip),

    // Local Orchestration
    loadSystemFonts: () => loadSystemFonts(),
    clearFilmstrip: () => clearFilmstrip(),
    reselectCurrentImage: () => selectImage(state.currentIndex), // For refreshing UI after template load
    nextImage: (e) => nextImage(e),
    prevImage: (e) => prevImage(e),

    // Delegated back to TemplateManager from renderer for backwards/dependency reasons
    loadTemplate: (id) => TemplateManager.loadTemplate(id),
};

window.RZApp = RZApp;

// --- Initialization ---

let isInitialized = false;

async function loadSavedTemplates() {
    if (isElectron()) {
        try {
            const templates = await ipc.invoke('template-list');
            if (Array.isArray(templates)) {
                state.savedTemplates = templates.filter(t => t && t.id && t.name && t.config);
                return;
            }
            console.warn("Template list IPC returned invalid data, falling back to empty list.");
        } catch (err) {
            console.error("Failed to load templates from disk:", err);
        }
        state.savedTemplates = [];
        return;
    }

    const savedTpls = localStorage.getItem('exifFrame_templates');
    if (savedTpls) {
        try {
            state.savedTemplates = JSON.parse(savedTpls);
        } catch (e) {
            console.error(e);
            state.savedTemplates = [];
        }
    } else {
        state.savedTemplates = [];
    }
}

async function init() {
    if (isInitialized) return;

    if (isElectron()) {
        ipc.invoke('get-logos-path').then(path => {
            if (path) FileManager.setLogosPath(path.replace(/\\/g, '/'));

        });
    }

    initLogger();
    FileManager.setupDragAndDrop((files) => FileManager.processFiles(files, selectImage, updateFilmstrip));

    if (!initCanvas('mainCanvas')) {
        console.warn("Canvas element not found yet.");
        return;
    }

    isInitialized = true;

    await loadSavedTemplates();
    TemplateManager.renderTemplateList();

    TemplateManager.setTemplate('classic');
    setLanguage('en');
    LogoManager.toggleBrandMode('text');

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        state.theme = 'dark';
        document.documentElement.classList.add('dark');
        updateThemeIcon();
    }

    setTimeout(loadSystemFonts, 1000);

    // Icon initialization (Double RAF to ensure DOM paint)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (window.lucide) {
                window.lucide.createIcons();

            } else {
                console.warn("Lucide library not found");
            }
        });
    });

    setupCanvasListeners();


    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            overlay.classList.add('hidden');
            // Force icon initialization after overlay is hidden
            refreshIcons();
        }, 500);
    } else {
        // Fallback if no overlay exists
        refreshIcons();
    }
}

// --- Orchestration Functions ---

async function selectImage(idx) {
    if (state.images.length === 0) { clearPhotosUI(); return; }

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        document.getElementById('loadPercent').innerText = 'Loading...';
        document.getElementById('loadingText').innerText = "Loading High-Res Image";
    }

    try {
        state.currentIndex = idx;
        const d = state.images[idx];
        const config = d.config;

        setActiveImage(null);

        let srcPath = '';
        if (isElectron()) srcPath = `rz-local:///${d.file.path.replace(/\\/g, '/')}`;
        else console.warn("Web version: Cannot lazy load without Blob URL.");

        const highResImg = await loadImage(srcPath);
        setActiveImage(highResImg);

        updateBackground(highResImg);
        document.getElementById('emptyState').classList.add('hidden');
        const canvas = getCanvas();
        if (canvas) canvas.classList.remove('hidden');

        // Sync UI inputs with config
        syncUIWithConfig(config);

        // Sync Meta
        syncMetaDisplay(d);

        // Auto match logo if not already set or if explicitly requested
        // Using a flag or just checking if logo is set? 
        // For now, let's trigger it if the user hasn't manually set a logo image yet
        // OR better: Always trigger on select? No, that overwrites manual changes.
        // Trigger ONLY if it's the first load (we don't have a "first load" flag here easily without state)
        // Check `d.autoLogoApplied`:
        if (!d.autoLogoApplied && d.exif && d.exif.Make) {
            LogoManager.autoMatchLogo(d.exif);
            d.autoLogoApplied = true; // Flag to prevent overwriting user changes on re-select
        } else if (d.config.logo.useImage && d.config.logo.img) {
            // Restore existing image to UI preview
            document.getElementById('logoPreview').src = d.config.logo.img.src;
            document.getElementById('logoPreview').classList.remove('hidden');
            document.getElementById('logoPlaceholderIcon').classList.add('hidden');
        }

        updateFilmstrip();
        render();

    } catch (err) {
        console.error("Error selecting image:", err);
        alert("Failed to load image high-res: " + err.message);
    } finally {
        if (overlay) {
            overlay.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    }
}

function syncUIWithConfig(config) {
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

    // Logo
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

    // Buttons
    ['classic', 'cinema', 'float'].forEach(id => {
        const b = document.getElementById(`btn-${id}`);
        if (id === config.template) b.classList.add('active');
        else b.classList.remove('active');
    });

    // Visibility
    const rc = document.getElementById('radiusControl');
    const bc = document.getElementById('bgBrightnessControl');
    const fc = document.getElementById('frameColorGroup');
    if (config.template === 'float') {
        rc.classList.remove('hidden'); bc.classList.remove('hidden'); fc.classList.add('hidden');
    } else {
        rc.classList.add('hidden'); bc.classList.add('hidden'); fc.classList.remove('hidden');
    }

    const cropControls = document.getElementById('cropControls');
    if (config.aspectRatio === 'original') cropControls.classList.add('hidden');
    else cropControls.classList.remove('hidden');

    LogoManager.toggleBrandMode(config.logo.useImage ? 'image' : 'text');

    // Sync Font Color
    const colorPicker = document.getElementById('fontColorPicker');
    if (config.fontColor && config.fontColor.startsWith('#')) {
        if (colorPicker) colorPicker.value = config.fontColor;
    }
}

function syncMetaDisplay(d) {
    const ids = ['make', 'model', 'lens', 'focal', 'aperture', 'shutter', 'iso', 'date'];
    ids.forEach(k => {
        const el = document.getElementById(`inp-${k}`);
        if (el) el.value = d.userEdit[k] || '';
    });

    document.getElementById('meta-filename').innerText = d.metaDisplay.filename || '--';
    document.getElementById('meta-filesize').innerText = d.metaDisplay.filesize || '--';
    document.getElementById('meta-dim').innerText = d.metaDisplay.dimensions || '--';
    document.getElementById('meta-make').innerText = d.metaDisplay.make || '--';
    document.getElementById('meta-model').innerText = d.metaDisplay.model || '--';
    document.getElementById('meta-lens').innerText = d.metaDisplay.lens || '--';
    const ms = document.getElementById('meta-software'); if (ms) ms.innerText = d.metaDisplay.software || '--';
    document.getElementById('meta-focal').innerText = d.metaDisplay.focal || '--';
    document.getElementById('meta-aperture').innerText = d.metaDisplay.aperture || '--';
    document.getElementById('meta-shutter').innerText = d.metaDisplay.shutter || '--';
    document.getElementById('meta-iso').innerText = d.metaDisplay.iso || '--';
    const mf = document.getElementById('meta-flash'); if (mf) mf.innerText = d.metaDisplay.flash ? `Flash: ${d.metaDisplay.flash}` : 'Flash: --';
    const md = document.getElementById('meta-date'); if (md) md.innerText = d.metaDisplay.date ? `Date: ${d.metaDisplay.date}` : 'Date: --';
    document.getElementById('exportFilename').value = "";
}

function updateFilmstrip() {
    const s = document.getElementById('thumbnailStrip');
    s.innerHTML = '';
    document.getElementById('imgCount').innerText = state.images.length;

    // Show or hide navigation arrows
    const prevBtn = document.getElementById('prevImgBtn');
    const nextBtn = document.getElementById('nextImgBtn');
    if (state.images.length > 1) {
        if (prevBtn) prevBtn.classList.remove('hidden');
        if (nextBtn) nextBtn.classList.remove('hidden');
    } else {
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
    }

    state.images.forEach((d, i) => {
        const div = document.createElement('div');
        const sel = i === state.currentIndex;
        div.className = `relative h-full w-auto shrink-0 cursor-pointer rounded-lg overflow-hidden transition-all duration-200 group ${sel ? 'ring-2 ring-white opacity-100 shadow-lg scale-105 z-10' : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'}`;
        div.onclick = () => selectImage(i);

        const delBtn = document.createElement('button');
        delBtn.className = "absolute top-1 right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-20 shadow-sm";
        delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        delBtn.onclick = (e) => deleteImage(i, e);

        const t = document.createElement('img');
        t.src = d.thumbUrl;
        t.className = "h-full w-auto object-contain";
        div.appendChild(t);
        div.appendChild(delBtn);
        s.appendChild(div);
    });
    refreshIcons();
}

function deleteImage(index, event) {
    if (event) event.stopPropagation();
    if (!confirm("Remove this image?")) return;
    state.images.splice(index, 1);
    if (state.images.length === 0) { state.currentIndex = -1; clearPhotosUI(); }
    else { if (state.currentIndex >= index) { state.currentIndex = Math.max(0, state.currentIndex - 1); } selectImage(state.currentIndex); }
}

function nextImage(e) {
    if (e) e.stopPropagation();
    if (state.images.length === 0) return;
    let nextIdx = state.currentIndex + 1;
    if (nextIdx >= state.images.length) nextIdx = 0;
    selectImage(nextIdx);
}

function prevImage(e) {
    if (e) e.stopPropagation();
    if (state.images.length === 0) return;
    let prevIdx = state.currentIndex - 1;
    if (prevIdx < 0) prevIdx = state.images.length - 1;
    selectImage(prevIdx);
}

function clearFilmstrip() {
    if (state.images.length === 0) return;
    if (!confirm("Clear all?")) return;
    state.images = [];
    state.currentIndex = -1;
    clearPhotosUI();
}

function clearPhotosUI() {
    document.getElementById('thumbnailStrip').innerHTML = `<div class="text-xs opacity-40 w-full text-center pt-6 font-bold" data-i18n="noPhotos">${translations[state.lang].noPhotos}</div>`;
    document.getElementById('imgCount').innerText = '0';
    document.getElementById('emptyState').classList.remove('hidden');
    const canvas = getCanvas();
    if (canvas) canvas.classList.add('hidden');
    document.getElementById('bg-layer').style.opacity = '0';
    setTimeout(() => { document.getElementById('bg-layer').style.backgroundImage = 'none'; }, 800);
    document.querySelectorAll('[id^="meta-"]').forEach(el => el.innerText = '--');
    const i = ['inp-make', 'inp-model', 'inp-lens', 'inp-focal', 'inp-aperture', 'inp-shutter', 'inp-iso', 'inp-date'];
    i.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function updateBackground(img) {
    const bg = document.getElementById('bg-layer');
    if (!img) { bg.style.opacity = '0'; return; }
    const c = document.createElement('canvas');
    c.width = 100; c.height = 100;
    c.getContext('2d').drawImage(img, 0, 0, 100, 100);
    bg.style.backgroundImage = `url(${c.toDataURL()})`;
    bg.style.opacity = '1';
}

function resetAll() {
    if (!confirm("Reset?")) return;
    if (state.currentIndex !== -1) {
        state.images[state.currentIndex].config = JSON.parse(JSON.stringify(defaultConfig));
        if (state.images[state.currentIndex].autoLogo) {
            state.images[state.currentIndex].config.logo.img = state.images[state.currentIndex].autoLogo;
            state.images[state.currentIndex].config.logo.useImage = true;
        }
        selectImage(state.currentIndex);
    } else {
        resetState();
        clearPhotosUI();
    }
    const i = ['inp-make', 'inp-model', 'inp-lens', 'inp-focal', 'inp-aperture', 'inp-shutter', 'inp-iso', 'inp-date'];
    i.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    updateLanguageUI();
    refreshIcons();
}

function setLanguage(lang) { updateState('lang', lang); updateLanguageUI(); }
function updateLanguageUI() {
    const t = translations[state.lang];
    document.querySelectorAll('.lang-opt').forEach(el => el.classList.remove('active'));
    const opts = document.querySelectorAll('.lang-opt');
    if (state.lang === 'en') opts[0].classList.add('active');
    if (state.lang === 'jp') opts[1].classList.add('active');
    if (state.lang === 'cn') opts[2].classList.add('active');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });
    document.getElementById('templateName').placeholder = t.tplPlaceholder;
    document.getElementById('exportFilename').placeholder = t.filePlaceholder;
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    if (state.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    updateThemeIcon();
    render();
}
function updateThemeIcon() { document.getElementById('themeBtn').innerHTML = state.theme === 'dark' ? '<i data-lucide="sun" class="w-4 h-4"></i>' : '<i data-lucide="moon" class="w-4 h-4"></i>'; refreshIcons(); }
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

// --- XHS Modal Control ---
function showXHSPrompt() {
    const modal = document.getElementById('xhsModal');
    const content = document.getElementById('xhsModalContent');
    if (modal && content) {
        modal.classList.remove('hidden');
        // trigger reflow
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('opacity-0', 'scale-95');
        content.classList.add('scale-100');
    }
}

function hideXHSPrompt() {
    const modal = document.getElementById('xhsModal');
    const content = document.getElementById('xhsModalContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // match transition duration
    }
}

async function loadSystemFonts() {
    if (!isElectron()) return;
    try {
        const fonts = await ipc.invoke('query-local-fonts');
        if (!fonts || !Array.isArray(fonts)) return;

        // Fonts are already deduplicated and sorted in main process now
        const select = document.getElementById('fontSelector');

        // Keep first 3 static options (Default, Serif, Mono)
        // Check if separator exists, if not add it
        // Simpler: Cleart everything after index 2
        while (select.options.length > 3) { select.remove(3); }

        const sep = document.createElement('option'); sep.disabled = true; sep.text = "--- System Fonts ---"; select.add(sep);

        fonts.forEach(fontObj => {
            const opt = document.createElement('option');
            opt.value = fontObj.family;
            opt.text = fontObj.family;
            // Fallback font logic is handled in CSS/Canvas, here we just select the name.
            select.add(opt);
        });

        const customOpt = document.createElement('option'); customOpt.value = "custom"; customOpt.text = "Custom Font..."; customOpt.setAttribute('data-i18n', 'fontCustom'); select.add(customOpt);
    } catch (err) { console.error("Font error:", err); }
}

// === FILE INPUT BINDINGS (CRITICAL) ===
const fileInput = document.getElementById('fileInput');
if (fileInput) {
    fileInput.addEventListener('change', (e) => FileManager.handleFileSelect(e, selectImage, updateFilmstrip));
}

const logoInput = document.getElementById('logoInput');
if (logoInput) {
    logoInput.addEventListener('change', (e) => LogoManager.handleLogoUpload(e));
}

const im = { 'inp-make': 'make', 'inp-model': 'model', 'inp-lens': 'lens', 'inp-focal': 'focal', 'inp-aperture': 'aperture', 'inp-shutter': 'shutter', 'inp-iso': 'iso', 'inp-date': 'date' };
Object.keys(im).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', (e) => {
        if (state.currentIndex === -1) return;
        state.images[state.currentIndex].userEdit[im[id]] = e.target.value;
        render();
    });
});

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
else { setTimeout(() => { if (document.getElementById('mainCanvas')) init(); }, 50); }
window.addEventListener('load', init);
