// src/ui/events.js
import { state, updateState } from '../core/state.js';
import { render, getCanvas } from '../core/canvas.js';
import { ipc, isElectron } from '../utils/ipc.js';

let isDragging = false;
let dragTarget = null;
let dragStartPos = { x: 0, y: 0 };
let dragStartLayout = { x: 0, y: 0 };
let dragStartOffset = { x: 0, y: 0 };

export function setupCanvasListeners() {
    const canvas = getCanvas();
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
        if (state.currentIndex === -1) return;
        const config = state.images[state.currentIndex].config;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const w = canvas.width; const h = canvas.height;

        let hitRadiusX = w * 0.2; let hitRadiusY = h * 0.1;
        const lx = config.layout.left.x * w;
        const rx = config.layout.right.x * w;
        const ly = (config.template === 'float' ? h - (h * 0.05) : h - (h * 0.06)) + config.layout.left.y * h;
        const ry = (config.template === 'float' ? h - (h * 0.05) : h - (h * 0.06)) + config.layout.right.y * h;

        if (Math.abs(x - lx) < hitRadiusX && Math.abs(y - ly) < hitRadiusY) {
            isDragging = true; dragTarget = 'left';
            dragStartPos = { x: e.clientX, y: e.clientY }; dragStartLayout = { ...config.layout.left };
        }
        else if (Math.abs(x - rx) < hitRadiusX && Math.abs(y - ry) < hitRadiusY) {
            isDragging = true; dragTarget = 'right';
            dragStartPos = { x: e.clientX, y: e.clientY }; dragStartLayout = { ...config.layout.right };
        }
        else if (config.aspectRatio !== 'original') {
            isDragging = true;
            dragTarget = 'image';
            dragStartPos = { x: e.clientX, y: e.clientY };
            dragStartOffset = { ...config.imageOffset };
            canvas.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || state.currentIndex === -1) return;
        const config = state.images[state.currentIndex].config;
        const rect = canvas.getBoundingClientRect();
        const w = canvas.width; const h = canvas.height;
        const scaleX = w / rect.width; const scaleY = h / rect.height;
        const dx = (e.clientX - dragStartPos.x) * scaleX;
        const dy = (e.clientY - dragStartPos.y) * scaleY;

        if (dragTarget === 'image') {
            config.imageOffset.x = dragStartOffset.x + dx;
            config.imageOffset.y = dragStartOffset.y + dy;
            requestAnimationFrame(render);
        } else {
            let newXPct = dragStartLayout.x + dx / w;
            newXPct = Math.max(0.02, Math.min(0.98, newXPct));
            let newYPct = dragStartLayout.y + dy / h;
            if (Math.abs(newXPct - 0.05) < 0.02) newXPct = 0.05;
            else if (Math.abs(newXPct - 0.5) < 0.02) newXPct = 0.5;
            else if (Math.abs(newXPct - 0.95) < 0.02) newXPct = 0.95;
            if (Math.abs(newYPct) < 0.015) newYPct = 0;
            config.layout[dragTarget].x = newXPct;
            config.layout[dragTarget].y = newYPct;
            requestAnimationFrame(render);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            canvas.style.cursor = 'move';
            if (dragTarget !== 'image' && state.currentIndex !== -1) {
                const config = state.images[state.currentIndex].config;
                const t = config.layout[dragTarget];
                if (t.x < 0.1) { t.align = 'left'; }
                else if (t.x > 0.9) { t.align = 'right'; }
                else if (Math.abs(t.x - 0.5) < 0.1) { t.align = 'center'; }
            }
            isDragging = false; dragTarget = null; render();
        }
    });
}

export function handleWindowControl(action) {
    if (isElectron()) {
        ipc.send(action);
    }
}
