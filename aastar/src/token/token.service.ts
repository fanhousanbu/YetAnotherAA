import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  isCustom?: boolean;
  chainId?: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  formattedBalance: string;
}

@Injectable()
export class TokenService {
  private provider: ethers.JsonRpcProvider;

  // Pre-configured tokens for Sepolia testnet
  private readonly PRESET_TOKENS: Token[] = [
    {
      address: "0x3e7B771d4541eC85c8137e950598Ac97553a337a",
      symbol: "PNTs",
      name: "Points Token",
      decimals: 18,
      logoUrl: "https://via.placeholder.com/32/ff6b35/ffffff?text=PNT",
      isCustom: false,
      chainId: 11155111, // Sepolia
    },
    {
      address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",
      symbol: "PIM",
      name: "Pimlico Token",
      decimals: 6,
      logoUrl: "https://via.placeholder.com/32/4c6ef5/ffffff?text=PIM",
      isCustom: false,
      chainId: 11155111, // Sepolia
    },
  ];

  // ERC20 ABI for basic token operations
  private readonly ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
  ];

  constructor(private configService: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(this.configService.get<string>("ethRpcUrl"));
  }

  /**
   * Get preset tokens
   */
  getPresetTokens(): Token[] {
    return this.PRESET_TOKENS;
  }

  /**
   * Get token information from contract
   */
  async getTokenInfo(tokenAddress: string): Promise<Token> {
    try {
      const contract = new ethers.Contract(tokenAddress, this.ERC20_ABI, this.provider);

      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);

      return {
        address: tokenAddress.toLowerCase(),
        name,
        symbol,
        decimals: Number(decimals),
        isCustom: true,
        chainId: 11155111, // Sepolia
      };
    } catch (error) {
      throw new Error(`Failed to get token info: ${error.message}`);
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(tokenAddress, this.ERC20_ABI, this.provider);
      const balance = await this.retryWithDelay(() => contract.balanceOf(walletAddress));
      return balance.toString();
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress}:`, error.message);
      // Return "0" instead of throwing error to prevent breaking the entire balance loading
      return "0";
    }
  }

  /**
   * Retry function with exponential backoff for rate limiting
   */
  private async retryWithDelay<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limiting error
        if (error.code === "BAD_DATA" && error.message?.includes("Too Many Requests")) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(
              `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // If it's not a rate limiting error or we've exhausted retries, throw immediately
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Get formatted token balance with decimals
   */
  async getFormattedTokenBalance(
    tokenAddress: string,
    walletAddress: string
  ): Promise<TokenBalance> {
    // Execute sequentially to avoid rate limiting
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
    const rawBalance = await this.getTokenBalance(tokenAddress, walletAddress);

    const formattedBalance = ethers.formatUnits(rawBalance, tokenInfo.decimals);

    return {
      token: tokenInfo,
      balance: rawBalance,
      formattedBalance,
    };
  }

  /**
   * Get all token balances for a wallet
   */
  async getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    const tokens = this.PRESET_TOKENS;
    const balances: TokenBalance[] = [];

    // Process tokens with delays to avoid rate limiting
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      try {
        // Add delay between requests to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const rawBalance = await this.getTokenBalance(token.address, walletAddress);
        const formattedBalance = ethers.formatUnits(rawBalance, token.decimals);

        balances.push({
          token,
          balance: rawBalance,
          formattedBalance,
        });
      } catch (error) {
        console.error(`Failed to load balance for ${token.symbol}:`, error.message);
        // Add token with zero balance instead of skipping
        balances.push({
          token,
          balance: "0",
          formattedBalance: "0",
        });
      }
    }

    return balances;
  }

  /**
   * Generate ERC20 transfer calldata
   */
  generateTransferCalldata(to: string, amount: string, decimals: number): string {
    const contract = new ethers.Contract(ethers.ZeroAddress, this.ERC20_ABI);
    const parsedAmount = ethers.parseUnits(amount, decimals);
    return contract.interface.encodeFunctionData("transfer", [to, parsedAmount]);
  }

  /**
   * Validate token address
   */
  async validateToken(tokenAddress: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(tokenAddress, this.ERC20_ABI, this.provider);
      // Try to call basic ERC20 functions
      await Promise.all([contract.name(), contract.symbol(), contract.decimals()]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format token amount for display
   */
  formatTokenAmount(amount: string, decimals: number, precision = 6): string {
    const formatted = ethers.formatUnits(amount, decimals);
    const num = parseFloat(formatted);

    if (num === 0) return "0";
    if (num >= 1) return num.toFixed(Math.min(4, precision));
    if (num >= 0.0001) return num.toFixed(precision);
    return num.toExponential(2);
  }
}
