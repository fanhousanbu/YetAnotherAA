'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearStoredAuth, getStoredAuth } from '@/lib/auth';
import { User } from '@/lib/types';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function Layout({ children, requireAuth = false }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const { token, user: storedUser } = getStoredAuth();
    
    if (requireAuth && !token) {
      router.push('/auth/login');
      return;
    }
    
    if (!requireAuth && token) {
      router.push('/dashboard');
      return;
    }
    
    setUser(storedUser);
    setLoading(false);
  }, [requireAuth, router]);

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      {user && (
        <nav className="bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  AAStar
                </h1>
              </div>
              
              <div className="hidden md:flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => router.push('/transfer')}
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                >
                  Transfer
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {user.username || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </div>
              </div>

              {/* Mobile menu button */}
              <div className="md:hidden flex items-center">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  {mobileMenuOpen ? (
                    <XMarkIcon className="h-6 w-6" />
                  ) : (
                    <Bars3Icon className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
                <button
                  onClick={() => {
                    router.push('/dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 w-full text-left"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    router.push('/transfer');
                    setMobileMenuOpen(false);
                  }}
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 w-full text-left"
                >
                  Transfer
                </button>
                <div className="px-3 py-2 text-sm text-gray-500">
                  {user.username || user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:text-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </nav>
      )}

      {/* Main content */}
      <main className={user ? 'py-6' : ''}>
        {children}
      </main>
    </div>
  );
}