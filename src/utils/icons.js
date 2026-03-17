/*
[INPUT]  : lucide library imports
[OUTPUT] : SVG Icon instances injected into DOM
[POS]    : UI Asset Loader
[DECISION]: Local fallback implementation instead of CDN to ensure 100% offline capability.
*/
// Lucide Icons Loader - Local Fallback
// This script loads icons reliably without CDN dependency

import { createIcons, icons } from 'lucide';

// Export for window global access
window.initLucideIcons = function () {
    createIcons({ icons });
    console.log("Lucide icons initialized (local)");
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initLucideIcons);
} else {
    window.initLucideIcons();
}

export { createIcons, icons };
