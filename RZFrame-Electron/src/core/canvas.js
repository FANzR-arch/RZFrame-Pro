// src/core/canvas.js
import { state } from './state.js';

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

// --- CORE RENDER FUNCTION ---
export function render() {
    if (state.currentIndex === -1 || !canvas || !ctx) return;

    const imgData = state.images[state.currentIndex];
    const img = imgData.imgObj;
    const edit = imgData.userEdit;
    const config = imgData.config; // Use per-image config
    const w = img.width;
    const h = img.height;
    let padding = 0, footerH = 0;

    // 1. Calculate Padding/Footer
    if (config.template === 'classic') {
        padding = Math.round(Math.max(w, h) * 0.03 * config.borderScale);
        footerH = Math.round(h * 0.12 * config.borderScale);
        if (config.borderScale < 0.1 && config.borderScale > 0) footerH = Math.round(h * 0.05);
    }
    else if (config.template === 'cinema') { footerH = Math.round(h * 0.10 * config.borderScale); }
    else if (config.template === 'float') { padding = Math.round(Math.max(w, h) * 0.08 * config.borderScale); }
    if (footerH < h * 0.02 && config.template !== 'float') footerH = h * 0.02;

    // 2. Define Canvas Size & Mask Rect
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

    canvas.width = canvasW; canvas.height = canvasH;

    // 3. Prepare Colors
    let bgCol = '#ffffff', txtCol = '#000000', subCol = '#666666';
    if (config.template !== 'float') bgCol = config.frameColor === 'white' ? '#ffffff' : '#000000';
    if (config.fontColor === 'black') { txtCol = '#000000'; subCol = '#444444'; }
    else if (config.fontColor === 'white') { txtCol = '#ffffff'; subCol = config.template === 'float' ? 'rgba(255,255,255,0.8)' : '#bbbbbb'; }
    else { if (config.template === 'float') { txtCol = '#ffffff'; subCol = 'rgba(255,255,255,0.8)'; } else if (bgCol === '#ffffff') { txtCol = '#000000'; subCol = '#666666'; } else { txtCol = '#ffffff'; subCol = '#999999'; } }

    // 4. Draw Background
    if (config.template === 'float') {
        const cacheKey = `${img.src}_${canvasW}_${canvasH}_${config.bgBrightness}`;

        if (!blurCache.canvas || blurCache.key !== cacheKey) {
            const c = document.createElement('canvas');
            c.width = canvasW;
            c.height = canvasH;
            const ctxB = c.getContext('2d');

            const scale = 1.3;
            const bw = canvasW * scale;
            const bh = canvasH * scale;
            const bx = (canvasW - bw) / 2;
            const by = (canvasH - bh) / 2;

            ctxB.filter = `blur(60px) brightness(${config.bgBrightness})`;

            const imgRatio = w / h;
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

    }
    else { ctx.fillStyle = bgCol; ctx.fillRect(0, 0, canvasW, canvasH); }

    // 5. Draw Image (Clipped inside Mask)
    let drawW, drawH, imgX, imgY;
    if (config.aspectRatio === 'original') {
        drawW = w; drawH = h; imgX = maskX; imgY = maskY;
    } else {
        drawW = w * config.imageScale;
        drawH = h * config.imageScale;
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

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(img, Math.round(imgX), Math.round(imgY), Math.round(drawW), Math.round(drawH));
    ctx.restore();

    // 6. Draw Text / Footer
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

    ctx.textAlign = config.layout.left.align; ctx.textBaseline = 'middle';

    if (config.logo.useImage && config.logo.img) {
        const logo = config.logo.img;
        const scale = config.logo.scale;
        const maxLogoH = baseSize * 2.5;
        let drawH = Math.round(baseSize * 2 * scale);
        if (drawH > maxLogoH) drawH = maxLogoH;
        const drawW = Math.round(drawH * (logo.width / logo.height));
        const logoY = Math.round(baseY + lyOffset - drawH * 0.6);
        let drawX = lx; if (ctx.textAlign === 'center') drawX -= drawW / 2; if (ctx.textAlign === 'right') drawX -= drawW;
        drawX = Math.round(drawX);

        ctx.save();
        if (config.logo.invert) ctx.filter = 'invert(1)';
        ctx.drawImage(logo, drawX, logoY, drawW, drawH);
        ctx.restore();

        ctx.fillStyle = subCol;
        ctx.font = `700 ${Math.round(baseSize * 0.55)}px '${config.font}', sans-serif`;
        const textY = logoY + drawH + (baseSize * 0.5);
        ctx.fillText(edit.model.toUpperCase(), lx, textY);
    } else {
        ctx.fillStyle = txtCol; ctx.font = `900 ${Math.round(baseSize * 1.5)}px 'Cinzel', serif`;
        ctx.fillText(edit.make.toUpperCase(), lx, Math.round(baseY + lyOffset - baseSize * 0.4));
        ctx.fillStyle = subCol; ctx.font = `600 ${Math.round(baseSize * 0.6)}px '${config.font}', sans-serif`;
        ctx.fillText(edit.model, lx, Math.round(baseY + lyOffset + baseSize * 0.8));
    }

    ctx.textAlign = config.layout.right.align; ctx.fillStyle = txtCol; ctx.font = `500 ${baseSize}px 'Roboto Mono', monospace`; if (config.font !== 'Inter') ctx.font = `500 ${baseSize}px '${config.font}', monospace`;

    let paramParts = [];
    if (edit.focal && edit.focal !== '--') paramParts.push(edit.focal);
    if (edit.aperture && edit.aperture !== '--') paramParts.push(edit.aperture);
    if (edit.shutter && edit.shutter !== '--') paramParts.push(edit.shutter);
    if (edit.iso && edit.iso !== '--') paramParts.push('ISO' + edit.iso);

    const params = paramParts.join('  ');
    ctx.fillText(params, rx, Math.round(baseY + ryOffset - baseSize * 0.4));

    ctx.fillStyle = subCol;
    ctx.font = `400 ${Math.round(baseSize * 0.65)}px '${config.font}', sans-serif`;

    let subParts = [];
    if (edit.lens && edit.lens !== '--' && edit.lens !== 'Lens Info') subParts.push(edit.lens);
    if (edit.date && edit.date !== '--') subParts.push(edit.date);

    const sub = subParts.join('  |  ');
    ctx.fillText(sub, rx, Math.round(baseY + ryOffset + baseSize * 0.8));
}
