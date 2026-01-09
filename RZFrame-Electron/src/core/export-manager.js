/*
[INPUT]  : Canvas data, state.images, User save actions
[OUTPUT] : Downloaded images, batch exports
[POS]    : Core layer - handles all export operations
[DECISION]: Centralized export logic to enable easier testing and modification of save behavior.
*/

import { state } from './state.js';
import { getCanvas } from './canvas.js';
import { ipc, isElectron } from '../utils/ipc.js';
import { translations } from '../locales/translations.js';

export async function downloadImage() {
    if (state.currentIndex === -1) return;
    const customName = document.getElementById('exportFilename').value.trim();
    const originalName = state.images[state.currentIndex].file.name.split('.')[0];
    const fileName = customName ? `${customName}.jpg` : `${originalName}_ExifFrame.jpg`;
    const dataURL = getCanvas().toDataURL('image/jpeg', 0.95);

    if (isElectron()) {
        try {
            const result = await ipc.invoke('save-file-dialog', dataURL, fileName);
            if (result && result.success) showSaveFeedback();
        } catch (err) {
            alert("Save failed: " + err);
        }
    } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataURL;
        link.click();
        showSaveFeedback();
    }
}

export async function batchSave(selectImageCallback) {
    if (!isElectron()) {
        alert("Batch save is only available in desktop version.");
        return;
    }
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
            await selectImageCallback(i);
            await new Promise(r => setTimeout(r, 100));

            const originalName = state.images[i].file.name.split('.')[0];
            const sep = targetFolder.includes('/') ? '/' : '\\';
            const fileName = targetFolder.endsWith(sep)
                ? targetFolder + `${originalName}_ExifFrame.jpg`
                : targetFolder + sep + `${originalName}_ExifFrame.jpg`;

            const dataURL = getCanvas().toDataURL('image/jpeg', 0.95);
            await ipc.invoke('save-file-direct', fileName, dataURL);
            loadPercent.innerText = Math.round(((i + 1) / state.images.length) * 100);
        }
        alert(translations[state.lang].saveSuccess);
    } catch (err) {
        alert("Batch save failed: " + err);
    } finally {
        loader.classList.add('opacity-0');
        setTimeout(() => loader.classList.add('hidden'), 300);
        if (originalIndex !== -1) selectImageCallback(originalIndex);
    }
}

function showSaveFeedback() {
    const btn = document.querySelector('button[onclick="downloadImage()"]');
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> ${translations[state.lang].btnSaved}`;
    btn.classList.replace('bg-zinc-800', 'bg-green-500');
    btn.classList.replace('dark:bg-white', 'bg-green-500');

    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.classList.replace('bg-green-500', 'bg-zinc-800');
        btn.classList.replace('bg-green-500', 'dark:bg-white');
        if (window.lucide) window.lucide.createIcons();
    }, 2000);

    if (window.lucide) window.lucide.createIcons();
}

export async function saveCurrentTemplate() {
    if (state.currentIndex === -1) return;
    const name = document.getElementById('templateName').value.trim();
    if (!name) {
        alert("Please enter a template name");
        return;
    }

    const config = JSON.parse(JSON.stringify(state.images[state.currentIndex].config));
    config.logo.img = null; // Don't save image reference

    const template = {
        id: Date.now(),
        name: name,
        config: config
    };

    state.savedTemplates.push(template);

    if (isElectron()) {
        await ipc.invoke('template-save', template);
    } else {
        localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
    }

    document.getElementById('templateName').value = '';
    alert(`Template "${name}" saved!`);
}
