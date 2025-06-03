'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { getSimplifiedNFTService } from '../utils/simplifiedNftService';
import { Toast } from '../utils/toast';

interface NFTCleanupButtonProps {
  onCleanupComplete?: (cleanedCount: number) => void;
}

export default function NFTCleanupButton({ onCleanupComplete }: NFTCleanupButtonProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleCleanup = async () => {
    try {
      setIsCleaningUp(true);
      
      const nftService = getSimplifiedNFTService();
      const cleanedEntries = await nftService.cleanupInvalidNFTMetadata();
      
      if (cleanedEntries.length > 0) {
        Toast.success(`Cleaned up ${cleanedEntries.length} invalid NFT metadata entries`);
        onCleanupComplete?.(cleanedEntries.length);
      } else {
        Toast.info('No invalid NFT metadata found - all entries are valid');
      }
      
    } catch (error) {
      console.error('Failed to cleanup NFT metadata:', error);
      Toast.error('Failed to cleanup NFT metadata. Please try again.');
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCleanup}
      disabled={isCleaningUp}
      className="text-muted-foreground hover:text-foreground"
    >
      {isCleaningUp ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Cleaning...
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4 mr-2" />
          Clean NFT Cache
        </>
      )}
    </Button>
  );
} 