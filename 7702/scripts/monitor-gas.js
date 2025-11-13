#!/usr/bin/env node

/**
 * Gas Monitoring Tool for EIP-7702 System
 * Tracks gas costs, alerts on anomalies, and generates reports
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Configuration
const CONFIG = {
  rpcUrl: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
  factoryAddress: process.env.DELEGATION_FACTORY_ADDRESS,
  paymasterAddress: process.env.SPONSOR_PAYMASTER_ADDRESS,
  checkInterval: 60000, // 1 minute
  alertThresholds: {
    gasPrice: 50, // Gwei
    paymasterBalance: ethers.parseEther("0.1"), // 0.1 ETH
    dailyCost: ethers.parseEther("0.5"), // 0.5 ETH per day
  },
  logFile: path.join(__dirname, "../logs/gas-monitor.log"),
  reportFile: path.join(__dirname, "../logs/gas-report.json"),
};

// Initialize provider
const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);

// Data storage
let gasData = {
  startTime: Date.now(),
  measurements: [],
  alerts: [],
  totalGasUsed: 0n,
  totalCostWei: 0n,
  deploymentCount: 0,
  transactionCount: 0,
};

// Load existing data if available
function loadData() {
  try {
    if (fs.existsSync(CONFIG.reportFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.reportFile, "utf8"));
      gasData = {
        ...gasData,
        ...data,
        measurements: data.measurements || [],
        alerts: data.alerts || [],
      };
      console.log("✅ Loaded existing gas monitoring data");
    }
  } catch (error) {
    console.error("⚠️  Failed to load existing data:", error.message);
  }
}

// Save data
function saveData() {
  try {
    const dir = path.dirname(CONFIG.reportFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.reportFile, JSON.stringify(gasData, null, 2));
  } catch (error) {
    console.error("❌ Failed to save data:", error.message);
  }
}

// Log to file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    const dir = path.dirname(CONFIG.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(CONFIG.logFile, logMessage);
  } catch (error) {
    console.error("Failed to write to log file:", error.message);
  }
}

// Send alert
function sendAlert(type, message, severity = "info") {
  const alert = {
    timestamp: Date.now(),
    type,
    message,
    severity, // info, warning, critical
  };

  gasData.alerts.push(alert);

  const emoji = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
  }[severity];

  log(`${emoji} ALERT [${type}]: ${message}`);

  // TODO: Integrate with Discord/Telegram/Email notifications
  // For now, just log
}

// Check current gas price
async function checkGasPrice() {
  try {
    const feeData = await provider.getFeeData();
    const gasPriceGwei = Number(ethers.formatUnits(feeData.gasPrice, "gwei"));

    const measurement = {
      timestamp: Date.now(),
      gasPrice: gasPriceGwei,
      maxFeePerGas: feeData.maxFeePerGas ? Number(ethers.formatUnits(feeData.maxFeePerGas, "gwei")) : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        ? Number(ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei"))
        : null,
    };

    gasData.measurements.push(measurement);

    // Keep only last 1000 measurements
    if (gasData.measurements.length > 1000) {
      gasData.measurements = gasData.measurements.slice(-1000);
    }

    log(
      `📊 Gas Price: ${gasPriceGwei.toFixed(2)} Gwei | Max Fee: ${measurement.maxFeePerGas?.toFixed(2) || "N/A"} Gwei`,
    );

    // Check alert threshold
    if (gasPriceGwei > CONFIG.alertThresholds.gasPrice) {
      sendAlert("HIGH_GAS_PRICE", `Gas price ${gasPriceGwei.toFixed(2)} Gwei exceeds threshold`, "warning");
    }

    return measurement;
  } catch (error) {
    log(`❌ Failed to check gas price: ${error.message}`);
    return null;
  }
}

// Check Paymaster balance
async function checkPaymasterBalance() {
  if (!CONFIG.paymasterAddress || CONFIG.paymasterAddress === "undefined") {
    log("⚠️  Paymaster address not configured, skipping balance check");
    return null;
  }

  try {
    const balance = await provider.getBalance(CONFIG.paymasterAddress);
    const balanceEth = Number(ethers.formatEther(balance));

    log(`💰 Paymaster Balance: ${balanceEth.toFixed(4)} ETH`);

    // Check alert threshold
    if (balance < CONFIG.alertThresholds.paymasterBalance) {
      sendAlert("LOW_PAYMASTER_BALANCE", `Paymaster balance ${balanceEth.toFixed(4)} ETH is low`, "critical");
    }

    return {
      balance: balance.toString(),
      balanceEth,
    };
  } catch (error) {
    log(`❌ Failed to check Paymaster balance: ${error.message}`);
    return null;
  }
}

// Monitor recent transactions
async function monitorRecentTransactions() {
  try {
    const latestBlock = await provider.getBlockNumber();
    const block = await provider.getBlock(latestBlock, true);

    if (!block || !block.transactions) {
      return;
    }

    // Filter transactions involving our contracts
    const relevantTxs = [];

    for (const tx of block.transactions) {
      if (typeof tx === "string") continue;

      if (
        tx.to === CONFIG.factoryAddress ||
        tx.to === CONFIG.paymasterAddress ||
        tx.from === CONFIG.paymasterAddress
      ) {
        relevantTxs.push(tx);
      }
    }

    if (relevantTxs.length > 0) {
      log(`🔍 Found ${relevantTxs.length} relevant transaction(s) in block ${latestBlock}`);

      for (const tx of relevantTxs) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (receipt) {
          const gasUsed = receipt.gasUsed;
          const gasPrice = receipt.gasPrice || tx.gasPrice || 0n;
          const gasCost = gasUsed * gasPrice;

          gasData.totalGasUsed += gasUsed;
          gasData.totalCostWei += gasCost;
          gasData.transactionCount++;

          log(
            `  📝 TX ${tx.hash.slice(0, 10)}... | Gas Used: ${gasUsed.toString()} | Cost: ${ethers.formatEther(gasCost)} ETH`,
          );
        }
      }
    }
  } catch (error) {
    log(`❌ Failed to monitor transactions: ${error.message}`);
  }
}

// Generate statistics
function generateStats() {
  const now = Date.now();
  const runtime = now - gasData.startTime;
  const runtimeHours = runtime / (1000 * 60 * 60);
  const runtimeDays = runtime / (1000 * 60 * 60 * 24);

  // Calculate average gas price
  const avgGasPrice =
    gasData.measurements.length > 0
      ? gasData.measurements.reduce((sum, m) => sum + m.gasPrice, 0) / gasData.measurements.length
      : 0;

  // Calculate min/max gas price
  const gasPrices = gasData.measurements.map((m) => m.gasPrice);
  const minGasPrice = gasPrices.length > 0 ? Math.min(...gasPrices) : 0;
  const maxGasPrice = gasPrices.length > 0 ? Math.max(...gasPrices) : 0;

  const stats = {
    runtime: {
      milliseconds: runtime,
      hours: runtimeHours.toFixed(2),
      days: runtimeDays.toFixed(2),
    },
    gasPrice: {
      current: gasData.measurements[gasData.measurements.length - 1]?.gasPrice || 0,
      average: avgGasPrice.toFixed(2),
      min: minGasPrice.toFixed(2),
      max: maxGasPrice.toFixed(2),
    },
    usage: {
      totalGasUsed: gasData.totalGasUsed.toString(),
      totalCostWei: gasData.totalCostWei.toString(),
      totalCostEth: ethers.formatEther(gasData.totalCostWei),
      transactionCount: gasData.transactionCount,
      averageCostPerTx: gasData.transactionCount > 0 ? ethers.formatEther(gasData.totalCostWei / BigInt(gasData.transactionCount)) : "0",
    },
    alerts: {
      total: gasData.alerts.length,
      critical: gasData.alerts.filter((a) => a.severity === "critical").length,
      warning: gasData.alerts.filter((a) => a.severity === "warning").length,
      info: gasData.alerts.filter((a) => a.severity === "info").length,
    },
  };

  return stats;
}

// Print statistics
function printStats() {
  const stats = generateStats();

  console.log("\n📊 ====== GAS MONITORING STATISTICS ======");
  console.log(`⏰ Runtime: ${stats.runtime.hours} hours (${stats.runtime.days} days)`);
  console.log(`\n⛽ Gas Price:`);
  console.log(`  Current: ${stats.gasPrice.current} Gwei`);
  console.log(`  Average: ${stats.gasPrice.average} Gwei`);
  console.log(`  Min: ${stats.gasPrice.min} Gwei`);
  console.log(`  Max: ${stats.gasPrice.max} Gwei`);
  console.log(`\n💸 Gas Usage:`);
  console.log(`  Total Gas Used: ${stats.usage.totalGasUsed}`);
  console.log(`  Total Cost: ${stats.usage.totalCostEth} ETH`);
  console.log(`  Transactions: ${stats.usage.transactionCount}`);
  console.log(`  Avg Cost/TX: ${stats.usage.averageCostPerTx} ETH`);
  console.log(`\n🚨 Alerts:`);
  console.log(`  Total: ${stats.alerts.total}`);
  console.log(`  Critical: ${stats.alerts.critical}`);
  console.log(`  Warning: ${stats.alerts.warning}`);
  console.log(`  Info: ${stats.alerts.info}`);
  console.log("========================================\n");
}

// Main monitoring loop
async function monitor() {
  log("🚀 Starting gas monitoring...");

  // Check gas price
  await checkGasPrice();

  // Check Paymaster balance
  await checkPaymasterBalance();

  // Monitor recent transactions
  await monitorRecentTransactions();

  // Save data
  saveData();
}

// Start monitoring
async function start() {
  log("🎯 Gas Monitor Initialized");
  log(`📡 RPC: ${CONFIG.rpcUrl}`);
  log(`🏭 Factory: ${CONFIG.factoryAddress || "Not configured"}`);
  log(`💳 Paymaster: ${CONFIG.paymasterAddress || "Not configured"}`);
  log(`⏱️  Check Interval: ${CONFIG.checkInterval / 1000}s`);

  // Load existing data
  loadData();

  // Run initial check
  await monitor();

  // Set up periodic monitoring
  setInterval(async () => {
    await monitor();
  }, CONFIG.checkInterval);

  // Print stats every hour
  setInterval(() => {
    printStats();
  }, 60 * 60 * 1000);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    log("\n👋 Shutting down gas monitor...");
    printStats();
    saveData();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("\n👋 Shutting down gas monitor...");
    printStats();
    saveData();
    process.exit(0);
  });
}

// CLI mode
if (require.main === module) {
  start().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  start,
  monitor,
  generateStats,
  CONFIG,
};
