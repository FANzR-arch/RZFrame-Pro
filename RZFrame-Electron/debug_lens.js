const fs = require('fs');
const exifParser = require('exif-parser');

const filePath = 'C:/Users/Van Phoil/.gemini/antigravity/brain/b4e7e597-5e55-4d73-a6d4-691cf28c8435/uploaded_image_1_1764928123711.jpg';

try {
    const buffer = fs.readFileSync(filePath);
    const parser = exifParser.create(buffer);
    const result = parser.parse();

    console.log("--- Tags ---");
    console.log(JSON.stringify(result.tags, null, 2));
} catch (e) {
    console.error("Error parsing EXIF:", e);
}
