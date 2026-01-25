/*
[INPUT]  : File objects (from input/drag-drop), Electron IPC
[OUTPUT] : Populated state.images array with metadata
[POS]    : UI layer - handles all file import operations
[DECISION]: Centralized file handling for maintainability. Uses streaming via rz-local protocol to avoid memory issues with high-res images.
*/

import { state, defaultConfig } from '../core/state.js';
import { ipc, isElectron } from '../utils/ipc.js';
import { translations } from '../locales/translations.js';
import { getLogoFilename } from '../config/brands.js';

let logosPath = 'assets/logos';

export function setLogosPath(path) {
    logosPath = path;
}

// --- File Selection & Processing ---

export async function handleFileSelect(event, selectImageCallback, updateFilmstripCallback) {
    console.log("handleFileSelect triggered");
    const files = Array.from(event.target.files);
    console.log("Files selected:", files.length);
    await processFiles(files, selectImageCallback, updateFilmstripCallback);
    event.target.value = ''; // Reset input
}

export async function processFiles(files, selectImageCallback, updateFilmstripCallback) {
    if (files.length === 0) return;
    console.log("processFiles starting");

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        console.log("Showing overlay...");
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.zIndex = '9999';
        overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');

        document.getElementById('loadPercent').innerText = '0';
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            const t = translations[state.lang];
            loadingText.innerText = `${t.importingPrefix}${files.length}${t.importingSuffix}`;
        }
    } else {
        console.error("Overlay element not found!");
    }

    await new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                console.log("UI updated, starting processing");
                resolve();
            });
        });
    });

    let loadedCount = 0;
    const total = files.length;

    const processNext = async (index) => {
        if (index >= total) {
            console.log("All files processed");
            if (state.currentIndex === -1 && state.images.length > 0) {
                selectImageCallback(0);
            } else {
                updateFilmstripCallback();
            }

            if (overlay) {
                console.log("Hiding overlay");
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.add('hidden');
                    overlay.style.zIndex = '';
                }, 300);
            }
            return;
        }

        const file = files[index];
        try {
            await processNewImage(file);
        } catch (err) {
            console.error("Error processing file:", file.name, err);
        }

        loadedCount++;
        if (overlay) {
            document.getElementById('loadPercent').innerText = Math.round((loadedCount / total) * 100);
            const loadingText = document.getElementById('loadingText');
            if (loadingText) {
                const t = translations[state.lang];
                loadingText.innerText = `${t.importingPrefix}${loadedCount}/${total}${t.importingSuffix}`;
            }
        }

        setTimeout(() => processNext(index + 1), 20);
    };

    processNext(0);
}

// --- Drag & Drop ---

export function setupDragAndDrop(processFilesCallback) {
    const body = document.body;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        body.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        document.getElementById('emptyState')?.classList.add('border-blue-500', 'bg-blue-50/10');
    }

    function unhighlight(e) {
        document.getElementById('emptyState')?.classList.remove('border-blue-500', 'bg-blue-50/10');
    }

    body.addEventListener('drop', handleDrop, false);

    async function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
        await processFilesCallback(files);
    }
}

// --- Image Processing (Memory Safe) ---

