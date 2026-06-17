const fs = require('fs');
const path = require('path');

const dir = 'd:/Downloadan/sampah/frontend/views';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

let content = fs.readFileSync('d:/Downloadan/sampah/frontend/index.html', 'utf8');

// Fix script tag
content = content.replace('<script src="app.js"></script>', '<script src="js/app.js"></script>');

const blocks = content.split('\n<!-- ===================== ');
let new_index = blocks[0];

for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.startsWith('MODALS') || block.startsWith('ROLE') || block.startsWith('FLOATING')) {
        new_index += '\n<!-- ===================== ' + block;
        continue;
    }
    
    const match = block.match(/<div id="screen-([a-zA-Z0-9-]+)"/);
    if (match) {
        const screen_id = match[1];
        const clean_block = block.replace('class="screen active"', 'class="screen"');
        fs.writeFileSync(`d:/Downloadan/sampah/frontend/views/${screen_id}.html`, '<!-- ===================== ' + clean_block);
    } else {
        new_index += '\n<!-- ===================== ' + block;
    }
}

fs.writeFileSync('d:/Downloadan/sampah/frontend/index.html', new_index);
console.log("Split successful!");
