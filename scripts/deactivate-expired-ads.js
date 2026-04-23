// scripts/deactivate-expired-ads.js
// This script should be run daily to deactivate ads that have passed their end_date

import pool from "../lib/db.js";

async function deactivateExpiredAds() {
  console.log("Starting expired ads deactivation process...");

  try {
    const result = await pool.query(`
      UPDATE advertisements
      SET status = 'expired', is_published = false, updated_at = NOW()
      WHERE status = 'approved'
        AND is_published = true
        AND end_date < CURRENT_DATE
      RETURNING id, title, end_date
    `);

    console.log(`Deactivated ${result.rows.length} expired advertisements`);

    result.rows.forEach((row) => {
      console.log(`  - Ad ${row.id} (${row.title}) ended on ${row.end_date}`);
    });

    return result.rows.length;
  } catch (error) {
    console.error("Error deactivating expired ads:", error);
    throw error;
  }
}

// Run the deactivation process
deactivateExpiredAds()
  .then((count) => {
    console.log(`Deactivation process completed - ${count} ads updated`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
