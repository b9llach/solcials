import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token';
import { getLighthouseService } from './lighthouseService';

interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: ((transaction: Transaction) => Promise<Transaction>) | undefined;
  signAllTransactions: ((transactions: Transaction[]) => Promise<Transaction[]>) | undefined;
  connected: boolean;
}

interface SimplifiedNFTResult {
  nftAddress: PublicKey;
  transactionSignature: string;
  imageUrl: string;
  ipfsCid: string;
  metadataCid?: string; // IPFS CID of the metadata JSON for public access
}

interface NFTMetadata {
  mintAddress: string;
  imageUrl: string;
  ipfsCid: string;
  creator: string;
  caption: string;
  createdAt: number;
}

export class SimplifiedNFTService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async createImageNFT(
    wallet: WalletAdapter,
    imageFile: File,
    caption: string
  ): Promise<SimplifiedNFTResult> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not properly connected');
    }

    try {
      // Step 1: Upload image to Lighthouse Storage (IPFS + Filecoin)
      console.log('📤 Uploading image to Lighthouse Storage...');
      const lighthouseService = getLighthouseService();
      const { cid, gatewayUrl } = await lighthouseService.uploadImage(imageFile);

      console.log('✅ Image uploaded to Lighthouse!');
      console.log('🔗 IPFS CID:', cid);
      console.log('🌐 Gateway URL:', gatewayUrl);

      // Step 2: Create NFT mint account
      console.log('🪙 Creating NFT mint...');
      const mintKeypair = Keypair.generate();
      const mintAccount = mintKeypair.publicKey;

      // Step 3: Get associated token account
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintAccount,
        wallet.publicKey
      );

      // Step 4: Build transaction
      const transaction = new Transaction();
      
      // Create mint account
      const mintRent = await getMinimumBalanceForRentExemptMint(this.connection);
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintAccount,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintAccount,
          0, // 0 decimals for NFT
          wallet.publicKey,
          wallet.publicKey
        )
      );

      // Create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintAccount
        )
      );

      // Mint token to associated account
      transaction.add(
        createMintToInstruction(
          mintAccount,
          associatedTokenAccount,
          wallet.publicKey,
          1 // Mint 1 token (NFT)
        )
      );

      // Step 5: Send transaction
      console.log('📡 Sending NFT creation transaction...');
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign with mint keypair first
      transaction.partialSign(mintKeypair);
      
      // Then sign with wallet
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );

      // Step 6: Confirm transaction
      console.log('⏳ Confirming NFT creation...');
      await this.connection.confirmTransaction(signature, 'confirmed');

      // Step 6.5: VALIDATE NFT WAS ACTUALLY CREATED
      console.log('🔍 Validating NFT was successfully created on blockchain...');
      const mintAccountInfo = await this.connection.getAccountInfo(mintAccount);
      if (!mintAccountInfo) {
        throw new Error(`NFT creation failed: Mint account ${mintAccount.toString()} was not created despite transaction confirmation`);
      }
      
      if (mintAccountInfo.data.length !== 82) {
        throw new Error(`NFT creation failed: Invalid mint account data length (${mintAccountInfo.data.length} bytes, expected 82)`);
      }
      
      console.log('✅ NFT validation passed: Mint account exists and is valid');

      console.log('🎉 NFT created successfully!');
      console.log('🪙 NFT Address:', mintAccount.toString());
      console.log('📄 Transaction:', signature);

      // Step 7: Store metadata both locally AND on IPFS for public access
      const metadata: NFTMetadata = {
        mintAddress: mintAccount.toString(),
        imageUrl: gatewayUrl,
        ipfsCid: cid,
        creator: wallet.publicKey.toString(),
        caption,
        createdAt: Date.now(),
      };

      // Store locally for immediate access
      this.storeNFTMetadata(mintAccount, metadata);
      
      // ALSO store metadata on IPFS so other users can access it
      let metadataCid: string | undefined;
      try {
        console.log('📤 Uploading NFT metadata to IPFS for public access...');
        const metadataJson = JSON.stringify(metadata);
        const metadataFile = new File([metadataJson], `${mintAccount.toString()}.json`, {
          type: 'application/json'
        });
        
        const { cid: uploadedMetadataCid } = await lighthouseService.uploadImage(metadataFile);
        metadataCid = uploadedMetadataCid;
        console.log('✅ NFT metadata uploaded to IPFS:', metadataCid);
        
        // Store the metadata CID reference locally so we can find it later
        const metadataReference = {
          mintAddress: mintAccount.toString(),
          metadataCid,
          imageUrl: gatewayUrl,
          ipfsCid: cid
        };
        
        localStorage.setItem(`nft_metadata_ref_${mintAccount.toString()}`, JSON.stringify(metadataReference));
        console.log('📝 Stored NFT metadata reference for public access');
        
      } catch (metadataUploadError) {
        console.warn('⚠️ Failed to upload metadata to IPFS, but NFT was created successfully:', metadataUploadError);
        // Don't fail the whole operation if metadata upload fails
      }

      return {
        nftAddress: mintAccount,
        transactionSignature: signature,
        imageUrl: gatewayUrl,
        ipfsCid: cid,
        metadataCid,
      };

    } catch (error) {
      console.error('❌ Failed to create NFT:', error);
      throw new Error(`NFT creation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Store NFT metadata locally (in production, this would be on IPFS or on-chain)
  private storeNFTMetadata(mintAddress: PublicKey, metadata: NFTMetadata): void {
    try {
      const key = `nft_metadata_${mintAddress.toString()}`;
      localStorage.setItem(key, JSON.stringify(metadata));
      console.log('📝 Stored NFT metadata locally for:', mintAddress.toString());
    } catch (error) {
      console.warn('Failed to store NFT metadata:', error);
    }
  }

  // Extract metadata CID from post content if present
  private extractMetadataCidFromPost(postContent: string): string | null {
    const metaMatch = postContent.match(/__META:([a-zA-Z0-9]+)__/);
    return metaMatch ? metaMatch[1] : null;
  }

  // Get NFT metadata from local storage, IPFS, or post content
  async getNFTMetadata(mintAddress: PublicKey, postContent?: string): Promise<NFTMetadata | null> {
    try {
      const key = `nft_metadata_${mintAddress.toString()}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        const metadata = JSON.parse(stored) as NFTMetadata;
        console.log('📦 Found NFT metadata in localStorage:', mintAddress.toString());
        return metadata;
      }

      // If post content is provided, try to extract metadata CID from it
      if (postContent) {
        const metadataCid = this.extractMetadataCidFromPost(postContent);
        if (metadataCid) {
          try {
            console.log('📋 Found metadata CID in post content:', metadataCid);
            
            // Fetch metadata from IPFS
            const metadataUrl = `https://gateway.lighthouse.storage/ipfs/${metadataCid}`;
            const response = await fetch(metadataUrl);
            
            if (response.ok) {
              const ipfsMetadata = await response.json() as NFTMetadata;
              console.log('✅ Successfully fetched NFT metadata from IPFS via post content');
              
              // Cache it locally for next time
              localStorage.setItem(key, JSON.stringify(ipfsMetadata));
              return ipfsMetadata;
            } else {
              console.warn('⚠️ Failed to fetch metadata from IPFS, status:', response.status);
            }
          } catch (ipfsError) {
            console.warn('⚠️ Error fetching metadata from IPFS via post content:', ipfsError);
          }
        }
      }

      // If not found locally, try to fetch from IPFS using metadata reference
      console.log('🔍 Attempting to fetch NFT metadata from IPFS reference:', mintAddress.toString());
      const metadataRef = localStorage.getItem(`nft_metadata_ref_${mintAddress.toString()}`);
      
      if (metadataRef) {
        try {
          const reference = JSON.parse(metadataRef);
          console.log('📋 Found metadata reference:', reference);
          
          // Fetch metadata from IPFS
          const metadataUrl = `https://gateway.lighthouse.storage/ipfs/${reference.metadataCid}`;
          const response = await fetch(metadataUrl);
          
          if (response.ok) {
            const ipfsMetadata = await response.json() as NFTMetadata;
            console.log('✅ Successfully fetched NFT metadata from IPFS');
            
            // Cache it locally for next time
            localStorage.setItem(key, JSON.stringify(ipfsMetadata));
            return ipfsMetadata;
          } else {
            console.warn('⚠️ Failed to fetch metadata from IPFS, status:', response.status);
          }
        } catch (ipfsError) {
          console.warn('⚠️ Error fetching metadata from IPFS:', ipfsError);
        }
      }

      // If not found in IPFS references, try blockchain fallback
      console.log('🔍 Attempting to fetch NFT metadata from blockchain:', mintAddress.toString());
      return await this.fetchNFTFromBlockchain(mintAddress);

    } catch (error) {
      console.error('Failed to get NFT metadata:', error);
      
      // Return a placeholder with the mint address
      return {
        mintAddress: mintAddress.toString(),
        imageUrl: this.generatePlaceholderImage(mintAddress),
        ipfsCid: '',
        creator: '',
        caption: 'NFT metadata unavailable',
        createdAt: 0,
      };
    }
  }

  // Fetch NFT metadata from blockchain (fallback when localStorage is empty)
  private async fetchNFTFromBlockchain(mintAddress: PublicKey): Promise<NFTMetadata | null> {
    try {
      // Check if mint account exists
      const accountInfo = await this.connection.getAccountInfo(mintAddress);
      if (!accountInfo) {
        console.log('❌ NFT mint account not found:', mintAddress.toString());
        return null;
      }

      // For now, return a basic structure since we don't have on-chain metadata yet
      // In a full implementation, you'd parse the account data or use Metaplex
      return {
        mintAddress: mintAddress.toString(),
        imageUrl: this.generatePlaceholderImage(mintAddress),
        ipfsCid: '',
        creator: '',
        caption: 'NFT created with Solcials',
        createdAt: 0,
      };

    } catch (error) {
      console.error('Failed to fetch NFT from blockchain:', error);
      return null;
    }
  }

  // Generate a consistent placeholder image for NFTs
  private generatePlaceholderImage(mintAddress: PublicKey): string {
    const shortAddress = mintAddress.toString().slice(0, 8);
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#grad)"/>
        <text x="200" y="130" text-anchor="middle" font-family="Arial" font-size="18" fill="white" font-weight="bold">
          Solcials NFT
        </text>
        <text x="200" y="155" text-anchor="middle" font-family="Arial" font-size="14" fill="white" opacity="0.9">
          ${shortAddress}...
        </text>
        <text x="200" y="180" text-anchor="middle" font-family="Arial" font-size="12" fill="white" opacity="0.7">
          Image Loading...
        </text>
      </svg>
    `)}`;
  }

  // Check if an NFT exists and is valid
  async nftExists(mintAddress: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(mintAddress);
      
      // Check if account exists and has the correct size for a mint account
      if (!accountInfo || accountInfo.data.length !== 82) {
        return false;
      }
      
      // Additional validation: check if it's actually a mint account
      // Mint accounts have specific data structure and are owned by the Token Program
      if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // Validate multiple NFT addresses at once
  async validateNFTBatch(mintAddresses: PublicKey[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const promises = mintAddresses.map(async (mintAddress) => {
      const exists = await this.nftExists(mintAddress);
      results.set(mintAddress.toString(), exists);
    });
    
    await Promise.all(promises);
    return results;
  }

  // Clean up invalid NFT metadata from localStorage
  async cleanupInvalidNFTMetadata(): Promise<string[]> {
    const cleaned: string[] = [];
    
    try {
      const nftKeys: string[] = [];
      
      // Find all NFT metadata keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nft_metadata_')) {
          nftKeys.push(key);
        }
      }
      
      console.log(`🔍 Found ${nftKeys.length} NFT metadata entries to validate`);
      
      // Validate each NFT
      for (const key of nftKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const metadata = JSON.parse(stored) as NFTMetadata;
            const mintAddress = new PublicKey(metadata.mintAddress);
            
            const exists = await this.nftExists(mintAddress);
            if (!exists) {
              console.log(`🗑️ Removing invalid NFT metadata: ${metadata.mintAddress}`);
              localStorage.removeItem(key);
              cleaned.push(metadata.mintAddress);
            }
          } catch (error) {
            console.warn(`Failed to validate NFT metadata ${key}:`, error);
            localStorage.removeItem(key);
            cleaned.push(key);
          }
        }
      }
      
      console.log(`✅ Cleaned up ${cleaned.length} invalid NFT metadata entries`);
      return cleaned;
      
    } catch (error) {
      console.error('Failed to cleanup NFT metadata:', error);
      return [];
    }
  }

  // Get all user's created NFTs (from local storage)
  getUserNFTs(userPublicKey: PublicKey): NFTMetadata[] {
    try {
      const userKey = userPublicKey.toString();
      const allNFTs: NFTMetadata[] = [];
      
      // Scan localStorage for NFT metadata
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nft_metadata_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const metadata = JSON.parse(stored) as NFTMetadata;
            if (metadata.creator === userKey) {
              allNFTs.push(metadata);
            }
          }
        }
      }

      // Sort by creation date (newest first)
      return allNFTs.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Failed to get user NFTs:', error);
      return [];
    }
  }

  // Get multiple gateway URLs for better reliability
  getImageGatewayUrls(cid: string): string[] {
    return [
      `https://gateway.lighthouse.storage/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`
    ];
  }

  // Try multiple IPFS gateways to load image
  async getReliableImageUrl(cid: string): Promise<string> {
    const gateways = this.getImageGatewayUrls(cid);
    
    for (const gatewayUrl of gateways) {
      try {
        // Test if the image loads from this gateway
        const response = await fetch(gatewayUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log('✅ Image found on gateway:', gatewayUrl);
          return gatewayUrl;
        }
      } catch (error) {
        console.warn('Gateway failed:', gatewayUrl, error);
        continue;
      }
    }
    
    // If all gateways fail, return the first one anyway
    console.warn('All IPFS gateways failed, using default');
    return gateways[0];
  }
}

// Singleton instance
let simplifiedNFTService: SimplifiedNFTService | null = null;

export function getSimplifiedNFTService(): SimplifiedNFTService {
  // We'll use a connection from the context when possible
  // For now, we'll use devnet
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );
  
  if (!simplifiedNFTService) {
    simplifiedNFTService = new SimplifiedNFTService(connection);
  }
  return simplifiedNFTService;
} 