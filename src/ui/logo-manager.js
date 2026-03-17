/*
[INPUT]  : User interactions (logo upload, brand mode toggle), Auto-detection events
[OUTPUT] : Updated logo configuration in state, IPC calls to finding logos
[POS]    : UI layer - manages brand logo display, strategy, and customization
[DECISION]: Enhanced with multi-logo cycling and fallback to custom/text.
*/

import { state } from '../core/state.js';
import { render } from '../core/canvas.js';
import { ipc } from '../utils/ipc.js';
import { translations } from '../locales/translations.js';

// Debug Listener
if (window.require) {
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.on('logo-debug-info', (event, info) => {
        console.warn("[Backend Logo Debug]", info);
    });
}

// State for available logos for the current image
let availableLogos = [];
let currentLogoIndex = 0;

export async function autoMatchLogo(exifData) {
    if (!exifData || !exifData.Make) return;

    const brand = exifData.Make;


    // Reset state
    availableLogos = [];
    currentLogoIndex = 0;
    updateCycleButton();

    try {
        // 1. Try to find logos via Main Process (Builtin + Custom)
        const logos = await ipc.invoke('find-brand-logos', brand);

        if (logos && logos.length > 0) {

            availableLogos = logos;
            // Default: Prefer "Black" or valid connection, or just first one.
            // We use the first one as default
            updateLogoFromAvailable(0);
            toggleBrandMode('image');
        } else {
            console.warn(`No logos found for ${brand}.`);
            // 2. Fallback: Switch to text mode if no logo found
            toggleBrandMode('text');
        }
    } catch (e) {
        console.error("Auto match error:", e);
        toggleBrandMode('text');
    }
}

export function cycleLogo() {
    if (availableLogos.length <= 1) return;

    currentLogoIndex = (currentLogoIndex + 1) % availableLogos.length;
    updateLogoFromAvailable(currentLogoIndex);
}

function updateLogoFromAvailable(index) {
    if (!availableLogos[index]) return;

    const logo = availableLogos[index];


    const src = `rz-local:///${logo.path.replace(/\\/g, '/')}`;

    const img = new Image();
    img.onload = () => {
        if (state.currentIndex !== -1) {
            state.images[state.currentIndex].config.logo.img = img;
            state.images[state.currentIndex].config.logo.useImage = true;

            const p = document.getElementById('logoPreview');
            if (p) {
                p.src = src;
                p.classList.remove('hidden');
            }
            const ph = document.getElementById('logoPlaceholderIcon');
            if (ph) ph.classList.add('hidden');

            // Auto-invert check
            // DEBUG: Disable auto-invert for now to see if that's the issue
            /*
            if (logo.name.toLowerCase().includes('white')) {
                state.images[state.currentIndex].config.logo.invert = true;
            } else if (logo.name.toLowerCase().includes('black')) {
                state.images[state.currentIndex].config.logo.invert = false;
            }
            */
            // Reset invert to false when switching to ensure we see the raw logo first
            state.images[state.currentIndex].config.logo.invert = false;

            updateLogoPreviewFilter();
            render();
        }
    };
    img.src = src;

    updateCycleButton();
}

function updateCycleButton() {
    const btn = document.getElementById('btn-cycle-logo');
    if (btn) {
        if (availableLogos.length > 1) {
            btn.classList.remove('hidden');
            btn.title = `Cycle Logo (${currentLogoIndex + 1}/${availableLogos.length})`;
        } else {
            btn.classList.add('hidden');
        }
    }
}

export function importLogoFolder() {
    ipc.invoke('import-logo-folder').then(res => {
        if (res.success) {
            alert(`Successfully imported ${res.count} logos.`);
            // Re-trigger match for current image if possible
            if (state.currentIndex !== -1) {
                const img = state.images[state.currentIndex];
                if (img.exif && img.exif.Make) autoMatchLogo(img.exif);
            }
        } else if (res.error) {
            alert("Import failed: " + res.error);
        }
    });
}

// --- Specific/Manual Actions ---

export function toggleBrandMode(m) {
    const t = document.getElementById('modeTextBtn');
    const i = document.getElementById('modeImgBtn');
    const lc = document.getElementById('brandLogoControls');
    const ti = document.getElementById('inp-make');

    if (!t || !i) return; // UI elements might not be ready

    const isImage = (m === 'image');

    if (isImage) {
        t.classList.remove('active');
        i.classList.add('active');
        if (ti) ti.classList.add('hidden');
        if (lc) lc.classList.remove('hidden');
    } else {
        i.classList.remove('active');
        t.classList.add('active');
        if (lc) lc.classList.add('hidden');
        if (ti) ti.classList.remove('hidden');
    }

    // State update if image selected
    if (state.currentIndex !== -1) {
        state.images[state.currentIndex].config.logo.useImage = isImage;
        render();
    }
}

export function handleLogoUpload(event) {
    const f = event.target.files[0];
    if (!f) return;

    // Check if we want to save this as a custom logo for the brand
    // We only ask if we have valid EXIF data to associate it with
    let saveCustom = false;
    let currentMake = 'Unknown';

    if (state.currentIndex !== -1) {
        currentMake = state.images[state.currentIndex].exif?.Make;
        if (currentMake) {
            saveCustom = confirm(`Do you want to save this logo as a custom default for ${currentMake}?`);
        }
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        const i = new Image();
        i.onload = () => {
            if (state.currentIndex === -1) return;

            // Apply to current
            state.images[state.currentIndex].config.logo.img = i;
            state.images[state.currentIndex].config.logo.useImage = true;

            const p = document.getElementById('logoPreview');
            p.src = ev.target.result;
            p.classList.remove('hidden');
            document.getElementById('logoPlaceholderIcon').classList.add('hidden');

            // Persist if requested
            if (saveCustom && currentMake) {
                ipc.invoke('save-custom-logo', f.path, currentMake).then(res => {
                    if (res.success) {

                        // Add to availableLogos to allow cycling back to it
                        availableLogos.unshift({ name: 'Custom Upload', path: res.path, type: 'custom' });
                        currentLogoIndex = 0;
                        updateCycleButton();
                    }
                });
            }

            render();
        };
        i.src = ev.target.result;
    };
    reader.readAsDataURL(f);
    event.target.value = '';
}

export function resetLogoUI() {
    if (state.currentIndex === -1) return;

    const config = state.images[state.currentIndex].config;
    config.logo.img = null;
    config.logo.invert = false;

    // Reset UI
    const p = document.getElementById('logoPreview');
    if (p) p.classList.add('hidden');

    const ph = document.getElementById('logoPlaceholderIcon');
    if (ph) ph.classList.remove('hidden');

    const inp = document.getElementById('logoInput');
    if (inp) inp.value = '';

    availableLogos = [];
    updateCycleButton();
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
    const sv = document.getElementById('scaleVal');
    if (sv) sv.innerText = v + '%';
    render();
}

export function updateLogoPreviewFilter() {
    if (state.currentIndex === -1) return;
    const config = state.images[state.currentIndex].config;
    const p = document.getElementById('logoPreview');
    // const b = document.getElementById('invertBtn'); // If button exists

    if (p) {
        if (config.logo.invert) {
            p.style.filter = 'invert(1)';
        } else {
            p.style.filter = 'none';
        }
    }
}
