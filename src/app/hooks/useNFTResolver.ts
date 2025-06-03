import { useState, useEffect } from 'react';
import { NFTResolver } from '../utils/nftResolver';

interface UseNFTResolverResult {
  imageUrl: string;
  isLoading: boolean;
  error: string | null;
}

// Hook for resolving a single NFT URL
export function useNFTResolver(nftUrl: string | undefined): UseNFTResolverResult {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nftUrl) {
      setImageUrl('');
      setIsLoading(false);
      setError(null);
      return;
    }

    // If it's not an NFT URL, return immediately
    if (!nftUrl.startsWith('nft:')) {
      setImageUrl(nftUrl);
      setIsLoading(false);
      setError(null);
      return;
    }

    const resolveNFT = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const resolved = await NFTResolver.resolveNFTUrl(nftUrl);
        setImageUrl(resolved);
      } catch (err) {
        console.error('Failed to resolve NFT:', err);
        setError(err instanceof Error ? err.message : 'Failed to resolve NFT');
        setImageUrl(`https://via.placeholder.com/400x300?text=Error`);
      } finally {
        setIsLoading(false);
      }
    };

    resolveNFT();
  }, [nftUrl]);

  return { imageUrl, isLoading, error };
}

// Hook for resolving multiple NFT URLs (useful for post lists)
export function useBulkNFTResolver(nftUrls: string[]): Map<string, UseNFTResolverResult> {
  const [results, setResults] = useState<Map<string, UseNFTResolverResult>>(new Map());

  useEffect(() => {
    if (nftUrls.length === 0) {
      setResults(new Map());
      return;
    }

    // Initialize loading states
    const initialResults = new Map<string, UseNFTResolverResult>();
    nftUrls.forEach(url => {
      initialResults.set(url, {
        imageUrl: url.startsWith('nft:') ? '' : url,
        isLoading: url.startsWith('nft:'),
        error: null
      });
    });
    setResults(initialResults);

    // Resolve all NFT URLs
    const resolveAll = async () => {
      try {
        const resolved = await NFTResolver.bulkResolveNFTUrls(nftUrls);
        
        // Update results with resolved URLs
        const updatedResults = new Map<string, UseNFTResolverResult>();
        nftUrls.forEach(url => {
          const resolvedUrl = resolved.get(url) || url;
          updatedResults.set(url, {
            imageUrl: resolvedUrl,
            isLoading: false,
            error: null
          });
        });
        
        setResults(updatedResults);
      } catch (error) {
        console.error('Failed to bulk resolve NFTs:', error);
        
        // Update all with error state
        const errorResults = new Map<string, UseNFTResolverResult>();
        nftUrls.forEach(url => {
          errorResults.set(url, {
            imageUrl: `https://via.placeholder.com/400x300?text=Error`,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to resolve NFTs'
          });
        });
        
        setResults(errorResults);
      }
    };

    resolveAll();
  }, [nftUrls.join(',')]); // Dependency on the serialized URLs

  return results;
} 