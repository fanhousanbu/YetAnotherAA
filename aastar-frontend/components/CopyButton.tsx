"use client";

import { useState } from "react";
import { DocumentDuplicateIcon, CheckIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

interface CopyButtonProps {
  text: string | undefined;
  displayText?: string;
  className?: string;
  showFullText?: boolean;
}

export default function CopyButton({
  text,
  displayText,
  className = "",
  showFullText = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!text) {
      toast.error("No text to copy");
      return;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Address copied to clipboard!");

      // Reset icon after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text || '';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("Address copied to clipboard!");
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (fallbackErr) {
        toast.error("Failed to copy address");
      }
      document.body.removeChild(textArea);
    }
  };

  const truncateAddress = (address: string | undefined) => {
    if (!address || address.length < 10) return address || '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <span className="text-sm font-mono" title={text || ''}>
        {displayText || (showFullText ? (text || '') : truncateAddress(text))}
      </span>
      <button
        onClick={copyToClipboard}
        className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
        title="Copy address to clipboard"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-green-500" />
        ) : (
          <DocumentDuplicateIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
