import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

interface WalletConnectProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasUserDisconnected, setHasUserDisconnected] = useState(false);

  const checkConnection = async () => {
    // Check if user has manually disconnected in this session
    const wasDisconnected = sessionStorage.getItem("walletDisconnected") === "true";
    if (wasDisconnected) {
      setHasUserDisconnected(true);
      return;
    }

    // Don't auto-connect if user has manually disconnected or no ethereum
    if (hasUserDisconnected || typeof window.ethereum === "undefined") {
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        onConnect(accounts[0]);

        const network = await provider.getNetwork();
        setChainId(network.chainId);
      }
    } catch (error) {
      console.error("Error checking connection:", error);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask or another Web3 wallet");
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setAccount(address);
      setChainId(network.chainId);
      setIsConnected(true);
      setHasUserDisconnected(false); // Reset disconnect flag on successful connect

      // Clear disconnect flag from sessionStorage
      sessionStorage.removeItem("walletDisconnected");

      onConnect(address);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      // Clear app state
      setIsConnected(false);
      setAccount("");
      setChainId(0);
      setHasUserDisconnected(true); // Mark that user manually disconnected
      onDisconnect();

      // Store disconnect state in sessionStorage to persist across page reloads
      sessionStorage.setItem("walletDisconnected", "true");

      console.log("Wallet disconnected from application");
    } catch (error) {
      console.error("Error during disconnect:", error);
      // Still clear local state even if there's an error
      setIsConnected(false);
      setAccount("");
      setChainId(0);
      setHasUserDisconnected(true);
      onDisconnect();
    }
  };

  const switchToEthereum = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }], // Ethereum mainnet
      });
    } catch (error) {
      console.error("Error switching network:", error);
    }
  };

  const getNetworkName = (chainId: number): string => {
    const networks: { [key: number]: string } = {
      1: "Ethereum",
      5: "Goerli",
      11155111: "Sepolia",
      137: "Polygon",
      80001: "Mumbai",
    };
    return networks[chainId] || `Chain ${chainId}`;
  };

  useEffect(() => {
    checkConnection();

    if (typeof window.ethereum !== "undefined") {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          // If user changes account, reset disconnect state
          setAccount(accounts[0]);
          setIsConnected(true);
          setHasUserDisconnected(false);
          sessionStorage.removeItem("walletDisconnected");
          onConnect(accounts[0]);
        }
      });

      window.ethereum.on("chainChanged", (chainId: string) => {
        setChainId(parseInt(chainId, 16));
        window.location.reload();
      });

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", () => {});
          window.ethereum.removeListener("chainChanged", () => {});
        }
      };
    }
  }, [onConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wallet-connect">
      {!isConnected ? (
        <button className="connect-button" onClick={connectWallet} disabled={loading}>
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <div className="wallet-info">
          <div className="account-info">
            <span className="account-label">Account:</span>
            <span className="account-address">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </div>
          <div className="network-info">
            <span className="network-label">Network:</span>
            <span className={`network-name ${chainId !== 1 ? "wrong-network" : ""}`}>
              {getNetworkName(chainId)}
            </span>
            {chainId !== 1 && (
              <button className="switch-network" onClick={switchToEthereum}>
                Switch to Ethereum
              </button>
            )}
          </div>
          <button
            className="disconnect-button"
            onClick={disconnectWallet}
            title="从应用断开钱包连接"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};
