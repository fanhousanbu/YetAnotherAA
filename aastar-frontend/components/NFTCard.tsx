"use client";

import { UserNFT, NFTStandard } from "@/lib/types";
import { useState } from "react";

interface NFTCardProps {
  nft: UserNFT;
  onRemove?: (nftId: string) => void;
  onClick?: (nft: UserNFT) => void;
}

export default function NFTCard({ nft, onRemove, onClick }: NFTCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(nft.id);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(nft);
    }
  };

  const displayImage = nft.imageUrl && !imageError;

  return (
    <div
      onClick={handleClick}
      className={`group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden ${
        onClick ? "cursor-pointer" : ""
      } border border-gray-200 dark:border-gray-700`}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 overflow-hidden">
        {displayImage ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-900 dark:border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={nft.imageUrl}
              alt={nft.name}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoading ? "opacity-0" : "opacity-100"
              } group-hover:scale-105 transition-transform duration-300`}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
            <svg className="w-16 h-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm">No Image</span>
          </div>
        )}

        {/* Standard Badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-lg backdrop-blur-sm ${
              nft.standard === NFTStandard.ERC721
                ? "bg-blue-500/80 text-white"
                : "bg-purple-500/80 text-white"
            }`}
          >
            {nft.standard}
          </span>
        </div>

        {/* Amount Badge (ERC1155) */}
        {nft.standard === NFTStandard.ERC1155 && nft.amount && nft.amount > 1 && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 text-xs font-medium bg-gray-900/80 text-white rounded-lg backdrop-blur-sm">
              x{nft.amount}
            </span>
          </div>
        )}

        {/* Remove Button */}
        {onRemove && (
          <button
            onClick={handleRemove}
            className="absolute bottom-2 right-2 p-2 bg-red-500/80 hover:bg-red-600/90 text-white rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Remove NFT"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Info Container */}
      <div className="p-4">
        {/* Collection Name */}
        {nft.collectionName && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
            {nft.collectionName}
          </p>
        )}

        {/* NFT Name */}
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 truncate">
          {nft.name}
        </h3>

        {/* Token ID */}
        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          #{nft.tokenId.length > 10 ? `${nft.tokenId.slice(0, 10)}...` : nft.tokenId}
        </p>

        {/* Description (if available) */}
        {nft.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
            {nft.description}
          </p>
        )}
      </div>
    </div>
  );
}
