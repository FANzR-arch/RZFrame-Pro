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
