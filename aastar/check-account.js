const { createPublicClient, http, parseAbi } = require("viem");

const RPC_URL = process.env.ETH_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const ACCOUNT_ADDRESS = "0x975961302a83090B1eb94676E1430B5baCa43F9E";

// Simple Account ABI - just the owner() function
const ACCOUNT_ABI = parseAbi([
  "function owner() view returns (address)",
  "function signer() view returns (address)",
]);

async function checkAccount() {
  const client = createPublicClient({ transport: http(RPC_URL) });

  // Check if contract is deployed (viem returns undefined when there is no code)
  const code = await client.getCode({ address: ACCOUNT_ADDRESS });
  const deployed = !!code && code !== "0x";
  console.log("Contract deployed:", deployed);
  console.log("Code length:", code ? code.length : 0);

  if (deployed) {
    try {
      const owner = await client.readContract({
        address: ACCOUNT_ADDRESS,
        abi: ACCOUNT_ABI,
        functionName: "owner",
      });
      console.log("Owner address:", owner);
    } catch (e) {
      console.log("No owner() function or error:", e.message);
    }

    try {
      const signer = await client.readContract({
        address: ACCOUNT_ADDRESS,
        abi: ACCOUNT_ABI,
        functionName: "signer",
      });
      console.log("Signer address:", signer);
    } catch (e) {
      console.log("No signer() function or error:", e.message);
    }
  }
}

checkAccount().catch(console.error);
