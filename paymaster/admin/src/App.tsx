import React, { useState, useEffect } from "react";
import { WalletConnect } from "./components/WalletConnect";
import { PaymasterDashboard } from "./components/PaymasterDashboard";
import "./App.css";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [, setAccount] = useState<string>("");
  const [paymasterAddress, setPaymasterAddress] = useState<string>("");
  const [addressHistory, setAddressHistory] = useState<string[]>([]);

  const handleWalletConnect = (address: string) => {
    setIsConnected(true);
    setAccount(address);
  };

  const handleWalletDisconnect = () => {
    setIsConnected(false);
    setAccount("");
  };

  const addToHistory = (address: string) => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress || !trimmedAddress.match(/^0x[a-fA-F0-9]{40}$/)) return;

    setAddressHistory(prev => {
      const filtered = prev.filter(addr => addr.toLowerCase() !== trimmedAddress.toLowerCase());
      const newHistory = [trimmedAddress, ...filtered].slice(0, 10); // 保留最近10个地址
      localStorage.setItem('paymaster-address-history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleAddressChange = (address: string) => {
    setPaymasterAddress(address);
    if (address && address.match(/^0x[a-fA-F0-9]{40}$/)) {
      addToHistory(address);
    }
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('paymaster-address-history');
    if (savedHistory) {
      try {
        setAddressHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse address history:', e);
      }
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Paymaster Admin Panel</h1>
        <p>ERC-4337 v0.6 Paymaster Management Interface</p>
        <WalletConnect onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} />
      </header>

      <main className="App-main">
        {isConnected ? (
          <div className="dashboard-container">
            <div className="paymaster-address-input">
              <label htmlFor="paymaster-address">Paymaster Contract Address:</label>
              <div className="address-input-container">
                <input
                  id="paymaster-address"
                  type="text"
                  placeholder="0x..."
                  value={paymasterAddress}
                  onChange={e => handleAddressChange(e.target.value)}
                  className="address-input"
                />
                {addressHistory.length > 0 && (
                  <select
                    className="address-history-select"
                    value=""
                    onChange={e => e.target.value && handleAddressChange(e.target.value)}
                  >
                    <option value="">选择历史地址</option>
                    {addressHistory.map((addr, index) => (
                      <option key={index} value={addr}>
                        {`${addr.slice(0, 6)}...${addr.slice(-4)}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {addressHistory.length > 0 && (
                <div className="address-history">
                  <small>最近使用过的地址：</small>
                  {addressHistory.slice(0, 3).map((addr, index) => (
                    <button
                      key={index}
                      className="history-address-btn"
                      onClick={() => handleAddressChange(addr)}
                      title={addr}
                    >
                      {`${addr.slice(0, 8)}...${addr.slice(-6)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {paymasterAddress && <PaymasterDashboard paymasterAddress={paymasterAddress} />}
          </div>
        ) : (
          <div className="welcome-message">
            <h2>Welcome to Paymaster Admin</h2>
            <p>Connect your wallet to manage your ERC-4337 paymaster contract.</p>
            <div className="features">
              <h3>Features:</h3>
              <ul>
                <li>Monitor paymaster deposits and stakes</li>
                <li>Manage EntryPoint deposits and withdrawals</li>
                <li>Add and withdraw stakes</li>
                <li>View real-time paymaster statistics</li>
                <li>ERC-4337 v0.6 compatible</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>ERC-4337 Account Abstraction Paymaster Admin v1.0</p>
      </footer>
    </div>
  );
}

export default App;
