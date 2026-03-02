import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { YAAAServerClient } from "@yaaa/sdk/server";
import { YAAA_SERVER_CLIENT } from "../sdk/sdk.providers";

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
      address: "0xD14E87d8D8B69016Fcc08728c33799bD3F66F180",
      symbol: "PNTs",
      name: "Points Token",
      decimals: 18,
      logoUrl:
        "https://assets.coingecko.com/assets/favicon-32x32-png-32x32-05bc04a8abe3e73e29d8b830a9d6288e.png",
      isCustom: false,
      chainId: 11155111,
      category: TokenCategory.TEST,
      description: "Test points token for account abstraction demonstrations",
      verified: true,
      tags: ["test", "points"],
    },
    {
      address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
      symbol: "USDT",
      name: "Tether USD (Sepolia)",
      decimals: 6,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/32x32/825.png",
      isCustom: false,
      chainId: 11155111,
      category: TokenCategory.STABLECOIN,
      description: "Tether USD stablecoin on Sepolia testnet",
      website: "https://tether.to",
      verified: true,
      tags: ["stablecoin", "tether"],
    },
    {
      address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      symbol: "LINK",
      name: "ChainLink Token (Sepolia)",
      decimals: 18,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/32x32/1975.png",
      isCustom: false,
      chainId: 11155111,
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
      chainId: 11155111,
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
      chainId: 11155111,
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
      chainId: 11155111,
      category: TokenCategory.STABLECOIN,
      description: "Fully backed USD digital dollar",
      website: "https://centre.io",
      verified: true,
      tags: ["stablecoin", "centre"],
    },
  ];

  constructor(
    @Inject(YAAA_SERVER_CLIENT) private client: YAAAServerClient,
    private configService: ConfigService,
  ) {
    this.provider = new ethers.JsonRpcProvider(this.configService.get<string>("ethRpcUrl"));
  }

  // ---- Preset token methods (backend-specific local data) ----

  getPresetTokens(): Token[] {
    return this.PRESET_TOKENS;
  }

  getTokensByCategory(category: TokenCategory): Token[] {
    return this.PRESET_TOKENS.filter(token => token.category === category);
  }

  searchTokens(query: string): Token[] {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) return this.PRESET_TOKENS;

    return this.PRESET_TOKENS.filter(
      token =>
        token.symbol.toLowerCase().includes(searchTerm) ||
        token.name.toLowerCase().includes(searchTerm) ||
        token.address.toLowerCase().includes(searchTerm) ||
        token.tags?.some(tag => tag.toLowerCase().includes(searchTerm)),
    );
  }

  getTokenCategories(): TokenCategory[] {
    return Object.values(TokenCategory);
  }

  getFilteredTokens(filters: {
    category?: TokenCategory;
    verified?: boolean;
    customOnly?: boolean;
    query?: string;
  }): Token[] {
    let tokens = this.PRESET_TOKENS;

    if (filters.customOnly !== undefined) {
      tokens = tokens.filter(token => token.isCustom === filters.customOnly);
    }
    if (filters.category) {
      tokens = tokens.filter(token => token.category === filters.category);
    }
    if (filters.verified !== undefined) {
      tokens = tokens.filter(token => token.verified === filters.verified);
    }
    if (filters.query) {
      const searchTerm = filters.query.toLowerCase().trim();
      tokens = tokens.filter(
        token =>
          token.symbol.toLowerCase().includes(searchTerm) ||
          token.name.toLowerCase().includes(searchTerm) ||
          token.address.toLowerCase().includes(searchTerm) ||
          token.tags?.some(tag => tag.toLowerCase().includes(searchTerm)),
      );
    }

    return tokens;
  }

  getTokenByAddress(address: string): Token | undefined {
    return this.PRESET_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
  }

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

    Object.values(TokenCategory).forEach(category => {
      stats.byCategory[category] = 0;
    });

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

  formatTokenAmount(amount: string, decimals: number, precision = 6): string {
    const formatted = ethers.formatUnits(amount, decimals);
    const num = parseFloat(formatted);

    if (num === 0) return "0";
    if (num >= 1) return num.toFixed(Math.min(4, precision));
    if (num >= 0.0001) return num.toFixed(precision);
    return num.toExponential(2);
  }

  // ---- On-chain queries (delegated to SDK) ----

  async getTokenInfo(tokenAddress: string): Promise<Token> {
    const sdkInfo = await this.client.tokens.getTokenInfo(tokenAddress);
    return {
      address: sdkInfo.address,
      name: sdkInfo.name,
      symbol: sdkInfo.symbol,
      decimals: sdkInfo.decimals,
      isCustom: true,
      chainId: 11155111,
      category: TokenCategory.OTHER,
      verified: false,
      tags: ["custom"],
    };
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    return this.client.tokens.getTokenBalance(tokenAddress, walletAddress);
  }

  async getFormattedTokenBalance(
    tokenAddress: string,
    walletAddress: string,
  ): Promise<TokenBalance> {
    const sdkBalance = await this.client.tokens.getFormattedTokenBalance(
      tokenAddress,
      walletAddress,
    );
    return {
      token: {
        address: sdkBalance.token.address,
        name: sdkBalance.token.name,
        symbol: sdkBalance.token.symbol,
        decimals: sdkBalance.token.decimals,
        isCustom: true,
        chainId: 11155111,
        category: TokenCategory.OTHER,
        verified: false,
        tags: ["custom"],
      },
      balance: sdkBalance.balance,
      formattedBalance: sdkBalance.formattedBalance,
    };
  }

  generateTransferCalldata(to: string, amount: string, decimals: number): string {
    return this.client.tokens.generateTransferCalldata(to, amount, decimals);
  }

  async validateToken(tokenAddress: string): Promise<{
    isValid: boolean;
    token?: Token;
    error?: string;
  }> {
    // Check preset tokens first
    const existingToken = this.getTokenByAddress(tokenAddress);
    if (existingToken) {
      return { isValid: true, token: existingToken };
    }

    const result = await this.client.tokens.validateToken(tokenAddress);
    if (result.isValid && result.token) {
      return {
        isValid: true,
        token: {
          address: result.token.address,
          name: result.token.name,
          symbol: result.token.symbol,
          decimals: result.token.decimals,
          isCustom: true,
          chainId: 11155111,
          category: TokenCategory.OTHER,
          verified: false,
          tags: ["custom"],
        },
      };
    }

    return { isValid: false, error: result.error };
  }

  // ---- Backend-specific: bulk balance loading with rate limiting ----

  async getAllTokenBalances(
    walletAddress: string,
    includeZeroBalances = true,
  ): Promise<TokenBalance[]> {
    const tokens = this.PRESET_TOKENS;
    const balances: TokenBalance[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const rawBalance = await this.client.tokens.getTokenBalance(token.address, walletAddress);
        const formattedBalance = ethers.formatUnits(rawBalance, token.decimals);

        if (!includeZeroBalances && parseFloat(formattedBalance) === 0) {
          continue;
        }

        balances.push({ token, balance: rawBalance, formattedBalance });
      } catch (error) {
        console.error(`Failed to load balance for ${token.symbol}:`, error.message);
        if (includeZeroBalances) {
          balances.push({ token, balance: "0", formattedBalance: "0" });
        }
      }
    }

    return balances.sort((a, b) => {
      const balanceA = parseFloat(a.formattedBalance);
      const balanceB = parseFloat(b.formattedBalance);
      if (balanceA !== balanceB) return balanceB - balanceA;
      return a.token.symbol.localeCompare(b.token.symbol);
    });
  }
}
