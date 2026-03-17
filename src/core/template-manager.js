/*
[INPUT]  : User selections from UI, state.images configuration
[OUTPUT] : Updated config for aspect ratios, templates, styles
[POS]    : Core layer - template and layout configuration
[DECISION]: Centralized template logic for easier extension and maintenance.
*/

import { state, getActiveImage } from './state.js';
import { render, getCanvas } from './canvas.js';

export function setTemplate(t) {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    config.template = t;

    ['classic', 'cinema', 'float'].forEach(id => {
        const b = document.getElementById(`btn-${id}`);
        if (id === t) b.classList.add('active');
        else b.classList.remove('active');
    });

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

    config.layout.left.y = 0;
    config.layout.right.y = 0;
    render();
}

export function setAspectRatio(ratio) {
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

        // FIX: Use getActiveImage instead of deleted imgObj property
        const img = getActiveImage();
        if (!img) {
            console.warn("No active image loaded, cannot calculate aspect ratio");
            return;
        }
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

export function toggleRatioOrientation() {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;

    if (config.aspectRatio === 'original') return;
    const parts = config.aspectRatio.split(':');
    if (parts.length !== 2) return;
    const newRatio = `${parts[1]}:${parts[0]}`;

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
        const opt = document.createElement('option');
        opt.value = newRatio;
        opt.text = `${newRatio} (Swapped)`;
        select.add(opt);
        select.value = newRatio;
    }

    setAspectRatio(newRatio);
}

export function updateImageScale(val) {
    if (state.currentIndex === -1) return;
    state.images[state.currentIndex].config.imageScale = parseFloat(val) / 100;
    document.getElementById('imgScaleVal').innerText = val + '%';
    render();
}

export function updateConfig(key, val) {
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

export function setFont(v) {
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

export function renderTemplateList() {
    const list = document.getElementById('templateList');
    if (!list) return;
    
    list.innerHTML = '';
    if (!state.savedTemplates || state.savedTemplates.length === 0) {
        list.innerHTML = `<div class="text-[10px] opacity-40 text-center py-6 italic font-medium" data-i18n="noSavedTpl">Empty</div>`;
        return;
    }

    state.savedTemplates.forEach((tpl, index) => {
        const div = document.createElement('div');
        div.className = "group flex items-center justify-between p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/5";
        
        const nameDiv = document.createElement('div');
        nameDiv.className = "flex-1 text-xs font-bold truncate pr-3 opacity-80 group-hover:opacity-100 transition";
        nameDiv.innerText = tpl.name;
        nameDiv.onclick = () => RZApp.loadTemplate(tpl.id);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = "flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0";
        
        const delBtn = document.createElement('button');
        delBtn.className = "w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition";
        delBtn.title = "Delete";
        delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`;
        delBtn.onclick = (e) => {
            e.stopPropagation();
            RZApp.deleteTemplate(tpl.id);
        };
        
        const exportBtn = document.createElement('button');
        exportBtn.className = "w-7 h-7 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-500/10 transition";
        exportBtn.title = "Export";
        exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;
        exportBtn.onclick = (e) => {
            e.stopPropagation();
            RZApp.exportTemplate(tpl.id);
        };
        
        actionsDiv.appendChild(exportBtn);
        actionsDiv.appendChild(delBtn);
        
        div.appendChild(nameDiv);
        div.appendChild(actionsDiv);
        
        list.appendChild(div);
    });
}

export function loadTemplate(id) {
    if (state.currentIndex === -1) return;
    const tpl = state.savedTemplates.find(t => t.id === id);
    if (!tpl) return;
    
    // Merge config
    const currentConfig = state.images[state.currentIndex].config;
    // Don't overwrite logo image if it already has one, or maybe just copy the primitive properties?
    // Let's copy everything except the logo image object
    const newConfig = JSON.parse(JSON.stringify(tpl.config));
    newConfig.logo.img = currentConfig.logo.img; // keep current logo image
    
    state.images[state.currentIndex].config = newConfig;
    
    // Sync UI (this should be handled by a function in renderer.js, but since we are in TemplateManager, 
    // we can either call a callback or just re-select current image.
    // However, renderer.js is exposing RZApp. It means we could trigger RZApp.syncUIWithConfig?
    // Or just re-trigger selectImage in renderer. 
    // We'll dispatch a custom event or let renderer handle it.
    
    // Simplest way: RZApp.reselectCurrentImage()
    if (window.RZApp && window.RZApp.reselectCurrentImage) {
        window.RZApp.reselectCurrentImage();
    }
}


export function setCustomFont(v) {
    if (state.currentIndex === -1) return;
    if (v) {
        state.images[state.currentIndex].config.font = v;
        render();
    }
}

export function applySettingsToAll() {
    if (state.currentIndex === -1 || state.images.length <= 1) return;
    if (!confirm("Apply current style to all photos?")) return;

    const sourceConfig = state.images[state.currentIndex].config;

    state.images.forEach((img, idx) => {
        if (idx === state.currentIndex) return;
        const newConfig = JSON.parse(JSON.stringify(sourceConfig));

        // Smart Logo Handling (Fix: Don't overwrite brand logos)
        const sourceImg = state.images[state.currentIndex];
        // Identify if source is using its auto-detected brand logo
        const sourceUsingAuto = sourceImg.autoLogo && (sourceConfig.logo.img === sourceImg.autoLogo);

        if (sourceUsingAuto && img.autoLogo) {
            // If source is using auto-logo, let the target use ITS OWN auto-logo but with source's sizing/style
            newConfig.logo.img = img.autoLogo;
        } else {
            // Otherwise (Custom logo or no logo), copy the source's logo image (e.g. Watermark)
            newConfig.logo.img = sourceConfig.logo.img;
        }

        img.config = newConfig;
    });

    alert("Settings applied to all photos!");
}
