const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'js');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'api.js');

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;
  
  if (content.includes("'http://localhost:5000/api")) {
    content = content.replace(/'http:\/\/localhost:5000\/api/g, 'window.API_BASE + \'');
    changed = true;
  }
  if (content.includes('`http://localhost:5000/api')) {
    content = content.replace(/`http:\/\/localhost:5000\/api/g, '`${window.API_BASE}');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(p, content);
    console.log(`Updated ${f}`);
  }
});
