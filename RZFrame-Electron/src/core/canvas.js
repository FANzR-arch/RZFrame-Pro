// src/core/canvas.js
import { state, getActiveImage } from './state.js';

let canvas;
let ctx;
let blurCache = { canvas: null, key: '' };

export const initCanvas = (canvasId) => {
    canvas = document.getElementById(canvasId);
    if (canvas) {
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }
    return canvas;
};

export const getCanvas = () => canvas;
export const getCtx = () => ctx;

// --- Helper: Load Image Async ---
// Used by renderer to load High-Res image on demand
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
}

// Polyfill for roundRect
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

// --- ATOMIZED RENDER FUNCTIONS ---

function drawBackground(ctx, canvasW, canvasH, img, config) {
    let bgCol = '#ffffff';
    if (config.template !== 'float') {
        bgCol = config.frameColor === 'white' ? '#ffffff' : '#000000';
    }

    if (config.template === 'float') {
        // Cached blur generation
        const cacheKey = `${img.src.length}_${canvasW}_${canvasH}_${config.bgBrightness}`;
        // Note: img.src might be a huge base64 or file path. Using length as simple hash proxy for perf.

        if (!blurCache.canvas || blurCache.key !== cacheKey) {
            const c = document.createElement('canvas');
            c.width = canvasW;
            c.height = canvasH;
            const ctxB = c.getContext('2d');

            const scale = 1.3;
            const bw = canvasW * scale;
            const bh = canvasH * scale;

            ctxB.filter = `blur(60px) brightness(${config.bgBrightness})`;

            // Cover fit logic
            const imgRatio = img.width / img.height;
            const canvasRatio = canvasW / canvasH;
            let drawBgW, drawBgH, drawBgX, drawBgY;

            if (imgRatio > canvasRatio) {
                drawBgH = canvasH * scale;
                drawBgW = drawBgH * imgRatio;
            } else {
                drawBgW = canvasW * scale;
                drawBgH = drawBgW / imgRatio;
            }
            drawBgX = (canvasW - drawBgW) / 2;
            drawBgY = (canvasH - drawBgH) / 2;

            ctxB.drawImage(img, drawBgX, drawBgY, drawBgW, drawBgH);

            blurCache.canvas = c;
            blurCache.key = cacheKey;
        }
        ctx.drawImage(blurCache.canvas, 0, 0);

    } else {
        ctx.fillStyle = bgCol;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }
}

function drawImageWithFrame(ctx, img, layout, config) {
    const { maskX, maskY, maskW, maskH, canvasW, canvasH } = layout;

    // Calculate Draw Dimensions
    let drawW, drawH, imgX, imgY;
    if (config.aspectRatio === 'original') {
        drawW = img.width;
        drawH = img.height;
        imgX = maskX;
        imgY = maskY;
    } else {
        drawW = img.width * config.imageScale;
        drawH = img.height * config.imageScale;
        imgX = maskX + (maskW - drawW) / 2 + config.imageOffset.x;
        imgY = maskY + (maskH - drawH) / 2 + config.imageOffset.y;
    }

    ctx.save();
    ctx.beginPath();

    if (config.template === 'float') {
        const rScale = Math.min(canvasW, canvasH) / 1000;
        const r = Math.round(config.radius * rScale);
        ctx.roundRect(maskX, maskY, maskW, maskH, r);

        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 20;
        ctx.fillStyle = "#000000";
        ctx.fill();
    } else {
        ctx.rect(maskX, maskY, maskW, maskH);
    }

    ctx.clip();

    // Reset shadow for image
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.drawImage(img, Math.round(imgX), Math.round(imgY), Math.round(drawW), Math.round(drawH));
    ctx.restore();
}

