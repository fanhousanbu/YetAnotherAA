#!/usr/bin/env node
/**
 * 定期更新 SuperPaymaster 价格（threshold = 70分钟，建议每 50 分钟跑一次）
 * crontab example: run every 50 minutes, e.g. "0,50 * * * * node /path/to/this/script.js"
 */
const { createPublicClient, createWalletClient, http, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { sepolia } = require("viem/chains");
// Secrets come from the environment — never hard-code them (this is a public repo).
const PRIVATE_KEY = process.env.PRICE_UPDATER_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = process.env.ETH_RPC_URL;
if (!PRIVATE_KEY || !RPC_URL) {
  console.error('Set PRICE_UPDATER_PRIVATE_KEY (or PRIVATE_KEY) and ETH_RPC_URL in the environment.');
  process.exit(1);
}
const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
const publicClient = createPublicClient({ transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
const abi = parseAbi([
  'function updatePrice() external',
  'function priceStalenessThreshold() view returns (uint256)',
]);

const PAYMASTERS = [
  { name: 'PMv4', addr: '0xD0c82dc12B7d65b03dF7972f67d13F1D33469a98' },
  { name: 'SuperPaymaster', addr: '0x16cE0c7d846f9446bbBeb9C5a84A4D140fAeD94A' },
];

async function main() {
  const now = Math.floor(Date.now() / 1000);
  for (const { name, addr } of PAYMASTERS) {
    const { data: raw } = await publicClient.call({ to: addr, data: '0xf60fdcb3' });
    const ts = Number(BigInt('0x' + raw.slice(66, 130)));
    const threshold = Number(
      await publicClient.readContract({ address: addr, abi, functionName: 'priceStalenessThreshold' })
    );
    const age = now - ts;
    if (age > threshold * 0.8) { // 在 80% 阈值时提前更新
      const hash = await walletClient.writeContract({
        address: addr,
        abi,
        functionName: 'updatePrice',
        gas: 300000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[${new Date().toISOString()}] ${name} price updated, tx: ${hash}`);
    } else {
      console.log(`[${new Date().toISOString()}] ${name} ok, age: ${(age/60).toFixed(1)}min / ${(threshold/60).toFixed(1)}min`);
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
