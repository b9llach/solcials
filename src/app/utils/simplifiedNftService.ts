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

      console.log('🎉 NFT created successfully!');
      console.log('🪙 NFT Address:', mintAccount.toString());
      console.log('📄 Transaction:', signature);

      // Step 7: Store metadata locally for retrieval
      const metadata: NFTMetadata = {
        mintAddress: mintAccount.toString(),
        imageUrl: gatewayUrl,
        ipfsCid: cid,
        creator: wallet.publicKey.toString(),
        caption,
        createdAt: Date.now(),
      };

      this.storeNFTMetadata(mintAccount, metadata);

      return {
        nftAddress: mintAccount,
        transactionSignature: signature,
        imageUrl: gatewayUrl,
        ipfsCid: cid,
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

  // Get NFT metadata from local storage
  async getNFTMetadata(mintAddress: PublicKey): Promise<NFTMetadata | null> {
    try {
      const key = `nft_metadata_${mintAddress.toString()}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        return JSON.parse(stored) as NFTMetadata;
      }

      // If not found locally, return basic info
      return {
        mintAddress: mintAddress.toString(),
        imageUrl: '',
        ipfsCid: '',
        creator: '',
        caption: 'NFT metadata not found',
        createdAt: 0,
      };

    } catch (error) {
      console.error('Failed to get NFT metadata:', error);
      return null;
    }
  }

  // Check if an NFT exists
  async nftExists(mintAddress: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(mintAddress);
      return accountInfo !== null;
    } catch {
      return false;
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