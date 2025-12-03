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
    images: [], // Array of { file, imgObj, thumbUrl, metaDisplay, userEdit, autoLogo, config: {...} }
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

export function resetState() {
    const savedTemplates = state.savedTemplates;
    const theme = state.theme;
    const lang = state.lang;

    state.images = [];
    state.currentIndex = -1;
    state.savedTemplates = savedTemplates;
    state.theme = theme;
    state.lang = lang;
}

export function updateState(key, value) {
    state[key] = value;
}

export const getState = () => state;
