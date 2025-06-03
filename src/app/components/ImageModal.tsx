import React, { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNFTResolver } from '../hooks/useNFTResolver';
import { Download, ExternalLink, Loader2, ImageIcon } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
  showMetadata?: boolean;
}

export default function ImageModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  alt = "Image", 
  showMetadata = false 
}: ImageModalProps) {
  const { imageUrl: resolvedUrl, isLoading, error } = useNFTResolver(imageUrl);
  const [imageLoading, setImageLoading] = useState(true);

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    
    try {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solcials-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const handleExternalView = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank');
    } else if (imageUrl.startsWith('nft:')) {
      // Fallback to Solscan for NFT
      const nftAddress = imageUrl.replace('nft:', '');
      window.open(`https://solscan.io/token/${nftAddress}?cluster=devnet`, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] p-0 overflow-hidden border-0 bg-transparent">
        <div className="relative bg-black/95 backdrop-blur-sm rounded-lg w-full h-full flex items-center justify-center">
          {/* Action buttons */}
          <div className="absolute top-4 left-4 z-50 flex space-x-2">
            {resolvedUrl && (
              <Button
                onClick={handleDownload}
                variant="ghost"
                size="sm"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 h-auto w-auto"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={handleExternalView}
              variant="ghost"
              size="sm"
              className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 h-auto w-auto"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          {/* Image content */}
          <div className="w-full h-full flex items-center justify-center p-16">
            {isLoading ? (
              <div className="text-center text-white">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading image...</p>
                {imageUrl.startsWith('nft:') && (
                  <p className="text-xs opacity-70 mt-1">
                    Resolving NFT: {imageUrl.replace('nft:', '').slice(0, 8)}...
                  </p>
                )}
              </div>
            ) : error || !resolvedUrl ? (
              <div className="text-center text-white">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm mb-2">Failed to load image</p>
                <p className="text-xs opacity-70">
                  {imageUrl.startsWith('nft:') 
                    ? `NFT: ${imageUrl.replace('nft:', '').slice(0, 8)}...`
                    : 'Image unavailable'
                  }
                </p>
                <Button
                  onClick={handleExternalView}
                  variant="outline"
                  size="sm"
                  className="mt-4 text-white border-white/20 hover:bg-white/10"
                >
                  View on Explorer
                </Button>
              </div>
            ) : (
              <div className="relative flex items-center justify-center w-full h-full">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
                <Image
                  src={resolvedUrl}
                  alt={alt}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="object-contain w-full h-full"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto'
                  }}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                  priority
                  unoptimized={resolvedUrl.startsWith('data:')}
                />
              </div>
            )}
          </div>

          {/* Metadata footer */}
          {showMetadata && imageUrl.startsWith('nft:') && !isLoading && !error && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="h-4 w-4" />
                  <span>nft • stored on chain</span>
                </div>
                <span className="text-xs opacity-70 font-mono">
                  {imageUrl.replace('nft:', '').slice(0, 8)}...{imageUrl.replace('nft:', '').slice(-4)}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 