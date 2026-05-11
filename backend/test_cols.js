const pool = require('./src/db/pool');

async function run() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'issue_media'");
    console.log("issue_media columns:", res.rows.map(r => r.column_name));
    
    const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'issues'");
    console.log("issues columns:", res2.rows.map(r => r.column_name));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
