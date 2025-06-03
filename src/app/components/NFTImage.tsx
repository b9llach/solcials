'use client';

import React from 'react';
import Image from 'next/image';
import { useNFTResolver } from '../hooks/useNFTResolver';
import { Loader2, ImageIcon, AlertCircle } from 'lucide-react';

interface NFTImageProps {
  imageUrl: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  postContent?: string; // Post content that might contain metadata CID
  onLoad?: () => void;
  onError?: () => void;
}

export default function NFTImage({ 
  imageUrl, 
  alt, 
  className = '', 
  width = 500, 
  height = 300,
  postContent, // Accept post content
  onLoad,
  onError 
}: NFTImageProps) {
  const { imageUrl: resolvedUrl, isLoading, error } = useNFTResolver(imageUrl, { 
    postContent // Pass post content to resolver
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`} style={{ width, height }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading NFT...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !resolvedUrl) {
    return (
      <div className={`flex items-center justify-center bg-red-50 ${className}`} style={{ width, height }}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">Failed to load image</p>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Show placeholder if no URL resolved
  if (!resolvedUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`} style={{ width, height }}>
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No image available</p>
        </div>
      </div>
    );
  }

  // Render the resolved image
  return (
    <div className={className}>
      <Image
        src={resolvedUrl}
        alt={alt}
        width={width}
        height={height}
        className="rounded-lg object-cover"
        onLoad={onLoad}
        onError={() => {
          console.error('Image failed to load:', resolvedUrl);
          onError?.();
        }}
        priority={false}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkbHB0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      />
    </div>
  );
} 