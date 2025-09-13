"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStoredAuth, getStoredAuth } from "@/lib/auth";
import { User } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { Bars3Icon, XMarkIcon, SunIcon, MoonIcon } from "@heroicons/react/24/outline";

interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function Layout({ children, requireAuth = false }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const { token, user: storedUser } = getStoredAuth();

    if (requireAuth && !token) {
      router.push("/auth/login");
      return;
    }

    if (!requireAuth && token) {
      router.push("/dashboard");
      return;
    }

    setUser(storedUser);
    setLoading(false);
  }, [requireAuth, router]);

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      {user && (
        <nav className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">AAStar</h1>
              </div>

              <div className="hidden md:flex items-center space-x-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => router.push("/transfer")}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
                >
                  Transfer
                </button>
                <button
                  onClick={() => router.push("/tokens")}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
                >
                  Tokens
                </button>
                {/* Theme Toggle Button */}
                <button
                  onClick={toggleTheme}
                  className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-md"
                  title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                >
                  {theme === "light" ? (
                    <MoonIcon className="h-5 w-5" />
                  ) : (
                    <SunIcon className="h-5 w-5" />
                  )}
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
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
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    router.push("/dashboard");
                    setMobileMenuOpen(false);
                  }}
                  className="block px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 w-full text-left"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    router.push("/transfer");
                    setMobileMenuOpen(false);
                  }}
                  className="block px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 w-full text-left"
                >
                  Transfer
                </button>
                <button
                  onClick={() => {
                    router.push("/tokens");
                    setMobileMenuOpen(false);
                  }}
                  className="block px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 w-full text-left"
                >
                  Tokens
                </button>
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {user.username || user.email}
                </div>
                {/* Mobile Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 w-full text-left"
                >
                  {theme === "light" ? (
                    <MoonIcon className="h-5 w-5 mr-2" />
                  ) : (
                    <SunIcon className="h-5 w-5 mr-2" />
                  )}
                  {theme === "light" ? "Dark Mode" : "Light Mode"}
                </button>
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
      <main className={user ? "py-6" : ""}>{children}</main>
    </div>
  );
}
