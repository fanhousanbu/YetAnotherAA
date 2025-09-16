import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PAYMASTER_ABI, ENTRY_POINT_ABI, ENTRY_POINT_ADDRESS } from '../constants/contracts';
import { PaymasterConfig, PaymasterStats, DepositInfo } from '../types/paymaster';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const usePaymaster = (paymasterAddress: string) => {
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
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);
      const entryPointContract = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);

      const [owner, deposit, balance, depositInfoData] = await Promise.all([
        paymasterContract.owner().catch(() => 'Unknown'),
        paymasterContract.getDeposit().catch(() => ethers.BigNumber.from(0)),
        provider.getBalance(paymasterAddress),
        entryPointContract.getDepositInfo(paymasterAddress).catch(() => ({
          deposit: ethers.BigNumber.from(0),
          staked: false,
          stake: ethers.BigNumber.from(0),
          unstakeDelaySec: ethers.BigNumber.from(0),
          withdrawTime: ethers.BigNumber.from(0)
        }))
      ]);

      setConfig({
        address: paymasterAddress,
        owner,
        deposit: ethers.utils.formatEther(deposit),
        withdrawStake: '0'
      });

      setStats({
        totalOperations: 0,
        totalGasSponsored: '0',
        activeUsers: 0,
        remainingBalance: ethers.utils.formatEther(balance)
      });

      setDepositInfo({
        deposit: ethers.utils.formatEther(depositInfoData.deposit),
        staked: depositInfoData.staked,
        stake: ethers.utils.formatEther(depositInfoData.stake),
        unstakeDelaySec: depositInfoData.unstakeDelaySec.toString(),
        withdrawTime: depositInfoData.withdrawTime.toString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const deposit = async (amount: string) => {
    if (!window.ethereum) {
      setError('Please install MetaMask');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.deposit({
        value: ethers.utils.parseEther(amount)
      });
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (address: string, amount: string) => {
    if (!window.ethereum) {
      setError('Please install MetaMask');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.withdrawTo(
        address,
        ethers.utils.parseEther(amount)
      );
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const addStake = async (amount: string, unstakeDelay: number) => {
    if (!window.ethereum) {
      setError('Please install MetaMask');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.addStake(unstakeDelay, {
        value: ethers.utils.parseEther(amount)
      });
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add stake failed');
    } finally {
      setLoading(false);
    }
  };

  const unlockStake = async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.unlockStake();
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock stake failed');
    } finally {
      setLoading(false);
    }
  };

  const withdrawStake = async (address: string) => {
    if (!window.ethereum) {
      setError('Please install MetaMask');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const paymasterContract = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, signer);

      const tx = await paymasterContract.withdrawStake(address);
      await tx.wait();
      await loadPaymasterData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdraw stake failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paymasterAddress) {
      loadPaymasterData();
    }
  }, [paymasterAddress]); // eslint-disable-line react-hooks/exhaustive-deps

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
    refresh: loadPaymasterData
  };
};