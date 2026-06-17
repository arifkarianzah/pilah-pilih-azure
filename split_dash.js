const fs = require('fs');
const path = require('path');

const dir = 'frontend/views';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function splitFile(filename) {
    if (!fs.existsSync(filename)) {
        console.log("File not found: " + filename);
        return;
    }
    let content = fs.readFileSync(filename, 'utf8');
    const blocks = content.split('\n<!-- ==================== ');
    let new_index = blocks[0];
    
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const match = block.match(/<div id="page-([a-zA-Z0-9-]+)"/);
        if (match) {
            const screen_id = match[1];
            // Remove 'active' class so it doesn't show initially unless requested
            const clean_block = block.replace('class="page active"', 'class="page"').replace("class='page active'", "class='page'");
            fs.writeFileSync(`frontend/views/${screen_id}.html`, '<!-- ==================== ' + clean_block);
        } else {
            new_index += '\n<!-- ==================== ' + block;
        }
    }
    
    // Add app-root container before scripts/closing tags
    if (!new_index.includes('<div id="app-root">')) {
        new_index = new_index.replace('</body>', '  <div id="app-root"></div>\n</body>');
    }
    
    fs.writeFileSync(filename, new_index);
    console.log('Split ' + filename + ' successfully!');
}

splitFile('frontend/dashboard-user.html');
splitFile('frontend/dashboard-petugas.html');
splitFile('frontend/dashboard-admin.html');
