// Browser-compatible image upload service
// For production, you'd want to integrate with services like:
// - Pinata (https://pinata.cloud/)
// - NFT.Storage (https://nft.storage/)
// - Web3.Storage (https://web3.storage/)

export interface UploadResult {
  hash: string;
  url: string;
  size: number;
}

export class ImageUploadService {
  static async uploadImage(file: File): Promise<UploadResult> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('Image must be smaller than 5MB');
      }

      // Convert to base64 for demo (works in browser)
      const base64 = await this.fileToBase64(file);
      
      // Generate a mock IPFS-style hash for demo
      const mockHash = 'QmDemo' + Math.random().toString(36).substring(7);
      
      console.log('📸 Image processed for upload:', {
        name: file.name,
        size: file.size,
        type: file.type,
        hash: mockHash
      });

      return {
        hash: mockHash,
        url: base64, // Using base64 data URL for demo
        size: file.size
      };
    } catch (error) {
      console.error('Image upload error:', error);
      throw error instanceof Error ? error : new Error('Failed to upload image');
    }
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  static getImageUrl(hash: string): string {
    // If it's a data URL, return as is
    if (hash.startsWith('data:')) {
      return hash;
    }
    // For real IPFS hashes, use gateway
    return `https://ipfs.io/ipfs/${hash}`;
  }

  static isValidImageHash(hash: string): boolean {
    // Check if it's a data URL or IPFS hash
    return hash.startsWith('data:') || 
           (hash.length > 10 && (hash.startsWith('Qm') || hash.startsWith('bafy')));
  }

  // Future IPFS integration methods
  static async uploadToPinata(file: File, apiKey: string, secretKey: string): Promise<UploadResult> {
    // This would be implemented for production use with Pinata
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': apiKey,
          'pinata_secret_api_key': secretKey,
        },
        body: formData,
      });

      const result = await response.json();
      
      return {
        hash: result.IpfsHash,
        url: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
        size: file.size
      };
    } catch (error) {
      console.error('Pinata upload failed:', error);
      throw new Error('Failed to upload to IPFS via Pinata');
    }
  }
}

// For backward compatibility, export the main service as SimpleIPFSService
export const SimpleIPFSService = ImageUploadService; 