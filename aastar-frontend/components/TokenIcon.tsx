"use client";

import { useState, useRef, useEffect } from "react";
import { Token } from "@/lib/types";

interface TokenIconProps {
  token: Token;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  xs: "w-4 h-4 text-xs",
  sm: "w-5 h-5 text-xs",
  md: "w-6 h-6 text-sm",
  lg: "w-8 h-8 text-base",
  xl: "w-12 h-12 text-lg",
};

export default function TokenIcon({
  token,
  size = "md",
  className = "",
  showFallback = true,
}: TokenIconProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset error state when token changes
    setImageError(false);
    setImageLoaded(false);
  }, [token.address]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const sizeClass = sizeClasses[size];
  const shouldShowImage = token.logoUrl && !imageError;
  const shouldShowFallback = showFallback && (!token.logoUrl || imageError);

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0 ${sizeClass} ${className}`}
      title={`${token.symbol} (${token.name})`}
    >
      {/* Image */}
      {shouldShowImage && (
        <img
          ref={imgRef}
          src={token.logoUrl}
          alt={`${token.symbol} logo`}
          className={`rounded-full object-cover ${sizeClass} ${imageLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
        />
      )}

      {/* Fallback */}
      {shouldShowFallback && (
        <span
          className={`font-bold text-white select-none ${
            shouldShowImage && !imageLoaded
              ? "opacity-100"
              : shouldShowImage && imageLoaded
                ? "opacity-0"
                : "opacity-100"
          } transition-opacity duration-200`}
        >
          {token.symbol.charAt(0).toUpperCase()}
        </span>
      )}

      {/* Loading indicator for slow images */}
      {shouldShowImage && !imageLoaded && !imageError && (
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ${sizeClass}`}
        >
          <div className="animate-spin rounded-full h-1/2 w-1/2 border-b-2 border-gray-500"></div>
        </div>
      )}
    </div>
  );
}
