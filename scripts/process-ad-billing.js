// scripts/process-ad-billing.js
// This script should be run periodically (e.g., via a cron job) to process ad impressions
// and create transactions for CPM-based pricing models

import pool from "../lib/db.js";

async function processDailyBilling() {
  console.log("Starting daily ad billing process...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN ");

    // Get all CPM-based ads with impressions in the last day
    const cpmAds = await client.query(`
      SELECT 
        a.id,
        a.advertiser_id,
        a.cost_per_thousand_impressions,
        aa.impressions,
        aa.date,
        aa.cost
      FROM advertisements a
      JOIN ad_analytics aa ON a.id = aa.advertisement_id
      WHERE a.pricing_model = 'cpm'
        AND a.status = 'approved'
        AND aa.date = CURRENT_DATE
        AND aa.cost = 0  -- Only process if not already billed
    `);

    console.log(`Found ${cpmAds.rows.length} CPM ads to process`);

    for (const ad of cpmAds.rows) {
      if (ad.impressions === 0) continue;

      // Calculate cost: (impressions / 1000) * cost_per_thousand_impressions
      const cost = (ad.impressions / 1000) * ad.cost_per_thousand_impressions;

      // Update analytics with cost
      await client.query(
        `UPDATE ad_analytics 
         SET cost = $1
         WHERE advertisement_id = $2 AND date = $3`,
        [cost, ad.id, ad.date]
      );

      // Create transaction record
      await client.query(
        `INSERT INTO ad_transactions 
         (advertiser_id, advertisement_id, transaction_type, amount, description, billing_period_start, billing_period_end, transaction_date)
         VALUES ($1, $2, 'impression', $3, $4, $5, $6, NOW())`,
        [
          ad.advertiser_id,
          ad.id,
          cost,
          `CPM charges for ${ad.impressions} impressions on ${ad.date}`,
          ad.date,
          ad.date,
        ]
      );

      console.log(`Processed CPM billing for ad ${ad.id}: ${ad.impressions} impressions, cost: ${cost.toFixed(2)} kr`);
    }

    await client.query("COMMIT");
    console.log("Daily billing process completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error processing daily billing:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the billing process
processDailyBilling()
  .then(() => {
    console.log("Billing process finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
