"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearStoredAuth, getStoredAuth } from "@/lib/auth";
import { User } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import ServiceStatus from "@/components/ServiceStatus";
import {
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  HomeIcon,
  PaperAirplaneIcon,
  WalletIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function Layout({ children, requireAuth = false }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showServiceStatus, setShowServiceStatus] = useState(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900 dark:border-emerald-500"></div>
      </div>
    );
  }

  const getBottomNavButtonClass = (path: string, isActive: boolean) => {
    const baseClass =
      "flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200 touch-manipulation active:scale-95";
    if (isActive) {
      return `${baseClass} text-slate-900 dark:text-emerald-400`;
    }
    return `${baseClass} text-gray-600 dark:text-gray-400`;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Top Navigation - Desktop only */}
      {user && (
        <nav className="hidden md:block sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">AAStar</h1>
              </div>

              {/* Desktop Navigation */}
              <div className="flex items-center space-x-2">
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
                <button
                  onClick={() => router.push("/address-book")}
                  className={getNavButtonClass("/address-book", pathname === "/address-book")}
                >
                  Address Book
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
            </div>
          </div>
        </nav>
      )}

      {/* Main content with bottom padding for mobile nav */}
      <main className={user ? "md:py-6 pb-20 md:pb-6" : ""}>{children}</main>

      {/* Service Status - Desktop only (mobile version is embedded in Me menu) */}
      <div className="hidden md:block">
        <ServiceStatus />
      </div>

      {/* Bottom Navigation Bar - Mobile only */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center justify-around h-16 px-2 safe-area-inset-bottom">
            {/* Dashboard */}
            <button
              onClick={() => router.push("/dashboard")}
              className={getBottomNavButtonClass("/dashboard", pathname === "/dashboard")}
            >
              <HomeIcon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">Home</span>
            </button>

            {/* Transfer */}
            <button
              onClick={() => router.push("/transfer")}
              className={getBottomNavButtonClass("/transfer", pathname.startsWith("/transfer"))}
            >
              <PaperAirplaneIcon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">Transfer</span>
            </button>

            {/* Tokens */}
            <button
              onClick={() => router.push("/tokens")}
              className={getBottomNavButtonClass("/tokens", pathname === "/tokens")}
            >
              <WalletIcon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">Tokens</span>
            </button>

            {/* Paymaster */}
            <button
              onClick={() => router.push("/paymaster")}
              className={getBottomNavButtonClass("/paymaster", pathname === "/paymaster")}
            >
              <CreditCardIcon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">Paymaster</span>
            </button>

            {/* Settings Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={getBottomNavButtonClass(
                "/address-book",
                pathname === "/address-book" || mobileMenuOpen
              )}
            >
              <Cog6ToothIcon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">Settings</span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile User Menu Overlay */}
      {mobileMenuOpen && user && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => {
            setMobileMenuOpen(false);
            setShowServiceStatus(false);
          }}
        >
          <div
            className="fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-xl max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 space-y-2">
              {/* User Info */}
              <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 bg-slate-50 dark:bg-gray-900/50 rounded-lg">
                <div className="font-medium truncate">{user.username || user.email}</div>
              </div>

              {/* Address Book */}
              <button
                onClick={() => {
                  router.push("/address-book");
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-between w-full px-4 py-3 text-left text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 rounded-lg transition-all touch-manipulation active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <BookOpenIcon className="w-5 h-5" />
                  <span>Address Book</span>
                </div>
                <ChevronRightIcon className="w-5 h-5" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full px-4 py-3 text-left text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 rounded-lg transition-all touch-manipulation active:scale-95"
              >
                <div className="flex items-center gap-3">
                  {theme === "light" ? (
                    <MoonIcon className="w-5 h-5" />
                  ) : (
                    <SunIcon className="w-5 h-5" />
                  )}
                  <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {theme === "light" ? "Off" : "On"}
                </div>
              </button>

              {/* Service Status Toggle */}
              <button
                onClick={() => setShowServiceStatus(!showServiceStatus)}
                className="flex items-center justify-between w-full px-4 py-3 text-left text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 rounded-lg transition-all touch-manipulation active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <Cog6ToothIcon className="w-5 h-5" />
                  <span>Service Status</span>
                </div>
                <ChevronRightIcon
                  className={`w-5 h-5 transition-transform ${showServiceStatus ? "rotate-90" : ""}`}
                />
              </button>

              {/* Embedded Service Status - shown when toggle is active */}
              {showServiceStatus && (
                <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2">
                  <ServiceStatus isOpen={true} onClose={() => setShowServiceStatus(false)} />
                </div>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="block w-full text-center px-4 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all shadow-sm hover:shadow-md touch-manipulation active:scale-95"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
