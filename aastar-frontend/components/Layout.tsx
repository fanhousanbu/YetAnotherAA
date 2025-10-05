"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();

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

  const getNavButtonClass = (path: string, isActive: boolean) => {
    const baseClass = "px-3 py-2 text-sm font-medium transition-all duration-200 relative";
    if (isActive) {
      return `${baseClass} text-slate-900 dark:text-emerald-400 border-b-2 border-slate-900 dark:border-emerald-400`;
    }
    return `${baseClass} text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400 hover:border-b-2 hover:border-gray-300 dark:hover:border-gray-600`;
  };

  const getMobileNavButtonClass = (path: string, isActive: boolean) => {
    const baseClass =
      "block px-3 py-2 text-base font-medium w-full text-left transition-all duration-200";
    if (isActive) {
      return `${baseClass} text-slate-900 dark:text-emerald-400 bg-slate-50 dark:bg-emerald-900/10 border-l-4 border-slate-900 dark:border-emerald-400 font-semibold`;
    }
    return `${baseClass} text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-700/50`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900 dark:border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Navigation */}
      {user && (
        <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">AAStar</h1>
              </div>

              <div className="hidden md:flex items-center space-x-2">
                <button
                  onClick={() => router.push("/dashboard")}
                  className={getNavButtonClass("/dashboard", pathname === "/dashboard")}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => router.push("/transfer")}
                  className={getNavButtonClass("/transfer", pathname.startsWith("/transfer"))}
                >
                  Transfer
                </button>
                <button
                  onClick={() => router.push("/tokens")}
                  className={getNavButtonClass("/tokens", pathname === "/tokens")}
                >
                  Tokens
                </button>
                <button
                  onClick={() => router.push("/paymaster")}
                  className={getNavButtonClass("/paymaster", pathname === "/paymaster")}
                >
                  Paymasters
                </button>
                {/* Theme Toggle Button */}
                <button
                  onClick={toggleTheme}
                  className="p-2 text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400 rounded-md transition-colors"
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
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
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
                  className={getMobileNavButtonClass("/dashboard", pathname === "/dashboard")}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    router.push("/transfer");
                    setMobileMenuOpen(false);
                  }}
                  className={getMobileNavButtonClass("/transfer", pathname.startsWith("/transfer"))}
                >
                  Transfer
                </button>
                <button
                  onClick={() => {
                    router.push("/tokens");
                    setMobileMenuOpen(false);
                  }}
                  className={getMobileNavButtonClass("/tokens", pathname === "/tokens")}
                >
                  Tokens
                </button>
                <button
                  onClick={() => {
                    router.push("/paymaster");
                    setMobileMenuOpen(false);
                  }}
                  className={getMobileNavButtonClass("/paymaster", pathname === "/paymaster")}
                >
                  Paymasters
                </button>
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {user.username || user.email}
                </div>
                {/* Mobile Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400 w-full text-left transition-colors"
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
                  className="block w-full text-left px-3 py-2 text-base font-medium text-slate-900 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-400 transition-colors"
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
