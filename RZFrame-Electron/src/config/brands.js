/*
[INPUT]  : Camera Make string
[OUTPUT] : Logo filename
[POS]    : Configuration Data
[DECISION]: Static mapping table for brand normalization.
*/

// 品牌 LOGO 映射配置
export const brandConfigs = {
    // Brand name (lowercase) -> filename in assets/logos (without extension)
    mappings: {
        'phase one': 'Phase_One',
        'pentax': 'Pentax',
        'hasselblad': 'hasselblad',
        'leica': 'leica',
        'fujifilm': 'fujifilm',
        'olympus': 'olympus',
        'panasonic': 'panasonic',
        'ricoh': 'ricoh',
        'sigma': 'sigma',
        'sony': 'sony',
        'canon': 'canon',
        'nikon': 'nikon',
        'dji': 'dji',
        'gopro': 'gopro'
    }
};

export function getLogoFilename(make) {
    if (!make) return null;
    const cleanMake = make.toLowerCase().trim();

    for (const key in brandConfigs.mappings) {
        if (cleanMake.includes(key)) {
            return brandConfigs.mappings[key];
        }
    }

    // Fallback: remove 'corporation' and punctuation
    return cleanMake.replace(/corporation/g, '').replace(/\./g, '').trim().split(' ')[0];
}
