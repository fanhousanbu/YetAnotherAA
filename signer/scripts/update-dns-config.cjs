#!/usr/bin/env node

/**
 * Script to update DNS rebinding configuration from remote sources
 * Usage: node scripts/update-dns-config.js [--source url] [--output path]
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Default configuration sources
const CONFIG_SOURCES = [
  // You can add URLs to public blocklists here
  // Example: 'https://example.com/dns-rebinding-list.json'
];

// Built-in known suspicious domains
const KNOWN_SUSPICIOUS = {
  // Dynamic DNS services
  "xip.io": { reason: "Dynamic DNS - IP in hostname", risk: "high" },
  "nip.io": { reason: "Dynamic DNS - IP in hostname", risk: "high" },
  "sslip.io": { reason: "Dynamic DNS - IP in hostname", risk: "high" },

  // Local development aliases
  "lvh.me": { reason: "Localhost alias", risk: "medium" },
  "localtest.me": { reason: "Localhost alias", risk: "medium" },
  "vcap.me": { reason: "Cloud Foundry localhost", risk: "medium" },

  // Add new discoveries here
  "traefik.me": { reason: "Localhost alias for Traefik", risk: "medium" },
  "ngrok.io": { reason: "Tunneling service", risk: "high" },
  "localtunnel.me": { reason: "Tunneling service", risk: "high" },
};

// Pattern-based detection
const SUSPICIOUS_PATTERNS = [
  {
    pattern: "^\\d{1,3}-\\d{1,3}-\\d{1,3}-\\d{1,3}\\.",
    description: "IP address with dashes in subdomain",
    risk: "high",
  },
  {
    pattern: "^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.",
    description: "IP address as subdomain",
    risk: "high",
  },
  {
    pattern: "(^|\\.)ip\\d+\\.",
    description: 'Contains "ip" followed by numbers',
    risk: "medium",
  },
  {
    pattern: "\\.(local|internal|private|lan|home)\\.",
    description: "Internal network indicator",
    risk: "medium",
  },
];

async function fetchRemoteConfig(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        let data = "";
        res.on("data", chunk => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function updateConfig() {
  const args = process.argv.slice(2);
  const outputPath = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : path.join(__dirname, "../src/modules/gossip/dns-rebinding-config.json");

  // Start with existing config if it exists
  let existingConfig = {};
  if (fs.existsSync(outputPath)) {
    existingConfig = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  }

  // Build new config
  const config = {
    description: "DNS rebinding protection configuration",
    version: "1.1.0",
    lastUpdated: new Date().toISOString(),
    suspiciousDomains: [],
    suspiciousPatterns: SUSPICIOUS_PATTERNS,
    allowedDomains: existingConfig.allowedDomains || [],
    customRules: existingConfig.customRules || {
      allowSubdomainDepth: 5,
      blockNumericSubdomains: true,
      requireTLD: true,
    },
  };

  // Add known suspicious domains
  for (const [domain, info] of Object.entries(KNOWN_SUSPICIOUS)) {
    config.suspiciousDomains.push({
      domain,
      reason: info.reason,
      risk: info.risk,
    });
  }

  // Fetch and merge from remote sources
  if (args.includes("--source")) {
    const sourceUrl = args[args.indexOf("--source") + 1];
    try {
      console.log(`Fetching from ${sourceUrl}...`);
      const remoteConfig = await fetchRemoteConfig(sourceUrl);
      if (remoteConfig.suspiciousDomains) {
        config.suspiciousDomains.push(...remoteConfig.suspiciousDomains);
      }
    } catch (error) {
      console.error(`Failed to fetch remote config: ${error.message}`);
    }
  }

  // Remove duplicates
  const uniqueDomains = new Map();
  for (const item of config.suspiciousDomains) {
    uniqueDomains.set(item.domain, item);
  }
  config.suspiciousDomains = Array.from(uniqueDomains.values());

  // Sort by risk level
  config.suspiciousDomains.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    return (riskOrder[a.risk] || 2) - (riskOrder[b.risk] || 2);
  });

  // Write updated config
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  console.log(`✅ Updated DNS rebinding config at ${outputPath}`);
  console.log(`   Total suspicious domains: ${config.suspiciousDomains.length}`);
  console.log(`   Total patterns: ${config.suspiciousPatterns.length}`);
}

// Run update
updateConfig().catch(console.error);
