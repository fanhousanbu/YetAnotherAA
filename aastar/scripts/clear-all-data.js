#!/usr/bin/env node

const { Client } = require("pg");

async function clearAllData() {
  // Database configuration
  const config = {
    host: process.env.DB_HOST || "pg-d2q5tcidbo4c73bqon6g-a.frankfurt-postgres.render.com",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || "aastar_db_svx7_user",
    password: process.env.DB_PASSWORD || "QM9T1wKW38zCQBVIbwtpHZGsmF3Tn7gq",
    database: process.env.DB_NAME || "aastar_db_svx7",
    ssl: {
      rejectUnauthorized: false,
    },
  };

  const client = new Client(config);

  try {
    // Connect to database
    await client.connect();
    console.log("🔗 Connected to PostgreSQL database");
    console.log(`📍 Host: ${config.host}`);
    console.log(`📦 Database: ${config.database}`);
    console.log("");

    // Show current data count
    console.log("📊 Current data count:");
    const tables = ["users", "accounts", "transfers", "passkeys", "bls_config"];
    const counts = {};

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        counts[table] = result.rows[0].count;
        console.log(`   ${table}: ${result.rows[0].count} rows`);
      } catch (error) {
        console.log(`   ${table}: table not found`);
      }
    }

    console.log("");

    // Ask for confirmation
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise(resolve => {
      readline.question("⚠️  WARNING: This will DELETE ALL DATA! Type 'yes' to confirm: ", resolve);
    });

    readline.close();

    if (answer.toLowerCase() !== "yes") {
      console.log("❌ Operation cancelled");
      await client.end();
      return;
    }

    console.log("");
    console.log("🗑️  Clearing all data...");

    // Clear all tables in the correct order (child tables first to avoid foreign key constraints)
    const queries = [
      "TRUNCATE TABLE passkeys RESTART IDENTITY CASCADE;",
      "TRUNCATE TABLE transfers RESTART IDENTITY CASCADE;",
      "TRUNCATE TABLE accounts RESTART IDENTITY CASCADE;",
      "TRUNCATE TABLE users RESTART IDENTITY CASCADE;",
      "TRUNCATE TABLE bls_config RESTART IDENTITY CASCADE;",
    ];

    for (const query of queries) {
      const tableName = query.match(/TRUNCATE TABLE (\w+)/)[1];
      try {
        await client.query(query);
        console.log(`   ✅ Cleared ${tableName}`);
      } catch (error) {
        console.log(`   ⚠️  Failed to clear ${tableName}: ${error.message}`);
      }
    }

    console.log("");
    console.log("📊 Verifying tables are empty:");

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = result.rows[0].count;
        const icon = count === "0" ? "✅" : "❌";
        console.log(`   ${icon} ${table}: ${count} rows`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: could not verify`);
      }
    }

    console.log("");
    console.log("✨ Database cleanup completed!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log("🔌 Disconnected from database");
  }
}

// Check if running directly
if (require.main === module) {
  clearAllData().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { clearAllData };
