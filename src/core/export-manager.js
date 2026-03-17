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
import { renderTemplateList } from './template-manager.js';

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

    if (isElectron()) {
        const result = await ipc.invoke('template-save', template);
        if (!result || !result.success) {
            alert(`Failed to save template: ${result?.error || 'Unknown error'}`);
            return;
        }
        state.savedTemplates.push(template);
    } else {
        state.savedTemplates.push(template);
        localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
    }

    document.getElementById('templateName').value = '';
    renderTemplateList();
    alert(`Template "${name}" saved!`);
}

export async function deleteTemplate(id, e) {
    if (e) e.stopPropagation();
    if (!confirm("Delete this template?")) return;

    if (isElectron()) {
        const result = await ipc.invoke('template-delete', id);
        if (!result || !result.success) {
            alert(`Failed to delete template: ${result?.error || 'Unknown error'}`);
            return;
        }
    } else {
        state.savedTemplates = state.savedTemplates.filter(t => t.id !== id);
        localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
        renderTemplateList();
        return;
    }

    state.savedTemplates = state.savedTemplates.filter(t => t.id !== id);
    renderTemplateList();
}

export async function exportTemplate(id, e) {
    if (e) e.stopPropagation();
    const tpl = state.savedTemplates.find(t => t.id === id);
    if (!tpl) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tpl, null, 2));
    const fileName = `template_${tpl.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.rzf`;

    if (isElectron()) {
        try {
            await ipc.invoke('save-file-dialog', dataStr, fileName);
        } catch (err) { }
    } else {
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
}

export function importTemplates(inputElement) {
    if (!inputElement.files || inputElement.files.length === 0) return;

    const file = inputElement.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // Handle both single template or array of templates
            const templates = Array.isArray(data) ? data : [data];

            const validTemplates = [];
            for (const tpl of templates) {
                if (tpl.id && tpl.name && tpl.config) {
                    // Ensure unique ID
                    validTemplates.push({
                        id: Date.now() + Math.random(),
                        name: tpl.name,
                        config: tpl.config
                    });
                }
            }

            if (validTemplates.length > 0) {
                if (isElectron()) {
                    let addedCount = 0;
                    for (const tpl of validTemplates) {
                        try {
                            const result = await ipc.invoke('template-save', tpl);
                            if (result && result.success) {
                                state.savedTemplates.push(tpl);
                                addedCount++;
                            }
                        } catch (err) {
                            console.error("Failed to save imported template:", err);
                        }
                    }
                    if (addedCount === 0) {
                        alert("Failed to import templates. Please check folder permissions.");
                        inputElement.value = '';
                        return;
                    }
                    renderTemplateList();
                    alert(`Successfully imported ${addedCount} template(s)!`);
                } else {
                    state.savedTemplates.push(...validTemplates);
                    localStorage.setItem('exifFrame_templates', JSON.stringify(state.savedTemplates));
                    renderTemplateList();
                    alert(`Successfully imported ${validTemplates.length} template(s)!`);
                }
            } else {
                alert("Invalid template file format.");
            }
        } catch (err) {
            console.error("Failed to parse template file:", err);
            alert("Failed to read template file. It might be corrupted or not valid JSON.");
        }
        // Reset input so the same file can be imported again if needed
        inputElement.value = '';
    };

    reader.readAsText(file);
}
