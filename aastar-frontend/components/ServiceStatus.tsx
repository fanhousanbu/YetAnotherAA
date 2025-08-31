"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface ServiceHealth {
  status: string;
  timestamp: string;
  services: {
    backend: {
      status: string;
      version: string;
    };
    signerNodes: {
      available: number;
      total: number;
      nodes: Array<{
        nodeId: string;
        endpoint: string;
        status: string;
      }>;
      status: "error" | "warning" | "ok";
    };
  };
}

export default function ServiceStatus() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"online" | "offline" | "checking">("checking");
  const [signerStatus, setSignerStatus] = useState<"error" | "warning" | "ok" | "checking">(
    "checking"
  );
  const [signerCount, setSignerCount] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    setIsRefreshing(true);
    try {
      const response = await axios.get<ServiceHealth>("/api/v1/health", {
        timeout: 5000,
      });

      if (response.data && response.data.status === "ok") {
        setBackendStatus("online");
        setSignerStatus(response.data.services.signerNodes.status);
        setSignerCount(response.data.services.signerNodes.available);
      } else {
        setBackendStatus("offline");
        setSignerStatus("error");
        setSignerCount(0);
      }
      setLastCheck(new Date());
    } catch (error) {
      console.error("Health check failed:", error);
      setBackendStatus("offline");
      setSignerStatus("error");
      setSignerCount(0);
      setLastCheck(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial check only when visible
    if (isVisible) {
      checkHealth();
    }
  }, [isVisible]);

  useEffect(() => {
    // Set up polling every 30 seconds only when visible
    if (isVisible) {
      const interval = setInterval(checkHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const getBackendColor = () => {
    switch (backendStatus) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      case "checking":
        return "bg-gray-400 animate-pulse";
    }
  };

  const getSignerColor = () => {
    switch (signerStatus) {
      case "ok":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      case "checking":
        return "bg-gray-400 animate-pulse";
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg z-50 transition-all"
          title="Show Service Status"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}

      {/* Status Panel */}
      {isVisible && (
        <div className="fixed bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg z-50 transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Service Status</h3>
            <div className="flex items-center space-x-1">
              {/* Refresh Button */}
              <button
                onClick={checkHealth}
                disabled={isRefreshing}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Refresh Status"
              >
                <ArrowPathIcon
                  className={`w-4 h-4 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>

              {/* Expand/Collapse Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronUpIcon className="w-4 h-4 text-gray-600" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Close"
              >
                <XMarkIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex flex-col space-y-3">
              {/* Backend Status */}
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getBackendColor()}`} />
                <div className="text-sm">
                  <span className="font-medium">Backend:</span>
                  <span className="ml-2 text-gray-600">
                    {backendStatus === "online"
                      ? "Online"
                      : backendStatus === "offline"
                        ? "Offline"
                        : "Checking..."}
                  </span>
                </div>
              </div>

              {/* Signer Nodes Status */}
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getSignerColor()}`} />
                <div className="text-sm">
                  <span className="font-medium">Signers:</span>
                  <span className="ml-2 text-gray-600">
                    {signerStatus === "checking" ? "Checking..." : `${signerCount} active`}
                  </span>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <>
                  {/* Last Check Time */}
                  {lastCheck && (
                    <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                      Last check: {lastCheck.toLocaleTimeString()}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Service healthy</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Limited availability</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Service unavailable</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
