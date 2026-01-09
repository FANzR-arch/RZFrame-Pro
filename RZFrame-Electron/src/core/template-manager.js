/*
[INPUT]  : User selections from UI, state.images configuration
[OUTPUT] : Updated config for aspect ratios, templates, styles
[POS]    : Core layer - template and layout configuration
[DECISION]: Centralized template logic for easier extension and maintenance.
*/

import { state } from './state.js';
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
        newConfig.logo.img = sourceConfig.logo.img;
        img.config = newConfig;
    });

    alert("Settings applied to all photos!");
}
