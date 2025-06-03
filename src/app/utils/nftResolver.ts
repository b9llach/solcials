import { PublicKey } from '@solana/web3.js';
import { getSimplifiedNFTService } from './simplifiedNftService';

interface ResolvedNFT {
  imageUrl: string;
  metadata: {
    name: string;
    description: string;
    creator: string;
    createdAt: number;
  };
}

export class NFTResolver {
  private static cache = new Map<string, ResolvedNFT>();
  private static pendingRequests = new Map<string, Promise<ResolvedNFT | null>>();

  // Resolve NFT URL from "nft:address" format to actual image URL
  static async resolveNFTUrl(nftUrl: string, postContent?: string): Promise<string> {
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
        // Create new request with post content
        pendingRequest = this.fetchNFTMetadata(nftPubkey, postContent);
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
  private static async fetchNFTMetadata(nftAddress: PublicKey, postContent?: string): Promise<ResolvedNFT | null> {
    try {
      const nftService = getSimplifiedNFTService();
      const metadata = await nftService.getNFTMetadata(nftAddress, postContent);
      
      if (metadata) {
        // Check if we have a valid image URL
        let imageUrl = metadata.imageUrl;
        
        // If no image URL or it's empty, use a placeholder
        if (!imageUrl || imageUrl.trim() === '') {
          imageUrl = this.generateNFTPlaceholder(nftAddress);
        }
        
        return {
          imageUrl,
          metadata: {
            name: metadata.caption || 'Solcials NFT',
            description: metadata.caption || `NFT created on Solcials platform`,
            creator: metadata.creator || 'Unknown',
            createdAt: metadata.createdAt || Date.now()
          }
        };
      }
      
      // If no metadata found, return a placeholder
      return {
        imageUrl: this.generateNFTPlaceholder(nftAddress),
        metadata: {
          name: 'Solcials NFT',
          description: 'NFT from Solcials platform',
          creator: 'Unknown',
          createdAt: Date.now()
        }
      };
      
    } catch (error) {
      console.error('Failed to fetch NFT metadata:', error);
      
      // Return a placeholder on error
      return {
        imageUrl: this.generateNFTPlaceholder(nftAddress),
        metadata: {
          name: 'NFT',
          description: 'Unable to load NFT metadata',
          creator: 'Unknown',
          createdAt: Date.now()
        }
      };
    }
  }

  // Generate a consistent placeholder for NFTs
  private static generateNFTPlaceholder(nftAddress: PublicKey): string {
    const shortAddress = nftAddress.toString().slice(0, 8);
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="nftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#nftGrad)"/>
        <circle cx="200" cy="120" r="30" fill="white" opacity="0.2"/>
        <text x="200" y="175" text-anchor="middle" font-family="Arial" font-size="16" fill="white" font-weight="bold">
          Solcials NFT
        </text>
        <text x="200" y="195" text-anchor="middle" font-family="Arial" font-size="12" fill="white" opacity="0.9">
          ${shortAddress}...
        </text>
        <text x="200" y="215" text-anchor="middle" font-family="Arial" font-size="10" fill="white" opacity="0.7">
          Blockchain verified
        </text>
      </svg>
    `)}`;
  }

  // Bulk resolve multiple NFT URLs
  static async bulkResolveNFTUrls(nftUrls: string[], postContents?: Map<string, string>): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Process all URLs in parallel
    const promises = nftUrls.map(async (url) => {
      try {
        const postContent = postContents?.get(url);
        const resolved = await this.resolveNFTUrl(url, postContent);
        results.set(url, resolved);
      } catch (error) {
        console.error(`Failed to resolve ${url}:`, error);
        results.set(url, url); // Fallback to original URL
      }
    });
    
    await Promise.all(promises);
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