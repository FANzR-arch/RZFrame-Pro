/*
[INPUT]  : None (Initial State)
[OUTPUT] : Global Application State object
[POS]    : Core State Management Module
[DECISION]: Uses a singleton 'state' object for simplicity instead of Redux/Context, suitable for small to medium scale apps.
*/

// src/core/state.js

export const defaultConfig = {
    template: 'classic',
    font: 'Inter',
    radius: 30,
    frameColor: 'white',
    fontColor: 'auto',
    fontScale: 1.0,
    borderScale: 1.0,
    aspectRatio: 'original',
    bgBrightness: 0.6,
    logo: {
        useImage: false,
        img: null,
        scale: 1.0,
        invert: false
    },
    layout: {
        padding: 40,
        bottomHeight: 120,
        left: { x: 0.05, y: 0, align: 'left' },
        right: { x: 0.95, y: 0, align: 'right' }
    },
    imageScale: 1.0,
    imageOffset: { x: 0, y: 0 }
};

export const state = {
    images: [], // Array of { file, thumbUrl, metaDisplay, userEdit, autoLogo, config: {...} } 
    // ^ Changed: REMOVED 'imgObj' from here to prevent OOM
    currentIndex: -1,
    // Global UI state
    savedTemplates: [],
    theme: 'light',
    lang: 'en',
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    canvas: null,
    ctx: null
};

// --- Memory Management: Single Active Image ---
// Only hold ONE high-res image in memory at a time.
let activeHighResImage = null;

export function setActiveImage(img) {
    activeHighResImage = img;
}

export function getActiveImage() {
    return activeHighResImage;
}

// ------------------------------------------

export function resetState() {
    const savedTemplates = state.savedTemplates;
    const theme = state.theme;
    const lang = state.lang;

    state.images = [];
    state.currentIndex = -1;
    activeHighResImage = null; // Clear high-res ref

    state.savedTemplates = savedTemplates;
    state.theme = theme;
    state.lang = lang;
}

export function updateState(key, value) {
    state[key] = value;
}

export const getState = () => state;
