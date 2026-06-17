import os
import re

os.makedirs('d:/Downloadan/sampah/frontend/views', exist_ok=True)

with open('d:/Downloadan/sampah/frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix script tag
content = content.replace('<script src="app.js"></script>', '<script src="js/app.js"></script>')

blocks = content.split('\n<!-- ===================== ')
new_index = blocks[0]

for block in blocks[1:]:
    # Filter out footer sections
    if block.startswith('MODALS') or block.startswith('ROLE') or block.startswith('FLOATING'):
        new_index += '\n<!-- ===================== ' + block
        continue
        
    match = re.search(r'<div id="screen-([a-zA-Z0-9-]+)"', block)
    if match:
        screen_id = match.group(1)
        # Remove 'active' class so elements are hidden by default when fetched
        clean_block = block.replace('class="screen active"', 'class="screen"')
        with open(f'd:/Downloadan/sampah/frontend/views/{screen_id}.html', 'w', encoding='utf-8') as f:
            f.write('<!-- ===================== ' + clean_block)
    else:
        new_index += '\n<!-- ===================== ' + block

with open('d:/Downloadan/sampah/frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(new_index)

print("Split successful!")
