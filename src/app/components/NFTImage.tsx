import React from 'react';
import Image from 'next/image';
import { useNFTResolver } from '../hooks/useNFTResolver';
import { Loader2, ImageIcon } from 'lucide-react';

interface NFTImageProps {
  imageUrl: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  showMetadata?: boolean;
  aspectRatio?: 'auto' | 'square' | 'video' | 'wide'; // Control cropping behavior
  height?: number; // Fixed height for cropping
}

export default function NFTImage({ 
  imageUrl, 
  alt, 
  className = '', 
  onClick,
  showMetadata = false,
  aspectRatio = 'auto',
  height = 400
}: NFTImageProps) {
  const { imageUrl: resolvedUrl, isLoading, error } = useNFTResolver(imageUrl);

  // Show loading state for NFT URLs
  if (isLoading && imageUrl.startsWith('nft:')) {
    return (
      <div className={`flex items-center justify-center bg-muted/20 rounded-lg border ${className}`}>
        <div className="text-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">loading nft image...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/20 rounded-lg border ${className}`}>
        <div className="text-center p-8">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">failed to load nft image</p>
          {imageUrl.startsWith('nft:') && (
            <p className="text-xs text-muted-foreground mt-1">
              nft: {imageUrl.replace('nft:', '').slice(0, 8)}...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Don't render if resolvedUrl is empty or null
  if (!resolvedUrl || resolvedUrl.trim() === '') {
    return (
      <div className={`flex items-center justify-center bg-muted/20 rounded-lg border ${className}`}>
        <div className="text-center p-8">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">no image available</p>
        </div>
      </div>
    );
  }

  // Determine image display style based on aspectRatio prop
  const getImageStyles = () => {
    switch (aspectRatio) {
      case 'square':
        return {
          className: 'w-full h-full object-cover',
          containerStyle: { aspectRatio: '1/1', height: `${height}px` }
        };
      case 'video':
        return {
          className: 'w-full h-full object-cover',
          containerStyle: { aspectRatio: '16/9', height: 'auto' }
        };
      case 'wide':
        return {
          className: 'w-full h-full object-cover',
          containerStyle: { height: `${height}px` }
        };
      case 'auto':
      default:
        return {
          className: 'w-auto h-auto max-w-full max-h-[300px] sm:max-h-[400px]',
          containerStyle: {}
        };
    }
  };

  const { className: imageClassName, containerStyle } = getImageStyles();

  // Show the actual image using Next.js Image component
  return (
    <div className={`rounded-lg overflow-hidden border bg-muted/10 ${className}`}>
      <div 
        className={`relative w-full bg-gray-50 dark:bg-gray-900 ${onClick ? 'cursor-pointer' : ''} flex justify-center items-center`}
        style={containerStyle}
        onClick={onClick}
      >
        <Image 
          src={resolvedUrl} 
          alt={alt}
          fill={aspectRatio !== 'auto'}
          width={aspectRatio === 'auto' ? 0 : undefined}
          height={aspectRatio === 'auto' ? 0 : undefined}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`${imageClassName} hover:scale-105 transition-transform duration-300 rounded-lg`}
          style={aspectRatio === 'auto' ? { 
            width: 'auto',
            height: 'auto',
            maxWidth: '100%'
          } : undefined}
          onError={(e) => {
            console.error('Image load error:', e);
          }}
          priority={false}
          unoptimized={resolvedUrl.startsWith('data:')} // Don't optimize data URLs
        />
      </div>
      {showMetadata && imageUrl.startsWith('nft:') && (
        <div className="p-2 bg-muted/50 border-t">
          <p className="text-xs text-muted-foreground flex items-center">
            <ImageIcon className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">nft • stored on chain</span>
          </p>
        </div>
      )}
    </div>
  );
} 