/*
[INPUT]  : User interactions (logo upload, brand mode toggle)
[OUTPUT] : Updated logo configuration in state
[POS]    : UI layer - manages brand logo display and customization
[DECISION]: Extracted logo logic for easier maintenance and to reduce renderer.js complexity.
*/

import { state } from '../core/state.js';
import { render } from '../core/canvas.js';

export function toggleBrandMode(m) {
    if (state.currentIndex === -1) {
        // UI-only update for initial state
        const t = document.getElementById('modeTextBtn');
        const i = document.getElementById('modeImgBtn');
        const ti = document.getElementById('inp-make');
        const lc = document.getElementById('brandLogoControls');

        if (!t || !i || !ti || !lc) {
            console.warn("toggleBrandMode: Elements not found");
            return;
        }

        if (m === 'image') {
            t.classList.remove('active');
            i.classList.add('active');
            ti.classList.add('hidden');
            lc.classList.remove('hidden');
        } else {
            i.classList.remove('active');
            t.classList.add('active');
            lc.classList.add('hidden');
            ti.classList.remove('hidden');
        }
        return;
    }

    const config = state.images[state.currentIndex].config;
    config.logo.useImage = (m === 'image');

    const t = document.getElementById('modeTextBtn');
    const i = document.getElementById('modeImgBtn');
    const ti = document.getElementById('inp-make');
    const lc = document.getElementById('brandLogoControls');

    if (!t || !i || !ti || !lc) return;

    if (m === 'image') {
        t.classList.remove('active');
        i.classList.add('active');
        ti.classList.add('hidden');
        lc.classList.remove('hidden');
    } else {
        i.classList.remove('active');
        t.classList.add('active');
        lc.classList.add('hidden');
        ti.classList.remove('hidden');
    }

    render();
}

export function handleLogoUpload(event) {
    const f = event.target.files[0];
    if (!f) return;

    const r = new FileReader();
    r.onload = (ev) => {
        const i = new Image();
        i.onload = () => {
            if (state.currentIndex === -1) return;

            state.images[state.currentIndex].config.logo.img = i;
            state.images[state.currentIndex].config.logo.useImage = true;

            document.getElementById('logoPreview').src = ev.target.result;
            document.getElementById('logoPreview').classList.remove('hidden');
            document.getElementById('logoPlaceholderIcon').classList.add('hidden');

            updateLogoPreviewFilter();
            render();
        };
        i.src = ev.target.result;
    };
    r.readAsDataURL(f);
    event.target.value = '';
}

export function resetLogoUI() {
    if (state.currentIndex === -1) return;

    const config = state.images[state.currentIndex].config;
    config.logo.img = null;
    config.logo.invert = false;

    document.getElementById('logoPreview').classList.add('hidden');
    document.getElementById('logoPlaceholderIcon').classList.remove('hidden');
    document.getElementById('logoInput').value = '';
}

export function toggleLogoInvert() {
    if (state.currentIndex === -1) return;

    state.images[state.currentIndex].config.logo.invert =
        !state.images[state.currentIndex].config.logo.invert;

    updateLogoPreviewFilter();
    render();
}

export function updateLogoScale(v) {
    if (state.currentIndex === -1) return;

    state.images[state.currentIndex].config.logo.scale = v / 100;
    document.getElementById('scaleVal').innerText = v + '%';
    render();
}

export function updateLogoPreviewFilter() {
    if (state.currentIndex === -1) return;

    const config = state.images[state.currentIndex].config;
    const p = document.getElementById('logoPreview');
    const b = document.getElementById('invertBtn');

    if (config.logo.invert) {
        p.style.filter = 'invert(1)';
        b.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    } else {
        p.style.filter = 'none';
        b.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    }
}
