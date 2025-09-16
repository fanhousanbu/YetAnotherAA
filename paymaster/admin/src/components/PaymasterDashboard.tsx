import React, { useState } from 'react';
import { usePaymaster } from '../hooks/usePaymaster';

interface PaymasterDashboardProps {
  paymasterAddress: string;
}

export const PaymasterDashboard: React.FC<PaymasterDashboardProps> = ({ paymasterAddress }) => {
  const {
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
    refresh
  } = usePaymaster(paymasterAddress);

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeDelay, setUnstakeDelay] = useState('86400');
  const [stakeWithdrawAddress, setStakeWithdrawAddress] = useState('');

  const handleDeposit = async () => {
    if (!depositAmount) return;
    await deposit(depositAmount);
    setDepositAmount('');
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress) return;
    await withdraw(withdrawAddress, withdrawAmount);
    setWithdrawAmount('');
    setWithdrawAddress('');
  };

  const handleAddStake = async () => {
    if (!stakeAmount) return;
    await addStake(stakeAmount, parseInt(unstakeDelay));
    setStakeAmount('');
  };

  const handleWithdrawStake = async () => {
    if (!stakeWithdrawAddress) return;
    await withdrawStake(stakeWithdrawAddress);
    setStakeWithdrawAddress('');
  };

  if (loading && !config) {
    return <div className="loading">Loading paymaster data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="paymaster-dashboard">
      <div className="dashboard-header">
        <h2>Paymaster Admin Dashboard</h2>
        <button onClick={refresh} disabled={loading} className="refresh-button">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {config && (
        <div className="config-section">
          <h3>Configuration</h3>
          <div className="config-grid">
            <div className="config-item">
              <label>Address:</label>
              <span>{config.address}</span>
            </div>
            <div className="config-item">
              <label>Owner:</label>
              <span>{config.owner}</span>
            </div>
            <div className="config-item">
              <label>Deposit:</label>
              <span>{config.deposit} ETH</span>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="stats-section">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <label>Total Operations:</label>
              <span>{stats.totalOperations}</span>
            </div>
            <div className="stat-item">
              <label>Total Gas Sponsored:</label>
              <span>{stats.totalGasSponsored} ETH</span>
            </div>
            <div className="stat-item">
              <label>Active Users:</label>
              <span>{stats.activeUsers}</span>
            </div>
            <div className="stat-item">
              <label>Remaining Balance:</label>
              <span>{stats.remainingBalance} ETH</span>
            </div>
          </div>
        </div>
      )}

      {depositInfo && (
        <div className="deposit-info-section">
          <h3>Deposit & Stake Information</h3>
          <div className="deposit-grid">
            <div className="deposit-item">
              <label>EntryPoint Deposit:</label>
              <span>{depositInfo.deposit} ETH</span>
            </div>
            <div className="deposit-item">
              <label>Staked:</label>
              <span>{depositInfo.staked ? 'Yes' : 'No'}</span>
            </div>
            <div className="deposit-item">
              <label>Stake Amount:</label>
              <span>{depositInfo.stake} ETH</span>
            </div>
            <div className="deposit-item">
              <label>Unstake Delay:</label>
              <span>{depositInfo.unstakeDelaySec} seconds</span>
            </div>
            <div className="deposit-item">
              <label>Withdraw Time:</label>
              <span>{depositInfo.withdrawTime === '0' ? 'N/A' : new Date(parseInt(depositInfo.withdrawTime) * 1000).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="actions-section">
        <div className="action-group">
          <h3>Deposit to EntryPoint</h3>
          <div className="action-form">
            <input
              type="number"
              step="0.01"
              placeholder="Amount (ETH)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="amount-input"
            />
            <button onClick={handleDeposit} disabled={loading || !depositAmount} className="action-button">
              Deposit
            </button>
          </div>
        </div>

        <div className="action-group">
          <h3>Withdraw from EntryPoint</h3>
          <div className="action-form">
            <input
              type="text"
              placeholder="Withdraw Address"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="address-input"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount (ETH)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="amount-input"
            />
            <button onClick={handleWithdraw} disabled={loading || !withdrawAmount || !withdrawAddress} className="action-button">
              Withdraw
            </button>
          </div>
        </div>

        <div className="action-group">
          <h3>Add Stake</h3>
          <div className="action-form">
            <input
              type="number"
              step="0.01"
              placeholder="Stake Amount (ETH)"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="amount-input"
            />
            <input
              type="number"
              placeholder="Unstake Delay (seconds)"
              value={unstakeDelay}
              onChange={(e) => setUnstakeDelay(e.target.value)}
              className="delay-input"
            />
            <button onClick={handleAddStake} disabled={loading || !stakeAmount} className="action-button">
              Add Stake
            </button>
          </div>
        </div>

        <div className="action-group">
          <h3>Stake Management</h3>
          <div className="action-form">
            <button onClick={unlockStake} disabled={loading} className="action-button unlock-button">
              Unlock Stake
            </button>
            <input
              type="text"
              placeholder="Withdraw to Address"
              value={stakeWithdrawAddress}
              onChange={(e) => setStakeWithdrawAddress(e.target.value)}
              className="address-input"
            />
            <button onClick={handleWithdrawStake} disabled={loading || !stakeWithdrawAddress} className="action-button">
              Withdraw Stake
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};