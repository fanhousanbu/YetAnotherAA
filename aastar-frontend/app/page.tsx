'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { isPasskeyAvailable } from '@/lib/passkey';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import Dashboard from '@/components/Dashboard';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    // 检查 Passkey 支持
    isPasskeyAvailable().then(setPasskeyAvailable);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleRegister = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!passkeyAvailable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            浏览器不支持 Passkey
          </h1>
          <p className="text-gray-600">
            请使用支持 Passkey 的现代浏览器访问本应用。
            推荐使用 Chrome、Safari 或 Edge 的最新版本。
          </p>
        </div>
      </div>
    );
  }

  if (currentUser) {
    return <Dashboard user={currentUser} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            FrontDoor Demo
          </h1>
          <p className="text-gray-600">
            Web3 钱包转账演示
          </p>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Passkey 可用
          </div>
        </div>

        <div className="card">
          {showRegister ? (
            <RegisterForm
              onRegister={handleRegister}
              onSwitchToLogin={() => setShowRegister(false)}
            />
          ) : (
            <LoginForm
              onLogin={handleLogin}
              onSwitchToRegister={() => setShowRegister(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
} 