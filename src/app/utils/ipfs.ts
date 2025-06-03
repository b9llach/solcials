// // Browser-compatible image upload service
// // For Solana production, you'd want to integrate with services like:
// // - NFT.Storage (https://nft.storage/) - Blockchain agnostic IPFS
// // - Arweave (https://arweave.org/) - Solana ecosystem favorite
// // - Shadow Drive (https://shdw-drive.genesysgo.net/) - Solana-native

// export interface UploadResult {
//   hash: string;
//   url: string;
//   size: number;
// }

// export class ImageUploadService {
//   static async uploadImage(file: File): Promise<UploadResult> {
//     try {
//       // Validate file type
//       if (!file.type.startsWith('image/')) {
//         throw new Error('Only image files are allowed');
//       }

//       // With cNFTs, images are stored on IPFS so we don't need the 5MB on-chain limit
//       // IPFS can handle much larger files efficiently
//       // Optional: You could still set a reasonable limit for user experience (e.g., 100MB)
//       // const maxSize = 100 * 1024 * 1024; // 100MB
//       // if (file.size > maxSize) {
//       //   throw new Error('Image must be smaller than 100MB');
//       // }

//       // Convert to base64 for demo (works in browser)
//       const base64 = await this.fileToBase64(file);
      
//       // Generate a mock IPFS-style hash for demo
//       const mockHash = 'QmDemo' + Math.random().toString(36).substring(7);
      
//       console.log('📸 Image processed for upload:', {
//         name: file.name,
//         size: file.size,
//         type: file.type,
//         hash: mockHash
//       });

//       return {
//         hash: mockHash,
//         url: base64, // Using base64 data URL for demo
//         size: file.size
//       };
//     } catch (error) {
//       console.error('Image upload error:', error);
//       throw error instanceof Error ? error : new Error('Failed to upload image');
//     }
//   }

//   private static fileToBase64(file: File): Promise<string> {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onload = () => resolve(reader.result as string);
//       reader.onerror = reject;
//       reader.readAsDataURL(file);
//     });
//   }

//   static getImageUrl(hash: string): string {
//     // If it's a data URL, return as is
//     if (hash.startsWith('data:')) {
//       return hash;
//     }
//     // For real IPFS hashes, use gateway
//     return `https://ipfs.io/ipfs/${hash}`;
//   }

//   static isValidImageHash(hash: string): boolean {
//     // Check if it's a data URL or IPFS hash
//     return hash.startsWith('data:') || 
//            (hash.length > 10 && (hash.startsWith('Qm') || hash.startsWith('bafy')));
//   }

//   // Solana-native storage solutions
//   static async uploadToNFTStorage(file: File, apiKey: string): Promise<UploadResult> {
//     // NFT.Storage is blockchain agnostic but commonly used in Solana ecosystem
//     const formData = new FormData();
//     formData.append('file', file);

//     try {
//       const response = await fetch('https://api.nft.storage/upload', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${apiKey}`,
//         },
//         body: formData,
//       });

//       const result = await response.json();
      
//       return {
//         hash: result.value.cid,
//         url: `https://nftstorage.link/ipfs/${result.value.cid}`,
//         size: file.size
//       };
//     } catch (error) {
//       console.error('NFT.Storage upload failed:', error);
//       throw new Error('Failed to upload to IPFS via NFT.Storage');
//     }
//   }

//   static async uploadToArweave(file: File, wallet: any): Promise<UploadResult> {
//     // Arweave has strong integration with Solana ecosystem
//     try {
//       // This would use @solana/web3.js and arweave-js
//       // Implementation would depend on your Arweave setup
//       const mockTxId = 'ar_' + Math.random().toString(36).substring(7);
      
//       return {
//         hash: mockTxId,
//         url: `https://arweave.net/${mockTxId}`,
//         size: file.size
//       };
//     } catch (error) {
//       console.error('Arweave upload failed:', error);
//       throw new Error('Failed to upload to Arweave');
//     }
//   }

//   static async uploadToShadowDrive(file: File, connection: any, wallet: any): Promise<UploadResult> {
//     // Shadow Drive (GenesysGo) - Solana-native decentralized storage
//     try {
//       // This would use @shadow-drive/sdk
//       // Implementation would depend on your Shadow Drive setup
//       const mockShdwUrl = 'shdw_' + Math.random().toString(36).substring(7);
      
//       return {
//         hash: mockShdwUrl,
//         url: `https://shdw-drive.genesysgo.net/${mockShdwUrl}`,
//         size: file.size
//       };
//     } catch (error) {
//       console.error('Shadow Drive upload failed:', error);
//       throw new Error('Failed to upload to Shadow Drive');
//     }
//   }
// }

// // For backward compatibility, export the main service as SimpleIPFSService
// export const SimpleIPFSService = ImageUploadService; 