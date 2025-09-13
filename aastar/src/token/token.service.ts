import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

export enum TokenCategory {
  STABLECOIN = "stablecoin",
  DEFI = "defi",
  GOVERNANCE = "governance",
  UTILITY = "utility",
  TEST = "test",
  OTHER = "other",
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  isCustom?: boolean;
  chainId?: number;
  category?: TokenCategory;
  description?: string;
  website?: string;
  verified?: boolean;
  tags?: string[];
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
      logoUrl:
        "https://assets.coingecko.com/assets/favicon-32x32-png-32x32-05bc04a8abe3e73e29d8b830a9d6288e.png",
      isCustom: false,
      chainId: 11155111, // Sepolia
      category: TokenCategory.TEST,
      description: "Test points token for account abstraction demonstrations",
      verified: true,
      tags: ["test", "points"],
    },
    {
      address: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751",
      symbol: "PIM",
      name: "Pimlico Token",
      decimals: 6,
      logoUrl: "https://avatars.githubusercontent.com/u/80178375?s=32&v=4",
      isCustom: false,
      chainId: 11155111, // Sepolia
      category: TokenCategory.UTILITY,
      description: "Pimlico ecosystem utility token",
      website: "https://pimlico.io",
      verified: true,
      tags: ["utility", "pimlico"],
    },
    {
      address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      symbol: "LINK",
      name: "ChainLink Token (Sepolia)",
      decimals: 18,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/32x32/1975.png",
      isCustom: false,
      chainId: 11155111, // Sepolia
      category: TokenCategory.DEFI,
      description: "Decentralized oracle network token",
      website: "https://chain.link",
      verified: true,
      tags: ["oracle", "defi"],
    },
    {
      address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      symbol: "UNI",
      name: "Uniswap Token (Sepolia)",
      decimals: 18,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/32x32/7083.png",
      isCustom: false,
      chainId: 11155111, // Sepolia
      category: TokenCategory.GOVERNANCE,
      description: "Uniswap protocol governance token",
      website: "https://uniswap.org",
      verified: true,
      tags: ["governance", "dex"],
    },
    {
      address: "0xA0b86a33E6441dA4D9e77c3C08CF45F1e6f4E1a6",
      symbol: "DAI",
      name: "Dai Stablecoin (Sepolia)",
      decimals: 18,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/32x32/4943.png",
      isCustom: false,
      chainId: 11155111, // Sepolia
      category: TokenCategory.STABLECOIN,
      description: "Decentralized USD-pegged stablecoin",
      website: "https://makerdao.com",
      verified: true,
      tags: ["stablecoin", "defi"],
    },
    {
      address: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      symbol: "USDC",
      name: "USD Coin (Sepolia)",
      decimals: 6,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/32x32/3408.png",
      isCustom: false,
      chainId: 11155111, // Sepolia
      category: TokenCategory.STABLECOIN,
      description: "Fully backed USD digital dollar",
      website: "https://centre.io",
      verified: true,
      tags: ["stablecoin", "centre"],
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
   * Get tokens filtered by category
   */
  getTokensByCategory(category: TokenCategory): Token[] {
    return this.PRESET_TOKENS.filter(token => token.category === category);
  }

  /**
   * Search tokens by symbol, name, or address
   */
  searchTokens(query: string): Token[] {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) return this.PRESET_TOKENS;

    return this.PRESET_TOKENS.filter(
      token =>
        token.symbol.toLowerCase().includes(searchTerm) ||
        token.name.toLowerCase().includes(searchTerm) ||
        token.address.toLowerCase().includes(searchTerm) ||
        token.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Get all available token categories
   */
  getTokenCategories(): TokenCategory[] {
    return Object.values(TokenCategory);
  }

  /**
   * Get tokens with advanced filtering
   */
  getFilteredTokens(filters: {
    category?: TokenCategory;
    verified?: boolean;
    customOnly?: boolean;
    query?: string;
  }): Token[] {
    let tokens = this.PRESET_TOKENS;

    // Filter by custom/preset
    if (filters.customOnly !== undefined) {
      tokens = tokens.filter(token => token.isCustom === filters.customOnly);
    }

    // Filter by category
    if (filters.category) {
      tokens = tokens.filter(token => token.category === filters.category);
    }

    // Filter by verified status
    if (filters.verified !== undefined) {
      tokens = tokens.filter(token => token.verified === filters.verified);
    }

    // Search filter
    if (filters.query) {
      const searchTerm = filters.query.toLowerCase().trim();
      tokens = tokens.filter(
        token =>
          token.symbol.toLowerCase().includes(searchTerm) ||
          token.name.toLowerCase().includes(searchTerm) ||
          token.address.toLowerCase().includes(searchTerm) ||
          token.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    return tokens;
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
        category: TokenCategory.OTHER,
        verified: false,
        tags: ["custom"],
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
      console.error("Failed to get token balance for %s: %s", tokenAddress, error.message);
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
  async getAllTokenBalances(
    walletAddress: string,
    includeZeroBalances = true
  ): Promise<TokenBalance[]> {
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

        // Skip zero balances if requested
        if (!includeZeroBalances && parseFloat(formattedBalance) === 0) {
          continue;
        }

        balances.push({
          token,
          balance: rawBalance,
          formattedBalance,
        });
      } catch (error) {
        console.error(`Failed to load balance for ${token.symbol}:`, error.message);
        // Add token with zero balance instead of skipping (if including zero balances)
        if (includeZeroBalances) {
          balances.push({
            token,
            balance: "0",
            formattedBalance: "0",
          });
        }
      }
    }

    // Sort by balance value (descending) and then by token name
    return balances.sort((a, b) => {
      const balanceA = parseFloat(a.formattedBalance);
      const balanceB = parseFloat(b.formattedBalance);

      if (balanceA !== balanceB) {
        return balanceB - balanceA; // Higher balance first
      }

      return a.token.symbol.localeCompare(b.token.symbol); // Alphabetical by symbol
    });
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
   * Validate token address with detailed information
   */
  async validateToken(tokenAddress: string): Promise<{
    isValid: boolean;
    token?: Token;
    error?: string;
  }> {
    try {
      // Check if it's already a preset token
      const existingToken = this.getTokenByAddress(tokenAddress);
      if (existingToken) {
        return {
          isValid: true,
          token: existingToken,
        };
      }

      const contract = new ethers.Contract(tokenAddress, this.ERC20_ABI, this.provider);

      // Try to call basic ERC20 functions with timeout
      const [name, symbol, decimals] = (await Promise.race([
        Promise.all([contract.name(), contract.symbol(), contract.decimals()]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000)),
      ])) as [string, string, bigint];

      const token: Token = {
        address: tokenAddress.toLowerCase(),
        name,
        symbol,
        decimals: Number(decimals),
        isCustom: true,
        chainId: 11155111,
        category: TokenCategory.OTHER,
        verified: false,
        tags: ["custom"],
      };

      return {
        isValid: true,
        token,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message || "Invalid ERC20 token",
      };
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

  /**
   * Get token by address (including custom tokens)
   */
  getTokenByAddress(address: string): Token | undefined {
    return this.PRESET_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
  }

  /**
   * Get token statistics
   */
  getTokenStats(): {
    total: number;
    byCategory: Record<TokenCategory, number>;
    verified: number;
    custom: number;
  } {
    const stats = {
      total: this.PRESET_TOKENS.length,
      byCategory: {} as Record<TokenCategory, number>,
      verified: 0,
      custom: 0,
    };

    // Initialize category counts
    Object.values(TokenCategory).forEach(category => {
      stats.byCategory[category] = 0;
    });

    // Count tokens by category and status
    this.PRESET_TOKENS.forEach(token => {
      if (token.category) {
        stats.byCategory[token.category]++;
      }
      if (token.verified) {
        stats.verified++;
      }
      if (token.isCustom) {
        stats.custom++;
      }
    });

    return stats;
  }
}
