"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Account, Transfer, TokenBalance } from "@/lib/types";
import { accountAPI, transferAPI, paymasterAPI, tokenAPI } from "@/lib/api";

interface DashboardData {
  account: Account | null;
  transfers: Transfer[];
  paymasters: any[];
  tokenBalances: TokenBalance[];
  lastUpdated: Date | null;
}

interface DashboardContextType {
  data: DashboardData;
  loading: boolean;
  loadDashboardData: (force?: boolean) => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("dashboardData");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Convert lastUpdated string back to Date
          if (parsed.lastUpdated) {
            parsed.lastUpdated = new Date(parsed.lastUpdated);
          }
          return parsed;
        } catch {
          // If parsing fails, return default
        }
      }
    }
    return {
      account: null,
      transfers: [],
      paymasters: [],
      tokenBalances: [],
      lastUpdated: null,
    };
  });
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("dashboardDataLoaded") === "true";
    }
    return false;
  });

  const loadDashboardData = useCallback(
    async (force = false) => {
      // Skip loading if already loaded and not forced
      if (hasLoaded && !force) {
        return;
      }

      setLoading(true);
      try {
        let accountData = null;

        // Try to get account
        try {
          const accountResponse = await accountAPI.getAccount();
          accountData = accountResponse.data;
        } catch {
          accountData = null;
        }

        // Get transfer history
        let transfersData: Transfer[] = [];
        try {
          const transferResponse = await transferAPI.getHistory(1, 5);
          transfersData = transferResponse.data.transfers;
        } catch {
          transfersData = [];
        }

        // Get available paymasters
        let paymastersData: any[] = [];
        try {
          const paymasterResponse = await paymasterAPI.getAvailable();
          paymastersData = paymasterResponse.data;
        } catch {
          paymastersData = [];
        }

        // Get token balances if account exists
        let tokenBalancesData: TokenBalance[] = [];
        if (accountData?.address) {
          try {
            const tokenResponse = await tokenAPI.getAllTokenBalances(accountData.address);
            tokenBalancesData = tokenResponse.data;
          } catch {
            tokenBalancesData = [];
          }
        }

        const newData = {
          account: accountData,
          transfers: transfersData,
          paymasters: paymastersData,
          tokenBalances: tokenBalancesData,
          lastUpdated: new Date(),
        };
        setData(newData);
        setHasLoaded(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("dashboardDataLoaded", "true");
          sessionStorage.setItem("dashboardData", JSON.stringify(newData));
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    },
    [hasLoaded]
  );

  const refreshBalance = useCallback(async () => {
    try {
      const accountResponse = await accountAPI.getAccount();

      // Get updated token balances
      let tokenBalancesData: TokenBalance[] = [];
      if (accountResponse.data?.address) {
        try {
          const tokenResponse = await tokenAPI.getAllTokenBalances(accountResponse.data.address);
          tokenBalancesData = tokenResponse.data;
        } catch {
          tokenBalancesData = data.tokenBalances;
        }
      }

      const newData = {
        ...data,
        account: accountResponse.data,
        tokenBalances: tokenBalancesData,
        lastUpdated: new Date(),
      };
      setData(newData);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("dashboardData", JSON.stringify(newData));
      }
    } catch (error) {
      console.error("Failed to refresh balance:", error);
      throw error;
    }
  }, [data.tokenBalances]);

  return (
    <DashboardContext.Provider value={{ data, loading, loadDashboardData, refreshBalance }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
