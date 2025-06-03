import { PublicKey } from '@solana/web3.js';
import { getSimplifiedNFTService } from './simplifiedNftService';

interface ResolvedNFT {
  imageUrl: string;
  metadata: {
    name: string;
    description: string;
  };
}

export class NFTResolver {
  private static cache = new Map<string, ResolvedNFT>();
  private static pendingRequests = new Map<string, Promise<ResolvedNFT | null>>();

  // Resolve NFT URL from "nft:address" format to actual image URL
  static async resolveNFTUrl(nftUrl: string): Promise<string> {
    // If it's not an NFT URL, return as-is
    if (!nftUrl.startsWith('nft:')) {
      return nftUrl;
    }

    try {
      // Extract the NFT address
      const nftAddress = nftUrl.replace('nft:', '');
      const nftPubkey = new PublicKey(nftAddress);

      // Check cache first
      const cached = this.cache.get(nftAddress);
      if (cached) {
        return cached.imageUrl;
      }

      // Check if there's already a pending request
      let pendingRequest = this.pendingRequests.get(nftAddress);
      if (!pendingRequest) {
        // Create new request
        pendingRequest = this.fetchNFTMetadata(nftPubkey);
        this.pendingRequests.set(nftAddress, pendingRequest);
      }

      // Wait for the request
      const result = await pendingRequest;
      
      // Clean up pending request
      this.pendingRequests.delete(nftAddress);

      if (result) {
        // Cache the result
        this.cache.set(nftAddress, result);
        return result.imageUrl;
      }

      // Return placeholder if failed
      const shortAddress = nftAddress.slice(0, 8);
      return `data:image/svg+xml;base64,${btoa(`
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" fill="#f9fafb"/>
          <text x="200" y="140" text-anchor="middle" font-family="Arial" font-size="16" fill="#6b7280">
            NFT Link
          </text>
          <text x="200" y="160" text-anchor="middle" font-family="Arial" font-size="12" fill="#9ca3af">
            ${shortAddress}...
          </text>
          <text x="200" y="180" text-anchor="middle" font-family="Arial" font-size="10" fill="#d1d5db">
            Unable to load image
          </text>
        </svg>
      `)}`;
    } catch (error) {
      console.error('Failed to resolve NFT URL:', error);
      return `data:image/svg+xml;base64,${btoa(`
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" fill="#fef2f2"/>
          <text x="200" y="140" text-anchor="middle" font-family="Arial" font-size="16" fill="#dc2626">
            Error
          </text>
          <text x="200" y="160" text-anchor="middle" font-family="Arial" font-size="12" fill="#ef4444">
            Failed to load NFT
          </text>
        </svg>
      `)}`;
    }
  }

  // Fetch NFT metadata from the service
  private static async fetchNFTMetadata(nftAddress: PublicKey): Promise<ResolvedNFT | null> {
    try {
      const nftService = getSimplifiedNFTService();
      const metadata = await nftService.getNFTMetadata(nftAddress);
      
      if (metadata) {
        return {
          imageUrl: metadata.imageUrl,
          metadata: metadata.metadata
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch NFT metadata:', error);
      return null;
    }
  }

  // Bulk resolve multiple NFT URLs (useful for post lists)
  static async bulkResolveNFTUrls(nftUrls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Filter and process only NFT URLs
    const nftOnlyUrls = nftUrls.filter(url => url.startsWith('nft:'));
    
    // Resolve all in parallel
    const promises = nftOnlyUrls.map(async (url) => {
      const resolved = await this.resolveNFTUrl(url);
      return { original: url, resolved };
    });

    const resolvedResults = await Promise.all(promises);
    
    // Build the results map
    resolvedResults.forEach(({ original, resolved }) => {
      results.set(original, resolved);
    });

    return results;
  }

  // Clear cache (useful for debugging or memory management)
  static clearCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  // Get cache size (for debugging)
  static getCacheSize(): number {
    return this.cache.size;
  }
} 