const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database/pilahpilih.db');

db.all("SELECT * FROM user_profiles", (err, rows) => {
  if (err) console.error(err);
  else console.log("USER_PROFILES:", rows);
});
db.all("SELECT id, name, email, role FROM users", (err, rows) => {
  if (err) console.error(err);
  else console.log("USERS:", rows);
});
