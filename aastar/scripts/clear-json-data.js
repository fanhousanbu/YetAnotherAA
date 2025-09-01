#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

async function clearJsonData() {
  // Find data directory
  const possiblePaths = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "aastar", "data"),
    path.join(__dirname, "..", "data"),
    path.join(__dirname, "..", "..", "data"),
  ];

  let dataDir = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      dataDir = possiblePath;
      break;
    }
  }

  if (!dataDir) {
    console.error("❌ Data directory not found");
    process.exit(1);
  }

  console.log("🔗 Found JSON data directory");
  console.log(`📍 Path: ${dataDir}`);
  console.log("");

  // JSON files to clear
  const jsonFiles = [
    "users.json",
    "accounts.json",
    "transfers.json",
    "passkeys.json",
    "bls-config.json",
  ];

  // Show current data count
  console.log("📊 Current data count:");
  const counts = {};

  for (const file of jsonFiles) {
    const filePath = path.join(dataDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const count = Array.isArray(data) ? data.length : 1;
      counts[file] = count;
      console.log(`   ${file}: ${count} ${count === 1 ? "entry" : "entries"}`);
    } catch (error) {
      console.log(`   ${file}: not found or empty`);
      counts[file] = 0;
    }
  }

  console.log("");

  // Ask for confirmation
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise(resolve => {
    readline.question(
      "⚠️  WARNING: This will DELETE ALL JSON DATA! Type 'yes' to confirm: ",
      resolve
    );
  });

  readline.close();

  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Operation cancelled");
    return;
  }

  console.log("");
  console.log("🗑️  Clearing all JSON data...");

  // Clear each JSON file
  for (const file of jsonFiles) {
    const filePath = path.join(dataDir, file);
    try {
      if (file === "bls-config.json") {
        // For bls-config, write default config instead of empty array
        const defaultConfig = {
          signerNodes: {
            nodes: [],
            totalNodes: 0,
            activeNodes: 0,
          },
          discovery: {
            seedNodes: [],
            fallbackEndpoints: [],
          },
          lastUpdated: new Date().toISOString(),
        };
        fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2));
      } else {
        // For other files, write empty array
        fs.writeFileSync(filePath, "[]");
      }
      console.log(`   ✅ Cleared ${file}`);
    } catch (error) {
      console.log(`   ⚠️  Failed to clear ${file}: ${error.message}`);
    }
  }

  console.log("");
  console.log("📊 Verifying files are empty:");

  for (const file of jsonFiles) {
    const filePath = path.join(dataDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const count = Array.isArray(data) ? data.length : Object.keys(data).length > 0 ? 1 : 0;
      const icon = count === 0 || file === "bls-config.json" ? "✅" : "❌";
      console.log(`   ${icon} ${file}: ${count} ${count === 1 ? "entry" : "entries"}`);
    } catch (error) {
      console.log(`   ⚠️  ${file}: could not verify`);
    }
  }

  console.log("");
  console.log("✨ JSON data cleanup completed!");
}

// Check if running directly
if (require.main === module) {
  clearJsonData().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { clearJsonData };
