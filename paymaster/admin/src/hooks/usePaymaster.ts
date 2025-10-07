import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PAYMASTER_ABI, ENTRY_POINT_ABI, ENTRY_POINT_ADDRESSES } from "../constants/contracts";
import {
  PaymasterConfig,
  PaymasterStats,
  DepositInfo,
  EntryPointVersion,
} from "../types/paymaster";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const usePaymaster = (
  paymasterAddress: string,
  entryPointVersion: EntryPointVersion = "v06"
) => {
  const [config, setConfig] = useState<PaymasterConfig | null>(null);
  const [stats, setStats] = useState<PaymasterStats | null>(null);
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPaymasterData = async () => {
    if (!paymasterAddress || !window.ethereum) return;

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);
      const entryPointAddress = ENTRY_POINT_ADDRESSES[entryPointVersion];
      const entryPointContract = new ethers.Contract(entryPointAddress, ENTRY_POINT_ABI, provider);

      const [owner, deposit, balance, depositInfoData] = await Promise.all([
        paymasterContract.owner().catch(() => "Unknown"),
        paymasterContract.getDeposit().catch(() => 0n),
        provider.getBalance(paymasterAddress),
        entryPointContract.getDepositInfo(paymasterAddress).catch(() => ({
          deposit: 0n,
          staked: false,
          stake: 0n,
          unstakeDelaySec: 0n,
          withdrawTime: 0n,
        })),
      ]);

      setConfig({
        address: paymasterAddress,
        owner,
        deposit: ethers.formatEther(deposit),
        withdrawStake: "0",
      });

      setStats({
        totalOperations: 0,
        totalGasSponsored: "0",
        activeUsers: 0,
        remainingBalance: ethers.formatEther(balance),
      });

      setDepositInfo({
        deposit: ethers.formatEther(depositInfoData.deposit),
        staked: depositInfoData.staked,
        stake: ethers.formatEther(depositInfoData.stake),
        unstakeDelaySec: depositInfoData.unstakeDelaySec.toString(),
        withdrawTime: depositInfoData.withdrawTime.toString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const deposit = async (amount: string) => {
    if (!window.ethereum) {
      setError("Please install MetaMask");
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.deposit({
        value: ethers.parseEther(amount),
      });
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (address: string, amount: string) => {
    if (!window.ethereum) {
      setError("Please install MetaMask");
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.withdrawTo(address, ethers.parseEther(amount));
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const addStake = async (amount: string, unstakeDelay: number) => {
    if (!window.ethereum) {
      setError("Please install MetaMask");
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.addStake(unstakeDelay, {
        value: ethers.parseEther(amount),
      });
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add stake failed");
    } finally {
      setLoading(false);
    }
  };

  const unlockStake = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask");
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.unlockStake();
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock stake failed");
    } finally {
      setLoading(false);
    }
  };

  const withdrawStake = async (address: string) => {
    if (!window.ethereum) {
      setError("Please install MetaMask");
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.withdrawStake(address);
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw stake failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paymasterAddress) {
      loadPaymasterData();
    }
  }, [paymasterAddress, entryPointVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    config,
    stats,
    depositInfo,
    loading,
    error,
    deposit,
    withdraw,
    addStake,
    unlockStake,
    withdrawStake,
    refresh: loadPaymasterData,
  };
};