async function processNewImage(file) {
    return new Promise(async (resolve) => {
        let srcPath = '';
        if (isElectron()) {
            srcPath = `rz-local:///${file.path.replace(/\\/g, '/')}`;
        } else {
            srcPath = URL.createObjectURL(file);
        }

        const img = new Image();
        img.onload = async () => {
            const thumbUrl = createThumbnail(img);

            const imgData = {
                file: file,
                thumbUrl: thumbUrl,
                metaDisplay: {},
                userEdit: {},
                autoLogo: null,
                config: JSON.parse(JSON.stringify(defaultConfig))
            };

            if (isElectron()) {
                try {
                    const result = await ipc.invoke('analyze-exif', file.path);
                    console.log("EXIF:", result);
                    const tags = result.tags || {};
                    const lensInfo = result.lensName || "Lens Info";
                    const make = (tags.Make || 'Unknown').replace(/\0/g, '');
                    const model = (tags.Model || 'Unknown').replace(/\0/g, '');

                    let dateStr = '--'; // Declare dateStr variable
                    const rawDate = tags.DateTimeOriginal || tags.DateTime || tags.CreateDate;
                    if (rawDate) {
                        if (typeof rawDate === 'object' && rawDate.year) {
                            const pad = (n) => n.toString().padStart(2, '0');
                            dateStr = `${rawDate.year}.${pad(rawDate.month)}.${pad(rawDate.day)}`;
                            if (rawDate.hour !== undefined) {
                                dateStr += ` ${pad(rawDate.hour)}:${pad(rawDate.minute)}:${pad(rawDate.second)}`;
                            }
                        } else {
                            // Try to parse string format "YYYY:MM:DD HH:MM:SS"
                            // If it matches standard Exif format
                            const parts = String(rawDate).match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                            if (parts) {
                                dateStr = `${parts[1]}.${parts[2]}.${parts[3]} ${parts[4]}:${parts[5]}:${parts[6]}`;
                            } else {
                                // Fallback to old behavior (YY:MM:DD)
                                dateStr = String(rawDate).split(' ')[0].replace(/:/g, '.');
                            }
                        }
                    }

                    const isoVal = tags.ISO || tags.ISOSpeedRatings || '--';

                    imgData.metaDisplay = {
                        filename: file.name,
                        filesize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                        dimensions: `${img.width} x ${img.height}`,
                        make: make,
                        model: model,
                        lens: lensInfo,
                        software: tags.Software || '--',
                        date: dateStr,
                        focal: tags.FocalLength ? `${parseFloat(tags.FocalLength)}mm` : '--',
                        aperture: tags.FNumber ? `f/${tags.FNumber}` : '--',
                        shutter: tags.ExposureTime ? (tags.ExposureTime < 1 ? `1/${Math.round(1 / tags.ExposureTime)}` : `${tags.ExposureTime}"`) : '--',
                        iso: isoVal,
                        flash: tags.Flash === undefined ? '--' : (tags.Flash & 1 ? 'Fired' : 'Off')
                    };

                    let modelClean = imgData.metaDisplay.model || '';
                    if (modelClean.includes('ILCE-7RM2')) modelClean = 'Sony A7R II';
                    if (modelClean.includes('ILCE-7RM5')) modelClean = 'Sony A7R V';

                } catch (e) {
                    console.error("Exif parsing failed", e);
                }
            }

            // Ensure userEdit is populated
            const safeMeta = imgData.metaDisplay || {};
            imgData.userEdit = {
                make: safeMeta.make || '',
                model: safeMeta.model || '',
                lens: safeMeta.lens || '',
                focal: safeMeta.focal || '',
                aperture: safeMeta.aperture || '',
                shutter: safeMeta.shutter || '',
                iso: safeMeta.iso || '',
                date: safeMeta.date || ''
            };

            // FALLBACK: If IPC Exif failed (empty make), try Frontend EXIF.js
            if ((!imgData.userEdit.make || imgData.userEdit.make === 'Unknown') && window.EXIF) {
                console.log("Attempting Frontend EXIF fallback...");
                await new Promise(resolveExif => {
                    EXIF.getData(file, function () {
                        const tags = EXIF.getAllTags(this);
                        if (tags && tags.Make) {
                            console.log("Frontend EXIF found:", tags);

                            // DEBUG: Log all tags to file to inspect Lens info visibility
                            try {
                                ipc.send('log-message', {
                                    level: 'DEBUG',
                                    message: 'Frontend EXIF Tags:',
                                    data: {
                                        Make: tags.Make,
                                        Model: tags.Model,
                                        Lens: tags.Lens,
                                        LensModel: tags.LensModel,
                                        LensInfo: tags.LensInfo,
                                        // Dump a few raw keys to see if we missed something
                                        keys: Object.keys(tags)
                                    }
                                });
                            } catch (e) { }

                            const cleanStr = (s) => String(s || '').replace(/\0/g, '').trim();

                            const make = cleanStr(tags.Make);
                            const model = cleanStr(tags.Model);
                            const iso = tags.ISOSpeedRatings || tags.ISO || '';
                            const fNum = tags.FNumber ? `f/${tags.FNumber}` : '';
                            const focal = tags.FocalLength ? `${Math.round(tags.FocalLength)}mm` : '';
                            const shutter = tags.ExposureTime ? (tags.ExposureTime < 1 ? `1/${Math.round(1 / tags.ExposureTime)}` : `${tags.ExposureTime}"`) : '';

                            // Try to get Lens info (often available in newer exif.js versions or some files)
                            // Note: standard EXIF doesn't always have LensModel, it might be inside MakerNote which exif.js has limited support for.
                            const lens = cleanStr(tags.LensModel) || cleanStr(tags.LensInfo) || cleanStr(tags.Lens) || '';
                            // Only update lens if frontend found valid data AND backend didn't already provide it
                            if (lens && (!imgData.metaDisplay.lens || imgData.metaDisplay.lens === 'Lens Info')) {
                                imgData.metaDisplay.lens = lens;
                                imgData.userEdit.lens = lens;
                            }

                            // Date Format: "YYYY:MM:DD HH:MM:SS" -> "YYYY.MM.DD HH:MM:SS"
                            let dateStr = cleanStr(tags.DateTimeOriginal || tags.DateTime);
                            if (dateStr) {
                                const parts = dateStr.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                                if (parts) dateStr = `${parts[1]}.${parts[2]}.${parts[3]} ${parts[4]}:${parts[5]}:${parts[6]}`;
                                else dateStr = dateStr.replace(/:/g, '.').split(' ')[0];
                            }

                            // Update metaDisplay - only override if backend data is missing
                            if (make && !imgData.metaDisplay.make) imgData.metaDisplay.make = make;
                            if (model && !imgData.metaDisplay.model) imgData.metaDisplay.model = model;
                            if (iso && !imgData.metaDisplay.iso) imgData.metaDisplay.iso = iso;
                            if (fNum && !imgData.metaDisplay.aperture) imgData.metaDisplay.aperture = fNum;
                            if (focal && !imgData.metaDisplay.focal) imgData.metaDisplay.focal = focal;
                            if (shutter && !imgData.metaDisplay.shutter) imgData.metaDisplay.shutter = shutter;
                            if (dateStr && !imgData.metaDisplay.date) imgData.metaDisplay.date = dateStr;

                            // Update userEdit - only override if backend data is missing
                            if (make && !imgData.userEdit.make) imgData.userEdit.make = make;
                            if (model && !imgData.userEdit.model) imgData.userEdit.model = model;
                            if (iso && !imgData.userEdit.iso) imgData.userEdit.iso = iso;
                            if (fNum && !imgData.userEdit.aperture) imgData.userEdit.aperture = fNum;
                            if (focal && !imgData.userEdit.focal) imgData.userEdit.focal = focal;
                            if (shutter && !imgData.userEdit.shutter) imgData.userEdit.shutter = shutter;
                            if (dateStr && !imgData.userEdit.date) imgData.userEdit.date = dateStr;

                            // Sony Model Clean Fix
                            if (model.includes('ILCE-7RM2')) imgData.userEdit.model = 'Sony A7R II';
                            if (model.includes('ILCE-7RM5')) imgData.userEdit.model = 'Sony A7R V';
                        }
                        resolveExif();
                    });
                });
            }

            // Auto Logo
            if (isElectron()) {
                try {
                    const autoLogo = await tryLoadBrandLogo(imgData.userEdit.make);
                    if (autoLogo) {
                        imgData.autoLogo = autoLogo;
                        imgData.config.logo.img = autoLogo;
                        imgData.config.logo.useImage = true;
                    }
                } catch (logoErr) {
                    console.error("Logo load failed", logoErr);
                }
            }

            state.images.push(imgData);

            resolve();
        };
        img.onerror = (e) => {
            console.error("Failed to load image for processing", e);
            resolve();
        };
        img.src = srcPath;
    });
}

function createThumbnail(img) {
    const c = document.createElement('canvas');
    const h = 200;
    const a = img.width / img.height;
    c.height = h;
    c.width = h * a;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
}

function tryLoadBrandLogo(make) {
    return new Promise((resolve) => {
        if (!make) { resolve(null); return; }
        const filename = getLogoFilename(make);

        if (!filename) {
            resolve(null);
            return;
        }

        const logoPath = `rz-local:///${logosPath}/${filename}.png`;
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = logoPath;
    });
}