function drawInfoBar(ctx, layout, metaData, config, userEdit) {
    const { canvasW, canvasH, padding, footerH, maskY, maskH, w, h } = layout;

    // Determine colors
    let bgCol = '#ffffff', txtCol = '#000000', subCol = '#666666';
    if (config.template !== 'float') bgCol = config.frameColor === 'white' ? '#ffffff' : '#000000';
    if (config.fontColor === 'black') { txtCol = '#000000'; subCol = '#444444'; }
    else if (config.fontColor === 'white') { txtCol = '#ffffff'; subCol = config.template === 'float' ? 'rgba(255,255,255,0.8)' : '#bbbbbb'; }
    else {
        if (config.template === 'float') { txtCol = '#ffffff'; subCol = 'rgba(255,255,255,0.8)'; }
        else if (bgCol === '#ffffff') { txtCol = '#000000'; subCol = '#666666'; }
        else { txtCol = '#ffffff'; subCol = '#999999'; }
    }

    // Determine BaseY
    let baseY;
    if (config.template === 'float') baseY = maskY + maskH - (Math.max(w, h) * 0.02);
    else if (config.aspectRatio !== 'original') baseY = canvasH - (footerH / 2);
    else if (config.template === 'classic') baseY = h + padding + footerH / 2;
    else baseY = h + footerH / 2;

    const refDim = config.aspectRatio === 'original' ? h : canvasH;
    const baseSize = Math.round(Math.max(24, refDim * 0.018) * config.fontScale);

    const lx = Math.round(config.layout.left.x * canvasW);
    const rx = Math.round(config.layout.right.x * canvasW);
    const lyOffset = Math.round(config.layout.left.y * canvasH);
    const ryOffset = Math.round(config.layout.right.y * canvasH);

    // DRAW LEFT (Brand/Model)
    ctx.textAlign = config.layout.left.align;
    ctx.textBaseline = 'middle';

    if (config.logo.useImage && config.logo.img) {
        const logo = config.logo.img;
        const scale = config.logo.scale;
        const maxLogoH = baseSize * 2.5;
        let drawH = Math.round(baseSize * 2 * scale);
        if (drawH > maxLogoH) drawH = maxLogoH;
        const drawW = Math.round(drawH * (logo.width / logo.height));
        const logoY = Math.round(baseY + lyOffset - drawH * 0.6);
        let drawX = lx;
        if (ctx.textAlign === 'center') drawX -= drawW / 2;
        if (ctx.textAlign === 'right') drawX -= drawW;
        drawX = Math.round(drawX);

        ctx.save();
        if (config.logo.invert) ctx.filter = 'invert(1)';
        ctx.drawImage(logo, drawX, logoY, drawW, drawH);
        ctx.restore();

        // Model Name below logo
        ctx.fillStyle = subCol;
        ctx.font = `700 ${Math.round(baseSize * 0.55)}px '${config.font}', sans-serif`;
        const textY = logoY + drawH + (baseSize * 0.5);
        ctx.fillText(userEdit.model.toUpperCase(), lx, textY);
    } else {
        // Text Make
        ctx.fillStyle = txtCol;
        ctx.font = `900 ${Math.round(baseSize * 1.5)}px 'Cinzel', serif`;
        ctx.fillText(userEdit.make.toUpperCase(), lx, Math.round(baseY + lyOffset - baseSize * 0.4));

        // Text Model
        ctx.fillStyle = subCol;
        ctx.font = `600 ${Math.round(baseSize * 0.6)}px '${config.font}', sans-serif`;
        ctx.fillText(userEdit.model, lx, Math.round(baseY + lyOffset + baseSize * 0.8));
    }

    // DRAW RIGHT (Params)
    ctx.textAlign = config.layout.right.align;
    ctx.fillStyle = txtCol;
    ctx.font = `500 ${baseSize}px 'Roboto Mono', monospace`;
    if (config.font !== 'Inter') ctx.font = `500 ${baseSize}px '${config.font}', monospace`;

    let paramParts = [];
    if (userEdit.focal && userEdit.focal !== '--') paramParts.push(userEdit.focal);
    if (userEdit.aperture && userEdit.aperture !== '--') paramParts.push(userEdit.aperture);
    if (userEdit.shutter && userEdit.shutter !== '--') paramParts.push(userEdit.shutter);
    if (userEdit.iso && userEdit.iso !== '--') paramParts.push('ISO' + userEdit.iso);

    const params = paramParts.join('  ');
    ctx.fillText(params, rx, Math.round(baseY + ryOffset - baseSize * 0.4));

    // Sub Params (Lens/Date)
    ctx.fillStyle = subCol;
    ctx.font = `400 ${Math.round(baseSize * 0.65)}px '${config.font}', sans-serif`;

    let subParts = [];
    if (userEdit.lens && userEdit.lens !== '--' && userEdit.lens !== 'Lens Info') subParts.push(userEdit.lens);
    if (userEdit.date && userEdit.date !== '--') subParts.push(userEdit.date);

    const sub = subParts.join('  |  ');
    ctx.fillText(sub, rx, Math.round(baseY + ryOffset + baseSize * 0.8));
}

