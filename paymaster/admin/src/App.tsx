import React, { useState } from "react";
import { WalletConnect } from "./components/WalletConnect";
import { PaymasterDashboard } from "./components/PaymasterDashboard";
import "./App.css";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [, setAccount] = useState<string>("");
  const [paymasterAddress, setPaymasterAddress] = useState<string>("");

  const handleWalletConnect = (address: string) => {
    setIsConnected(true);
    setAccount(address);
  };

  const handleWalletDisconnect = () => {
    setIsConnected(false);
    setAccount("");
  };

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
              <input
                id="paymaster-address"
                type="text"
                placeholder="0x..."
                value={paymasterAddress}
                onChange={e => setPaymasterAddress(e.target.value)}
                className="address-input"
              />
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
