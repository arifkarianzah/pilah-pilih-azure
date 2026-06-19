const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  if (content.includes("datetime('now')")) {
    content = content.replace(/datetime\('now'\)/g, 'NOW()');
    changed = true;
  }
  if (content.includes('datetime("now")')) {
    content = content.replace(/datetime\("now"\)/g, 'NOW()');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + f);
  }
});
