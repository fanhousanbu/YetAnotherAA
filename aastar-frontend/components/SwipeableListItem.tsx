"use client";

import React, { useRef, useState, useEffect, ReactNode } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";

interface SwipeableListItemProps {
  children: ReactNode;
  onDelete: () => void;
  onDeleteStart?: () => void;
  onDeleteEnd?: () => void;
  deleteText?: string;
  className?: string;
  enabled?: boolean;
}

export default function SwipeableListItem({
  children,
  onDelete,
  onDeleteStart,
  onDeleteEnd,
  deleteText = "Delete",
  className = "",
  enabled = true,
}: SwipeableListItemProps) {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const deleteThreshold = 80; // Pixels to swipe to trigger delete
  const maxSwipe = 100; // Maximum swipe distance

  // Check if mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Only enable swipe on mobile
  const isSwipeEnabled = enabled && isMobile;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isSwipeEnabled) return;
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !isSwipeEnabled) return;

    const x = e.touches[0].clientX;
    const diff = startX - x;

    // Only allow left swipe (positive diff)
    if (diff > 0) {
      setCurrentX(Math.min(diff, maxSwipe));
    } else {
      setCurrentX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || !isSwipeEnabled) return;

    setIsDragging(false);

    if (currentX >= deleteThreshold) {
      // Trigger delete
      handleDelete();
    } else {
      // Snap back
      setCurrentX(0);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    if (onDeleteStart) onDeleteStart();

    // Animate out
    setCurrentX(window.innerWidth);

    // Wait for animation then delete
    setTimeout(async () => {
      await onDelete();
      if (onDeleteEnd) onDeleteEnd();
      setIsDeleting(false);
      setCurrentX(0);
    }, 300);
  };

  // Desktop delete button click
  const handleDesktopDelete = () => {
    if (!isMobile) {
      handleDelete();
    }
  };

  const swipeStyle = {
    transform: `translateX(-${currentX}px)`,
    transition: isDragging ? "none" : "transform 0.3s ease-out",
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Delete background that shows when swiping */}
      {isSwipeEnabled && (
        <div className="absolute inset-0 bg-red-500 dark:bg-red-600 flex items-center justify-end pr-4">
          <div className="flex items-center gap-2 text-white">
            <TrashIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{deleteText}</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        ref={itemRef}
        style={isSwipeEnabled ? swipeStyle : {}}
        className="relative bg-white dark:bg-gray-800"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center">
          <div className="flex-1">{children}</div>

          {/* Desktop delete button */}
          {!isMobile && enabled && (
            <div className="flex-shrink-0 pr-4">
              <button
                onClick={handleDesktopDelete}
                disabled={isDeleting}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all touch-manipulation active:scale-95 disabled:opacity-50"
                title={deleteText}
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-b-2 border-red-600 rounded-full animate-spin" />
                ) : (
                  <TrashIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visual feedback for swipe */}
      {isSwipeEnabled && currentX > 0 && currentX < deleteThreshold && (
        <div
          className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-red-500/20 to-transparent pointer-events-none"
          style={{ width: `${currentX}px` }}
        />
      )}
    </div>
  );
}
