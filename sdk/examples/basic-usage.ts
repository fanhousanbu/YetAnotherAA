/**
 * YAAA SDK - Basic Usage Example
 * 
 * This example demonstrates how to integrate the YAAA SDK into your application.
 * The SDK provides Passkey authentication and ERC-4337 account abstraction features.
 */

import { YAAAClient } from '@yaaa/sdk';

// ============================================
// 1. Initialize the SDK Client
// ============================================

const yaaa = new YAAAClient({
  // Your backend API URL
  apiURL: 'http://localhost:3000/api/v1',
  
  // Token provider function (for authenticated requests)
  tokenProvider: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  },
  
  // BLS configuration
  bls: {
    seedNodes: ['https://validator.your-domain.com']
  }
});

// ============================================
// 2. Passkey Registration
// ============================================

async function registerWithPasskey() {
  try {
    console.log('Starting Passkey registration...');
    
    // The SDK handles the entire flow:
    // 1. Calls backend /auth/passkey/register/begin
    // 2. Triggers browser's WebAuthn API (biometric prompt)
    // 3. Calls backend /auth/passkey/register/complete
    const result = await yaaa.passkey.register({
      email: 'user@example.com',
      username: 'JohnDoe'
    });
    
    console.log('Registration successful!');
    console.log('User:', result.user);
    console.log('Token:', result.token);
    
    // Save token for future requests
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    
    return result;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}

// ============================================
// 3. Passkey Login
// ============================================

async function loginWithPasskey() {
  try {
    console.log('Starting Passkey login...');
    
    // The SDK handles:
    // 1. Calls backend /auth/passkey/login/begin
    // 2. Triggers browser's WebAuthn API
    // 3. Calls backend /auth/passkey/login/complete
    const result = await yaaa.passkey.authenticate();
    
    console.log('Login successful!');
    console.log('User:', result.user);
    
    // Save token
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    
    return result;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// ============================================
// 4. Transaction Verification with Passkey
// ============================================

async function sendTransaction() {
  try {
    console.log('Preparing transaction...');
    
    // Verify transaction with Passkey
    // This will prompt the user to confirm via biometric
    const verification = await yaaa.passkey.verifyTransaction({
      to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      value: '0.01', // ETH amount
      data: '0x' // Optional contract call data
    });
    
    console.log('Transaction verified!');
    console.log('UserOpHash:', verification.userOpHash);
    console.log('Credential:', verification.credential);
    
    // Now send the verified transaction to your backend
    // Your backend will handle Bundler submission
    const response = await fetch('http://localhost:3000/api/v1/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        amount: '0.01',
        passkeyCredential: verification.credential,
        usePaymaster: true // Optional: use gasless transactions
      })
    });
    
    const result = await response.json();
    console.log('Transaction submitted:', result);
    
    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// ============================================
// 5. BLS Signature Operations (Advanced)
// ============================================

async function demonstrateBLS() {
  try {
    // Get available BLS nodes from gossip network
    const nodes = await yaaa.bls.getAvailableNodes();
    console.log('Available BLS nodes:', nodes);
    
    // Generate message point for a UserOpHash
    const userOpHash = '0x1234...'; // Example hash
    const messagePoint = await yaaa.bls.generateMessagePoint(userOpHash);
    console.log('Message Point:', messagePoint);
    
    // Note: Actual signature generation is handled by the backend
    // because it requires coordination with multiple BLS nodes
    
  } catch (error) {
    console.error('BLS operation failed:', error);
  }
}

// ============================================
// 6. Add Additional Device (Multi-device support)
// ============================================

async function addNewDevice() {
  try {
    console.log('Adding new device...');
    
    // User must be logged in
    const passkeyInfo = await yaaa.passkey.addDevice({
      email: 'user@example.com',
      password: 'optional-password-for-verification'
    });
    
    console.log('New device added:', passkeyInfo);
    return passkeyInfo;
  } catch (error) {
    console.error('Failed to add device:', error);
    throw error;
  }
}

// ============================================
// Usage in React Component
// ============================================

/*
import { YAAAClient } from '@yaaa/sdk';
import { useState } from 'react';

function MyApp() {
  const [user, setUser] = useState(null);
  
  const yaaa = new YAAAClient({
    apiURL: process.env.NEXT_PUBLIC_API_URL,
    tokenProvider: () => localStorage.getItem('token'),
    bls: {
      seedNodes: [process.env.NEXT_PUBLIC_BLS_SEED_NODE]
    }
  });
  
  const handleRegister = async () => {
    try {
      const result = await yaaa.passkey.register({
        email: 'user@example.com',
        username: 'JohnDoe'
      });
      setUser(result.user);
      localStorage.setItem('token', result.token);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };
  
  return (
    <div>
      <button onClick={handleRegister}>
        Register with Passkey
      </button>
    </div>
  );
}
*/

// ============================================
// Export for module usage
// ============================================

export {
  yaaa,
  registerWithPasskey,
  loginWithPasskey,
  sendTransaction,
  demonstrateBLS,
  addNewDevice
};
