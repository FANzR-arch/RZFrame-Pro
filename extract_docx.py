
# [INPUT]  : .docx file path
# [OUTPUT] : Extracted text content printed to standard output
# [POS]    : Root directory utility script
# [DECISION]: Use native zipfile/xml to keep dependencies minimal (no python-docx)

import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def extract_text(docx_path):
    if not os.path.exists(docx_path):
        print(f"Error: File not found at {docx_path}")
        return

    try:
        with zipfile.ZipFile(docx_path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            # Namespace for Word
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text_parts = []
            for p in tree.findall('.//w:p', ns):
                paragraph_text = []
                for t in p.findall('.//w:t', ns):
                    if t.text:
                        paragraph_text.append(t.text)
                text_parts.append(''.join(paragraph_text))
            
            print('\n'.join(text_parts))
            
    except Exception as e:
        print(f"Error reading docx: {e}")

if __name__ == "__main__":
    extract_text(sys.argv[1])