// --- MAIN SCHEDULER ---

export function render() {
    if (state.currentIndex === -1 || !canvas || !ctx) return;

    // MEMORY FIX: Use activeHighResImage from State
    const img = getActiveImage();
    if (!img) {
        console.warn("Render called but no Active Image loaded!");
        return;
    }

    const imgData = state.images[state.currentIndex];
    const userEdit = imgData.userEdit;
    const config = imgData.config;
    const w = img.width;
    const h = img.height;

    // --- Layout Calculations ---
    let padding = 0, footerH = 0;
    if (config.template === 'classic') {
        padding = Math.round(Math.max(w, h) * 0.03 * config.borderScale);
        footerH = Math.round(h * 0.12 * config.borderScale);
        if (config.borderScale < 0.1 && config.borderScale > 0) footerH = Math.round(h * 0.05);
    }
    else if (config.template === 'cinema') { footerH = Math.round(h * 0.10 * config.borderScale); }
    else if (config.template === 'float') { padding = Math.round(Math.max(w, h) * 0.08 * config.borderScale); }
    if (footerH < h * 0.02 && config.template !== 'float') footerH = h * 0.02;

    let canvasW, canvasH;
    let maskX, maskY, maskW, maskH;

    if (config.aspectRatio === 'original') {
        if (config.template === 'classic') {
            canvasW = w + padding * 2; canvasH = h + padding + footerH;
            maskX = padding; maskY = padding; maskW = w; maskH = h;
        }
        else if (config.template === 'cinema') {
            canvasH = h + footerH; canvasW = w;
            maskX = 0; maskY = 0; maskW = w; maskH = h;
        }
        else if (config.template === 'float') {
            canvasW = w + padding * 2; canvasH = h + padding * 2;
            maskX = padding; maskY = padding; maskW = w; maskH = h;
        }
    }
    else {
        const [rw, rh] = config.aspectRatio.split(':').map(Number);
        const targetRatio = rw / rh;
        const baseDim = Math.max(w, h) + (padding * 2);

        if (targetRatio > 1) { canvasW = baseDim; canvasH = baseDim / targetRatio; }
        else { canvasW = baseDim * targetRatio; canvasH = baseDim; }

        if (config.template === 'classic') {
            maskW = canvasW - (padding * 2); maskH = canvasH - (padding + footerH);
            maskX = padding; maskY = padding;
        } else if (config.template === 'cinema') {
            maskW = canvasW; maskH = canvasH - footerH;
            maskX = 0; maskY = 0;
        } else if (config.template === 'float') {
            maskW = canvasW - (padding * 2); maskH = canvasH - (padding * 2);
            maskX = padding; maskY = padding;
        }
        canvasW = Math.round(canvasW); canvasH = Math.round(canvasH);
        maskX = Math.round(maskX); maskY = Math.round(maskY); maskW = Math.round(maskW); maskH = Math.round(maskH);
    }

    const layout = { w, h, canvasW, canvasH, maskX, maskY, maskW, maskH, padding, footerH };

    // Update Canvas DOM size
    canvas.width = canvasW;
    canvas.height = canvasH;

    // --- Execution Pipeline ---
    drawBackground(ctx, canvasW, canvasH, img, config);
    drawImageWithFrame(ctx, img, layout, config);
    drawInfoBar(ctx, layout, null, config, userEdit); // Pass userEdit explicitly
}
