import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  AccountInfo,
} from '@solana/web3.js';
import { SocialPost } from '../types/social';
import { getProgramId, getPlatformTreasury } from './networkConfig';
import * as anchor from '@coral-xyz/anchor';
import { sha256 } from 'js-sha256';

// Your custom Solcials program ID from deployment
const SOLCIALS_PROGRAM_ID = new PublicKey(getProgramId());

// Platform treasury for collecting fees - use environment variable
const PLATFORM_TREASURY = new PublicKey(getPlatformTreasury());

// Anchor instruction discriminators (8-byte SHA256 hash of "global:function_name")
const INSTRUCTION_DISCRIMINATORS = {
  initializeUserProfile: Buffer.from(sha256.digest("global:initialize_user_profile")).slice(0, 8),
  createTextPost: Buffer.from(sha256.digest("global:create_text_post")).slice(0, 8),
  createImagePost: Buffer.from(sha256.digest("global:create_image_post")).slice(0, 8),
  linkCnftToPost: Buffer.from(sha256.digest("global:link_cnft_to_post")).slice(0, 8),
  followUser: Buffer.from(sha256.digest("global:follow_user")).slice(0, 8),
  likePost: Buffer.from(sha256.digest("global:like_post")).slice(0, 8),
  updateUserProfile: Buffer.from(sha256.digest("global:update_user_profile")).slice(0, 8),
  unfollowUser: Buffer.from(sha256.digest("global:unfollow_user")).slice(0, 8),
  unlikePost: Buffer.from(sha256.digest("global:unlike_post")).slice(0, 8),
};

interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction>(transaction: T) => Promise<T>;
  connected: boolean;
}

// TypeScript interfaces matching your Rust structs
export interface CustomPost {
  author: PublicKey;
  content: string;
  postType: number; // 0 = text, 1 = image
  imageNft: PublicKey | null; // cNFT address for image posts
  replyTo: PublicKey | null;
  timestamp: number;
  likes: number;
  reposts: number;
  replies: number;
  bump: number;
}

export interface CustomUserProfile {
  user: PublicKey;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  websiteUrl: string | null;
  location: string | null;
  followersCount: number;
  followingCount: number;
  postCount: number;
  createdAt: number;
  verified: boolean;
  bump: number;
}

export class SolcialsCustomProgramService {
  private connection: Connection;
  private programId: PublicKey;
  private platformTreasury: PublicKey;
  
  // Rate limiting and retry logic
  private lastRequest = 0;
  private requestCount = 0;
  private readonly minDelay = 1000; // Minimum 1 second between requests
  private readonly maxRetries = 3;

  // Global cache for ALL program accounts - this is the key optimization
  private allAccountsCache: {
    data: Readonly<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>> | null;
    timestamp: number;
    isLoading: boolean;
  } = {
    data: null,
    timestamp: 0,
    isLoading: false
  };

  // Cache duration: 2 minutes for account data (much longer since blockchain data doesn't change frequently)
  private readonly ACCOUNTS_CACHE_DURATION = 120000; // 2 minutes

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = SOLCIALS_PROGRAM_ID;
    this.platformTreasury = PLATFORM_TREASURY;
  }

  // Single source of truth for ALL program accounts - massive RPC saver
  private async getAllProgramAccounts(force = false): Promise<Readonly<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>>> {
    const now = Date.now();
    
    // Return cached data if valid and not forcing refresh
    if (!force && 
        this.allAccountsCache.data && 
        (now - this.allAccountsCache.timestamp) < this.ACCOUNTS_CACHE_DURATION) {
      console.log('📦 Using cached program accounts (RPC saved!)');
      return this.allAccountsCache.data;
    }

    // Prevent multiple simultaneous fetches
    if (this.allAccountsCache.isLoading && !force) {
      console.log('⏳ Waiting for ongoing account fetch...');
      // Wait for the current fetch to complete
      while (this.allAccountsCache.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.allAccountsCache.data || [];
    }

    try {
      console.log('🔄 Fetching ALL program accounts (expensive RPC call)...');
      this.allAccountsCache.isLoading = true;
      
      const accounts = await this.retryRequest(async () => {
        return await this.connection.getProgramAccounts(this.programId);
      });

      // Cache the results
      this.allAccountsCache = {
        data: accounts,
        timestamp: now,
        isLoading: false
      };

      console.log(`✅ Cached ${accounts.length} program accounts - will reuse for 2 minutes`);
      return accounts;
    } catch (error) {
      this.allAccountsCache.isLoading = false;
      console.error('❌ Failed to fetch program accounts:', error);
      return this.allAccountsCache.data || [];
    }
  }

  // Clear cache manually if needed (after posting, following, etc.)
  public clearAccountsCache(): void {
    console.log('🧹 Clearing accounts cache - forcing fresh fetch');
    this.allAccountsCache = {
      data: null,
      timestamp: 0,
      isLoading: false
    };
    // Also clear the replies cache
    this.repliesCache.clear();
  }

  // Add delay between requests to prevent rate limiting
  private async rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    // Enforce minimum delay between requests
    if (timeSinceLastRequest < this.minDelay) {
      const delay = this.minDelay - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequest = Date.now();
    this.requestCount++;
    
    // Add exponential backoff for multiple requests
    if (this.requestCount > 10) {
      const backoffDelay = Math.min(this.requestCount * 100, 5000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
    
    return requestFn();
  }

  // Retry wrapper for handling 429 errors
  private async retryRequest<T>(requestFn: () => Promise<T>, retries = this.maxRetries): Promise<T> {
    try {
      return await this.rateLimitedRequest(requestFn);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429') && retries > 0) {
        const delay = Math.pow(2, this.maxRetries - retries) * 2000; // Exponential backoff
        console.warn(`🔄 Rate limited (429), retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  // Reset rate limiting counters periodically
  private resetRateLimiting() {
    setInterval(() => {
      this.requestCount = Math.max(0, this.requestCount - 5); // Gradually reduce count
    }, 60000); // Every minute
  }

  // Derive PDA for post account
  private getPostPDA(author: PublicKey, timestamp: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('post'),
        author.toBuffer(),
        new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8)
      ],
      this.programId
    );
  }

  // Derive PDA for user profile
  private getUserProfilePDA(user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), user.toBuffer()],
      this.programId
    );
  }

  // Derive PDA for follow relationship
  private getFollowPDA(follower: PublicKey, following: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('follow'),
        follower.toBuffer(),
        following.toBuffer()
      ],
      this.programId
    );
  }

  // Derive PDA for like relationship
  private getLikePDA(user: PublicKey, post: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('like'),
        user.toBuffer(),
        post.toBuffer()
      ],
      this.programId
    );
  }

  // Initialize user profile (first time setup)
  async initializeUserProfile(wallet: WalletAdapter): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [userProfilePDA] = this.getUserProfilePDA(wallet.publicKey);

    // Check if profile already exists
    const existingProfile = await this.connection.getAccountInfo(userProfilePDA);
    if (existingProfile) {
      throw new Error('User profile already exists');
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: INSTRUCTION_DISCRIMINATORS.initializeUserProfile,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ User profile initialized:', signature);
    return signature;
  }

  // Create a text post (free)
  async createTextPost(
    wallet: WalletAdapter, 
    content: string, 
    replyTo?: PublicKey
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    if (content.length > 280) {
      throw new Error('Content too long (max 280 characters)');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const [postPDA] = this.getPostPDA(wallet.publicKey, timestamp);
    const [userProfilePDA] = this.getUserProfilePDA(wallet.publicKey);

    // Ensure user profile exists
    await this.ensureUserProfile(wallet);

    // Create instruction data
    const instructionData = Buffer.alloc(8 + 4 + Buffer.byteLength(content, 'utf8') + 8 + (replyTo ? 1 + 32 : 1));
    let offset = 0;
    
    // Instruction discriminator for create_text_post
    INSTRUCTION_DISCRIMINATORS.createTextPost.copy(instructionData, offset);
    offset += 8;
    
    // Content length + content
    instructionData.writeUInt32LE(Buffer.byteLength(content, 'utf8'), offset);
    offset += 4;
    instructionData.write(content, offset, 'utf8');
    offset += Buffer.byteLength(content, 'utf8');
    
    // Timestamp (i64, little endian)
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestamp));
    timestampBuffer.copy(instructionData, offset);
    offset += 8;
    
    // Reply to (optional)
    if (replyTo) {
      instructionData.writeUInt8(1, offset); // Some discriminator
      offset += 1;
      replyTo.toBuffer().copy(instructionData, offset);
    } else {
      instructionData.writeUInt8(0, offset); // None discriminator
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: postPDA, isSigner: false, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: PLATFORM_TREASURY, isSigner: false, isWritable: true }, // Platform fee recipient
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ Text post created:', signature);
    
    // Clear cache since we added new data
    this.clearAccountsCache();
    
    return signature;
  }

  // Create an image post (premium with platform fee)
  async createImagePost(
    wallet: WalletAdapter, 
    content: string, 
    replyTo?: PublicKey
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    if (content.length > 280) {
      throw new Error('Content too long (max 280 characters)');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const [postPDA] = this.getPostPDA(wallet.publicKey, timestamp);
    const [userProfilePDA] = this.getUserProfilePDA(wallet.publicKey);

    // Ensure user profile exists
    await this.ensureUserProfile(wallet);

    // Create instruction data (similar to text post)
    const instructionData = Buffer.alloc(8 + 4 + Buffer.byteLength(content, 'utf8') + 8 + (replyTo ? 1 + 32 : 1));
    let offset = 0;
    
    // Instruction discriminator for create_image_post
    INSTRUCTION_DISCRIMINATORS.createImagePost.copy(instructionData, offset);
    offset += 8;
    
    // Content length + content
    instructionData.writeUInt32LE(Buffer.byteLength(content, 'utf8'), offset);
    offset += 4;
    instructionData.write(content, offset, 'utf8');
    offset += Buffer.byteLength(content, 'utf8');
    
    // Timestamp (i64, little endian)
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestamp));
    timestampBuffer.copy(instructionData, offset);
    offset += 8;
    
    // Reply to (optional)
    if (replyTo) {
      instructionData.writeUInt8(1, offset); // Some discriminator
      offset += 1;
      replyTo.toBuffer().copy(instructionData, offset);
    } else {
      instructionData.writeUInt8(0, offset); // None discriminator
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: postPDA, isSigner: false, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: PLATFORM_TREASURY, isSigner: false, isWritable: true }, // Platform fee recipient
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ Image post created with platform fee:', signature);
    
    // Clear cache since we added new data
    this.clearAccountsCache();
    
    return signature;
  }

  // Follow a user
  async followUser(wallet: WalletAdapter, targetUser: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [followPDA] = this.getFollowPDA(wallet.publicKey, targetUser);
    const [followerProfilePDA] = this.getUserProfilePDA(wallet.publicKey);
    const [followingProfilePDA] = this.getUserProfilePDA(targetUser);

    // Ensure your own profile exists
    await this.ensureUserProfile(wallet);
    
    // Check if the target user has a profile
    const targetUserProfile = await this.connection.getAccountInfo(followingProfilePDA);
    if (!targetUserProfile) {
      throw new Error('Cannot follow this user: they haven\'t set up their profile yet. They need to create a post or update their profile first.');
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: followPDA, isSigner: false, isWritable: true },
        { pubkey: followerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: followingProfilePDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: targetUser, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: INSTRUCTION_DISCRIMINATORS.followUser,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ User followed:', signature);
    
    // Clear cache since we added new data
    this.clearAccountsCache();
    
    return signature;
  }

  // Like a post
  async likePost(wallet: WalletAdapter, postPubkey: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [likePDA] = this.getLikePDA(wallet.publicKey, postPubkey);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: likePDA, isSigner: false, isWritable: true },
        { pubkey: postPubkey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: INSTRUCTION_DISCRIMINATORS.likePost,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ Post liked:', signature);
    
    // Clear cache since we added new data
    this.clearAccountsCache();
    
    return signature;
  }

  // Helper method to ensure user profile exists
  private async ensureUserProfile(wallet: WalletAdapter): Promise<void> {
    if (!wallet.publicKey) return;

    const [userProfilePDA] = this.getUserProfilePDA(wallet.publicKey);
    const existingProfile = await this.connection.getAccountInfo(userProfilePDA);
    
    if (!existingProfile) {
      console.log('🔧 Creating user profile...');
      await this.initializeUserProfile(wallet);
    }
  }

  // Get posts (fetch and parse from custom program)
  async getPosts(limit: number = 20): Promise<SocialPost[]> {
    return this.retryRequest(async () => {
      console.log('🔍 Fetching posts from Solcials custom program...');
      
      // Hard-coded filter for specific transaction to exclude
      const EXCLUDED_TRANSACTIONS = ['FETGTvVFBPx2c3ojK3wquiYm2vuCGei8rUkAVCjqPKib'];

      // Get all accounts owned by our program (remove filter for now)
      const accounts = await this.getAllProgramAccounts();

      console.log(`📦 Found ${accounts.length} program accounts`);

      const posts: SocialPost[] = [];
      let parsedCount = 0;
      let errorCount = 0;
        
      for (const account of accounts) {
        try {
          // Skip excluded transactions
          if (EXCLUDED_TRANSACTIONS.includes(account.pubkey.toString())) {
            console.log(`🚫 Skipping excluded transaction: ${account.pubkey.toString()}`);
            continue;
          }

          // Parse the account data
          const data = account.account.data;
          
          // Check if this is a post account by checking discriminator
          // Skip discriminator (8 bytes) and start parsing Post struct
          if (data.length < 8) continue;
          
          let offset = 8; // Skip discriminator
          
          // Parse Post struct fields (UPDATED for new contract structure):
          // pub author: Pubkey (32 bytes)
          // pub content: String (4 bytes length + content)
          // pub post_type: u8 (1 byte)
          // pub image_nft: Option<Pubkey> (1 byte discriminator + optional 32 bytes)
          // pub reply_to: Option<Pubkey> (1 byte discriminator + optional 32 bytes)
          // pub timestamp: i64 (8 bytes)
          // pub likes: u64 (8 bytes)
          // pub reposts: u64 (8 bytes) 
          // pub replies: u64 (8 bytes)
          // pub bump: u8 (1 byte)

          if (data.length < offset + 32) continue;

          // Author (32 bytes)
          const authorBytes = data.slice(offset, offset + 32);
          const author = new PublicKey(authorBytes);
          offset += 32;

          // Content length (4 bytes)
          if (data.length < offset + 4) continue;
          const contentLength = data.readUInt32LE(offset);
          offset += 4;

          // Content string
          if (data.length < offset + contentLength) continue;
          const content = data.slice(offset, offset + contentLength).toString('utf8');
          offset += contentLength;

          // Post type (1 byte)
          if (data.length < offset + 1) continue;
          const postType = data.readUInt8(offset);
          offset += 1;

          // Image NFT option (1 byte discriminator + optional 32 bytes)
          if (data.length < offset + 1) continue;
          const hasImageNft = data.readUInt8(offset);
          offset += 1;
          
          let imageNft: PublicKey | undefined = undefined;
          if (hasImageNft === 1) {
            if (data.length < offset + 32) continue;
            const imageNftBytes = data.slice(offset, offset + 32);
            imageNft = new PublicKey(imageNftBytes);
            offset += 32;
          }

          // Reply to option (1 byte discriminator + optional 32 bytes)
          if (data.length < offset + 1) continue;
          const hasReplyTo = data.readUInt8(offset);
          offset += 1;
          
          let replyTo: PublicKey | undefined = undefined;
          if (hasReplyTo === 1) {
            if (data.length < offset + 32) continue;
            const replyToBytes = data.slice(offset, offset + 32);
            replyTo = new PublicKey(replyToBytes);
            offset += 32;
          }

          // Timestamp (8 bytes)
          if (data.length < offset + 8) continue;
          const timestamp = data.readBigInt64LE(offset);
          offset += 8;

          // Read likes, reposts and replies (8 bytes each) - with error handling
          let likes = 0;
          let reposts = 0;
          let replies = 0;
          
          try {
            if (data.length >= offset + 24) {
              likes = Number(data.readBigUint64LE(offset));
              offset += 8;
              reposts = Number(data.readBigUint64LE(offset));
              offset += 8;
              replies = Number(data.readBigUint64LE(offset));
              offset += 8;
            } else {
              // If not enough data, just skip the counts and use defaults
              console.log(`⚠️ Not enough data for counts in post ${account.pubkey.toString()}, using defaults`);
            }
          } catch (countError) {
            console.warn(`⚠️ Failed to read counts for post ${account.pubkey.toString()}, using defaults:`, countError);
            // Keep defaults (0, 0, 0) and don't increment offset if reading failed
          }

          // Validate timestamp before creating post
          const timestampMs = Number(timestamp) * 1000; // Convert to milliseconds
          const postDate = new Date(timestampMs);
          
          // Skip posts with invalid dates or years > 3000
          if (isNaN(postDate.getTime()) || postDate.getFullYear() > 3000 || postDate.getFullYear() < 2020) {
            const timestampInfo = isNaN(postDate.getTime()) 
              ? `invalid (${timestamp})` 
              : postDate.toISOString();
            console.warn(`⚠️ Skipping post ${account.pubkey.toString()} with invalid timestamp: ${timestampInfo}`);
            continue;
          }

          const post: SocialPost = {
            id: account.pubkey.toString(),
            author,
            content,
            timestamp: timestampMs,
            signature: account.pubkey.toString(),
            likes,
            reposts,
            replies,
            // Include replyTo if present
            ...(replyTo ? { replyTo } : {}),
            // Add image data if it's an image post with cNFT
            ...(postType === 1 && imageNft ? {
              imageUrl: `nft:${imageNft.toString()}`, // Special format to indicate cNFT
              imageHash: imageNft.toString(),
              imageSize: 0
            } : {})
          };

          posts.push(post);
          parsedCount++;
        } catch (error) {
          console.warn('Failed to parse post account:', error);
          errorCount++;
          continue;
        }
      }

      // Sort by timestamp (most recent first) and limit
      const sortedPosts = posts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      console.log(`✅ Successfully fetched ${parsedCount} posts from custom program, ${errorCount} errors`);
      return sortedPosts;
    });
  }

  // Get following list (fetch from custom program)
  async getFollowing(userPubkey: PublicKey): Promise<PublicKey[]> {
    try {
      console.log('🔍 Fetching following list for:', userPubkey.toString());
      
      // Hard-coded exclusions for problematic accounts
      const EXCLUDED_FOLLOW_ACCOUNTS = [
        '9rjLeAsrND9zJzZ5t2QZ5L4Qkw2TnTesxhPJDbMsfFKy' // Orphaned account with wrong discriminator
      ];
      
      // Get ALL program accounts and filter manually for better accuracy
      const accounts = await this.getAllProgramAccounts();
      console.log(`📦 Total program accounts found: ${accounts.length}`);

      const following: PublicKey[] = [];

      for (const account of accounts) {
        try {
          // Skip excluded accounts
          if (EXCLUDED_FOLLOW_ACCOUNTS.includes(account.pubkey.toString())) {
            console.log(`🚫 Skipping excluded follow account: ${account.pubkey.toString()}`);
            continue;
          }
          
          const data = account.account.data;
          
          // Check if this could be a follow account by size
          // Follow account structure: 8 bytes discriminator + 32 bytes follower + 32 bytes following + 8 bytes timestamp + 1 byte bump = 81 bytes minimum
          if (data.length < 81) continue;
          
          // Only check accounts that are exactly 81 bytes (follow accounts should be this size)
          if (data.length !== 81) continue;
          
          console.log(`🔬 Checking account ${account.pubkey.toString()} with length ${data.length}`);
          
          let offset = 8; // Skip discriminator
          
          // Read follower (32 bytes)
          if (data.length < offset + 32) continue;
          const followerBytes = data.slice(offset, offset + 32);
          let follower: PublicKey;
          try {
            follower = new PublicKey(followerBytes);
          } catch {
            console.log(`❌ Invalid follower pubkey in account ${account.pubkey.toString()}`);
            continue; // Invalid public key, not a follow account
          }
          offset += 32;
          
          // Read following (32 bytes)
          if (data.length < offset + 32) continue;
          const followingBytes = data.slice(offset, offset + 32);
          let followingUser: PublicKey;
          try {
            followingUser = new PublicKey(followingBytes);
          } catch {
            console.log(`❌ Invalid following pubkey in account ${account.pubkey.toString()}`);
            continue; // Invalid public key, not a follow account
          }
          offset += 32;
          
          // Read timestamp (8 bytes) - should be a reasonable timestamp
          if (data.length < offset + 8) continue;
          const timestamp = data.readBigInt64LE(offset);
          
          // Validate timestamp is reasonable (after 2020 and before 2050)
          const timestampMs = Number(timestamp) * 1000;
          const timestampDate = new Date(timestampMs);
          
          console.log(`🔬 Account ${account.pubkey.toString()}: follower=${follower.toString()}, following=${followingUser.toString()}, timestamp=${timestampDate.toISOString()}`);
          
          if (timestampMs < new Date('2020-01-01').getTime() || timestampMs > new Date('2050-01-01').getTime()) {
            console.log(`❌ Invalid timestamp ${timestampDate.toISOString()} in account ${account.pubkey.toString()}`);
            continue; // Invalid timestamp, probably not a follow account
          }
          
          // Verify this is actually a follow relationship for our user
          if (follower.equals(userPubkey)) {
            console.log(`✅ MATCH! User ${userPubkey.toString()} is following ${followingUser.toString()} (account: ${account.pubkey.toString()})`);
            following.push(followingUser);
          } else {
            console.log(`➡️ Account ${account.pubkey.toString()} is not for our user (follower: ${follower.toString()})`);
          }
        } catch {
          // Silent continue - this account isn't a valid follow account
          continue;
        }
      }

      console.log(`✅ Found ${following.length} following relationships for ${userPubkey.toString()}`);
      if (following.length > 0) {
        console.log('Following:', following.map(pk => pk.toString()));
      }
      return following;
    } catch (error) {
      console.error('Error fetching following list:', error);
      return [];
    }
  }

  // Get followers list (fetch from custom program)
  async getFollowers(userPubkey: PublicKey): Promise<PublicKey[]> {
    try {
      console.log('🔍 Fetching followers list for:', userPubkey.toString());
      
      // Get ALL program accounts and filter manually for better accuracy
      const accounts = await this.getAllProgramAccounts();

      const followers: PublicKey[] = [];

      for (const account of accounts) {
        try {
          const data = account.account.data;
          
          // Check if this could be a follow account by size
          // Follow account structure: 8 bytes discriminator + 32 bytes follower + 32 bytes following + 8 bytes timestamp + 1 byte bump = 81 bytes minimum
          if (data.length < 81) continue;
          
          let offset = 8; // Skip discriminator
          
          // Read follower (32 bytes)
          if (data.length < offset + 32) continue;
          const followerBytes = data.slice(offset, offset + 32);
          let follower: PublicKey;
          try {
            follower = new PublicKey(followerBytes);
          } catch {
            continue; // Invalid public key, not a follow account
          }
          offset += 32;
          
          // Read following (32 bytes)
          if (data.length < offset + 32) continue;
          const followingBytes = data.slice(offset, offset + 32);
          let following: PublicKey;
          try {
            following = new PublicKey(followingBytes);
          } catch {
            continue; // Invalid public key, not a follow account
          }
          offset += 32;
          
          // Read timestamp (8 bytes) - should be a reasonable timestamp
          if (data.length < offset + 8) continue;
          const timestamp = data.readBigInt64LE(offset);
          
          // Validate timestamp is reasonable (after 2020 and before 2050)
          const timestampMs = Number(timestamp) * 1000;
          if (timestampMs < new Date('2020-01-01').getTime() || timestampMs > new Date('2050-01-01').getTime()) {
            continue; // Invalid timestamp, probably not a follow account
          }
          
          // Verify this is actually a follow relationship for our user (we are being followed)
          if (following.equals(userPubkey)) {
            followers.push(follower);
          }
        } catch {
          // Silent continue - this account isn't a valid follow account
          continue;
        }
      }

      console.log(`✅ Found ${followers.length} followers for ${userPubkey.toString()}`);
      if (followers.length > 0) {
        console.log('Followers:', followers.map(pk => pk.toString()));
      }
      return followers;
    } catch (error) {
      console.error('Error fetching followers list:', error);
      return [];
    }
  }

  // Get posts liked by a user
  async getUserLikes(userPubkey: PublicKey): Promise<SocialPost[]> {
    try {
      console.log('🔍 Fetching liked posts for:', userPubkey.toString());
      
      // Get all program accounts from cache
      const allAccounts = await this.getAllProgramAccounts();
      const likedPostIds: PublicKey[] = [];

      // Filter for like accounts (look for 81-byte accounts that could be likes)
      for (const account of allAccounts) {
        try {
          const data = account.account.data;
          
          // Like accounts should be: 8 bytes discriminator + 32 bytes user + 32 bytes post + 8 bytes timestamp + 1 byte bump = 81 bytes
          if (data.length !== 81) continue;
          
          let offset = 8; // Skip discriminator
          
          // Read user (32 bytes) - should match our user
          if (data.length < offset + 32) continue;
          const userBytes = data.slice(offset, offset + 32);
          let user: PublicKey;
          try {
            user = new PublicKey(userBytes);
          } catch {
            continue; // Invalid public key
          }
          offset += 32;
          
          // Read post (32 bytes) - this is the liked post
          if (data.length < offset + 32) continue;
          const postBytes = data.slice(offset, offset + 32);
          let post: PublicKey;
          try {
            post = new PublicKey(postBytes);
          } catch {
            continue; // Invalid public key
          }
          
          // Verify this is actually a like by our user
          if (user.equals(userPubkey)) {
            likedPostIds.push(post);
          }
        } catch (error) {
          console.warn('Failed to parse like account:', error);
          continue;
        }
      }

      // Now get the actual posts (also from cache)
      const allPosts = await this.getPosts(100); // This now uses the same cache
      const likedPosts = allPosts.filter(post => 
        likedPostIds.some(likedId => likedId.toString() === post.id)
      );

      console.log(`✅ Found ${likedPosts.length} liked posts`);
      return likedPosts;
    } catch (error) {
      console.error('Error fetching liked posts:', error);
      return [];
    }
  }

  // Unfollow a user
  async unfollowUser(wallet: WalletAdapter, targetUser: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [followPDA] = this.getFollowPDA(wallet.publicKey, targetUser);
    const [followerProfilePDA] = this.getUserProfilePDA(wallet.publicKey);
    const [followingProfilePDA] = this.getUserProfilePDA(targetUser);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: followPDA, isSigner: false, isWritable: true },
        { pubkey: followerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: followingProfilePDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: targetUser, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: INSTRUCTION_DISCRIMINATORS.unfollowUser,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ User unfollowed:', signature);
    return signature;
  }

  // Unlike a post
  async unlikePost(wallet: WalletAdapter, postPubkey: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [likePDA] = this.getLikePDA(wallet.publicKey, postPubkey);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: likePDA, isSigner: false, isWritable: true },
        { pubkey: postPubkey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: INSTRUCTION_DISCRIMINATORS.unlikePost,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ Post unliked:', signature);
    return signature;
  }

  // Get user profile
  async getUserProfile(userPubkey: PublicKey): Promise<CustomUserProfile | null> {
    return this.retryRequest(async () => {
      const [userProfilePDA] = this.getUserProfilePDA(userPubkey);
      
      try {
        const accountInfo = await this.connection.getAccountInfo(userProfilePDA);
        if (!accountInfo) {
          return null;
        }

        // Deserialize account data into UserProfile struct
        const data = accountInfo.data;
        
        if (data.length < 8) {
          console.warn('Account data too short for user profile');
          return null;
        }

        let offset = 8; // Skip discriminator

        // Parse UserProfile struct:
        // pub user: Pubkey (32 bytes)
        // pub username: Option<String>
        // pub display_name: Option<String>
        // pub bio: Option<String>
        // pub avatar_url: Option<String>
        // pub cover_image_url: Option<String>
        // pub website_url: Option<String>
        // pub location: Option<String>
        // pub followers_count: u64 (8 bytes)
        // pub following_count: u64 (8 bytes)
        // pub post_count: u64 (8 bytes)
        // pub created_at: i64 (8 bytes)
        // pub verified: bool (1 byte)
        // pub bump: u8 (1 byte)

        // User pubkey (32 bytes)
        if (data.length < offset + 32) return null;
        const user = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // Helper function to read optional string
        const readOptionalString = (): string | null => {
          if (data.length < offset + 1) return null;
          const hasValue = data.readUInt8(offset);
          offset += 1;
          
          if (hasValue === 0) return null;
          
          if (data.length < offset + 4) return null;
          const length = data.readUInt32LE(offset);
          offset += 4;
          
          if (data.length < offset + length) return null;
          const value = data.slice(offset, offset + length).toString('utf8');
          offset += length;
          
          return value;
        };

        // Read all optional string fields in the exact order from Rust struct
        const username = readOptionalString();
        const displayName = readOptionalString(); // display_name
        const bio = readOptionalString();
        const avatarUrl = readOptionalString(); // avatar_url (ignore)
        const coverImageUrl = readOptionalString(); // cover_image_url (ignore)
        const websiteUrl = readOptionalString(); // website_url
        const location = readOptionalString();

        // Read numeric fields
        if (data.length < offset + 8 * 4 + 1 + 1) return null; // 4 u64s + bool + u8

        const followersCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        const followingCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        const postCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        const createdAt = Number(data.readBigInt64LE(offset));
        offset += 8;
        
        const verified = data.readUInt8(offset) === 1;
        offset += 1;
        
        const bump = data.readUInt8(offset);

        const profileData = {
          user,
          username,
          displayName,
          bio,
          websiteUrl,
          location,
          followersCount,
          followingCount,
          postCount,
          createdAt,
          verified,
          bump
        };

        console.log('🔍 Parsed user profile:', profileData);
        console.log('🔍 Raw avatar_url (ignored):', avatarUrl);
        console.log('🔍 Raw cover_image_url (ignored):', coverImageUrl);
        return profileData;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
    });
  }

  // Update user profile
  async updateUserProfile(
    wallet: WalletAdapter,
    username?: string,
    displayName?: string,
    bio?: string,
    websiteUrl?: string,
    location?: string
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [userProfilePDA] = this.getUserProfilePDA(wallet.publicKey);

    // Check if profile exists
    const existingProfile = await this.connection.getAccountInfo(userProfilePDA);
    if (!existingProfile) {
      // Initialize profile first if it doesn't exist
      await this.initializeUserProfile(wallet);
    }

    // Create instruction data for update_user_profile
    // The Rust program still expects avatar_url and cover_image_url, so we send them as None
    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.updateUserProfile,
      // Encode optional strings in the order the Rust program expects:
      // username, display_name, bio, avatar_url, cover_image_url, website_url, location
      this.encodeOptionalString(username),
      this.encodeOptionalString(displayName),
      this.encodeOptionalString(bio),
      this.encodeOptionalString(undefined), // avatar_url as None
      this.encodeOptionalString(undefined), // cover_image_url as None
      this.encodeOptionalString(websiteUrl),
      this.encodeOptionalString(location),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ User profile updated:', signature);
    return signature;
  }

  // Helper method to encode optional strings for Solana program
  private encodeOptionalString(value?: string): Buffer {
    // Treat empty strings and undefined/null as None
    if (!value || value.trim() === '') {
      // None variant (0 byte)
      return Buffer.from([0]);
    }
    
    // Some variant (1 byte) + length (4 bytes) + string data
    const stringBytes = Buffer.from(value, 'utf8');
    const lengthBytes = Buffer.alloc(4);
    lengthBytes.writeUInt32LE(stringBytes.length, 0);
    
    return Buffer.concat([
      Buffer.from([1]), // Some variant
      lengthBytes,
      stringBytes
    ]);
  }

  // Calculate actual costs for different post types
  async calculatePostCosts(hasImage: boolean, imageSize?: number): Promise<{ totalCost: number; breakdown: string }> {
    try {
      // Post account size (from Rust struct)
      const postAccountSize = 8 + 32 + 4 + 280 + 1 + 4 + 1 + 32 + 8 + 8 + 8 + 8 + 1; // ~400 bytes
      
      // Get current rent exemption amount
      const rentExemptAmount = await this.connection.getMinimumBalanceForRentExemption(postAccountSize);
      
      let totalStorageCost = rentExemptAmount;
      let breakdown = `Post storage: ${(rentExemptAmount / 1e9).toFixed(4)} SOL`;
      
      if (hasImage && imageSize) {
        // Calculate image chunks needed (9KB per chunk)
        const chunksNeeded = Math.ceil(imageSize / 9216);
        const chunkAccountSize = 8 + 32 + 1 + 1 + 4 + 9216 + 1; // ~9.3KB per chunk
        const chunkRent = await this.connection.getMinimumBalanceForRentExemption(chunkAccountSize);
        const totalImageCost = chunkRent * chunksNeeded;
        
        totalStorageCost += totalImageCost;
        breakdown += `, Image chunks (${chunksNeeded}): ${(totalImageCost / 1e9).toFixed(4)} SOL`;
      }
      
      // Calculate platform fees
      const platformFeeRate = hasImage ? 0.10 : 0.01; // 10% for images, 1% for text
      const platformFee = Math.floor(totalStorageCost * platformFeeRate);
      
      const totalCost = totalStorageCost + platformFee;
      
      return {
        totalCost,
        breakdown: `${breakdown}, Platform fee: ${(platformFee / 1e9).toFixed(4)} SOL`
      };
    } catch (error) {
      console.error('Error calculating costs:', error);
      // Fallback estimates
      const fallbackCost = hasImage ? 0.015 * 1e9 : 0.003 * 1e9; // Convert to lamports
      return {
        totalCost: fallbackCost,
        breakdown: hasImage ? '~0.015 SOL (estimated)' : '~0.003 SOL (estimated)'
      };
    }
  }

  // Get all user profiles (for debugging)
  async getAllUserProfiles(): Promise<{ pubkey: PublicKey, profile: CustomUserProfile }[]> {
    try {
      const accounts = await this.getAllProgramAccounts();
      const profiles: { pubkey: PublicKey, profile: CustomUserProfile }[] = [];
      
      for (const account of accounts) {
        try {
          const profile = await this.getUserProfile(account.pubkey);
          if (profile) {
            profiles.push({ pubkey: account.pubkey, profile });
          }
        } catch {
          // Not a user profile account, continue
          continue;
        }
      }
      
      return profiles;
    } catch (error) {
      console.error('Error getting all user profiles:', error);
      return [];
    }
  }

  // Encode create text post instruction
  private encodeCreateTextPostInstruction(content: string, timestamp: number, replyTo?: PublicKey): Buffer {
    const instructionData = Buffer.alloc(8 + 4 + Buffer.byteLength(content, 'utf8') + 8 + (replyTo ? 1 + 32 : 1));
    let offset = 0;
    
    // Instruction discriminator for create_text_post
    INSTRUCTION_DISCRIMINATORS.createTextPost.copy(instructionData, offset);
    offset += 8;
    
    // Content length + content
    instructionData.writeUInt32LE(Buffer.byteLength(content, 'utf8'), offset);
    offset += 4;
    instructionData.write(content, offset, 'utf8');
    offset += Buffer.byteLength(content, 'utf8');
    
    // Timestamp (i64, little endian)
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestamp));
    timestampBuffer.copy(instructionData, offset);
    offset += 8;
    
    // Reply to (optional)
    if (replyTo) {
      instructionData.writeUInt8(1, offset); // Some discriminator
      offset += 1;
      replyTo.toBuffer().copy(instructionData, offset);
    } else {
      instructionData.writeUInt8(0, offset); // None discriminator
    }
    
    return instructionData;
  }

  // Encode create image post instruction
  private encodeCreateImagePostInstruction(content: string, timestamp: number, replyTo?: PublicKey): Buffer {
    const instructionData = Buffer.alloc(8 + 4 + Buffer.byteLength(content, 'utf8') + 8 + (replyTo ? 1 + 32 : 1));
    let offset = 0;
    
    // Instruction discriminator for create_image_post
    INSTRUCTION_DISCRIMINATORS.createImagePost.copy(instructionData, offset);
    offset += 8;
    
    // Content length + content
    instructionData.writeUInt32LE(Buffer.byteLength(content, 'utf8'), offset);
    offset += 4;
    instructionData.write(content, offset, 'utf8');
    offset += Buffer.byteLength(content, 'utf8');
    
    // Timestamp (i64, little endian)
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestamp));
    timestampBuffer.copy(instructionData, offset);
    offset += 8;
    
    // Reply to (optional)
    if (replyTo) {
      instructionData.writeUInt8(1, offset); // Some discriminator
      offset += 1;
      replyTo.toBuffer().copy(instructionData, offset);
    } else {
      instructionData.writeUInt8(0, offset); // None discriminator
    }
    
    return instructionData;
  }

  // Create a reply to an existing post
  async createTextReply(
    wallet: WalletAdapter,
    content: string,
    replyToPostId: string
  ): Promise<string> {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    await this.ensureUserProfile(wallet);

    const timestamp = Math.floor(Date.now() / 1000);
    const replyToPublicKey = new PublicKey(replyToPostId);

    // Create post PDA
    const [postPda] = this.getPostPDA(wallet.publicKey, timestamp);

    // Get user profile PDA
    const [userProfilePda] = this.getUserProfilePDA(wallet.publicKey);

    const transaction = new Transaction();

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: postPda, isSigner: false, isWritable: true },
        { pubkey: userProfilePda, isSigner: false, isWritable: true },
        { pubkey: this.platformTreasury, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.encodeCreateTextPostInstruction(content, timestamp, replyToPublicKey),
    });

    transaction.add(instruction);
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('✅ Reply created successfully!', signature);
    return signature;
  }

  // Create an image reply to an existing post
  async createImageReply(
    wallet: WalletAdapter,
    content: string,
    replyToPostId: string
  ): Promise<string> {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    await this.ensureUserProfile(wallet);

    const timestamp = Math.floor(Date.now() / 1000);
    const replyToPublicKey = new PublicKey(replyToPostId);

    // Create post PDA
    const [postPda] = this.getPostPDA(wallet.publicKey, timestamp);

    // Get user profile PDA
    const [userProfilePda] = this.getUserProfilePDA(wallet.publicKey);

    const transaction = new Transaction();

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: postPda, isSigner: false, isWritable: true },
        { pubkey: userProfilePda, isSigner: false, isWritable: true },
        { pubkey: this.platformTreasury, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.encodeCreateImagePostInstruction(content, timestamp, replyToPublicKey),
    });

    transaction.add(instruction);
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('✅ Image reply created successfully!', signature);
    return signature;
  }

  // Get replies for a specific post (optimized for RPC efficiency)
  async getReplies(postId: string, limit: number = 50): Promise<SocialPost[]> {
    try {
      // Check cache first to avoid repeated RPC calls
      const cacheKey = `replies_${postId}`;
      const cached = this.getCachedReplies(cacheKey);
      if (cached) {
        console.log('📦 Using cached replies for', postId);
        return cached.slice(0, limit);
      }

      console.log('🔍 Fetching replies for post:', postId);
      
      // More efficient approach: get program accounts with a smaller, more targeted search
      const targetPostPubkey = new PublicKey(postId);
      
      // Get all program accounts, but we'll filter more efficiently
      const allAccounts = await this.getAllProgramAccounts();
      
      const repliesArray: SocialPost[] = [];
      let checkedAccounts = 0;
      let foundReplies = 0;
      
      for (const account of allAccounts) {
        try {
          checkedAccounts++;
          const data = account.account.data;
          
          // Quick size check - if too small, skip
          if (data.length < 100) continue;
          
          // Quick parse to check if this is a post with a replyTo field
          let offset = 8; // Skip discriminator
          
          // Skip author (32 bytes)
          if (data.length < offset + 32) continue;
          const author = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          
          // Skip content
          if (data.length < offset + 4) continue;
          const contentLength = data.readUInt32LE(offset);
          offset += 4;
          if (data.length < offset + contentLength) continue;
          const content = data.slice(offset, offset + contentLength).toString('utf8');
          offset += contentLength;
          
          // Skip post type and image chunks info
          if (data.length < offset + 1) continue;
          offset += 1; // post_type
          if (data.length < offset + 4) continue;
          const imageChunksLength = data.readUInt32LE(offset);
          offset += 4;
          offset += imageChunksLength * 32; // Skip image chunks
          if (data.length < offset + 1) continue;
          offset += 1; // total_image_chunks
          
          // Check replyTo field
          if (data.length < offset + 1) continue;
          const hasReplyTo = data.readUInt8(offset);
          offset += 1;
          
          if (hasReplyTo === 1) {
            if (data.length < offset + 32) continue;
            const replyToBytes = data.slice(offset, offset + 32);
            const replyTo = new PublicKey(replyToBytes);
            offset += 32;
            
            // Check if this is a reply to our target post
            if (replyTo.equals(targetPostPubkey)) {
              // Get timestamp
              if (data.length < offset + 8) continue;
              const timestamp = data.readBigInt64LE(offset);
              offset += 8;
              
              // Try to get counts (with error handling)
              let likes = 0, reposts = 0, repliesCount = 0;
              try {
                if (data.length >= offset + 24) {
                  likes = Number(data.readBigUint64LE(offset));
                  offset += 8;
                  reposts = Number(data.readBigUint64LE(offset));
                  offset += 8;
                  repliesCount = Number(data.readBigUint64LE(offset));
                }
              } catch {
                // Use defaults if parsing fails
              }
              
              const reply: SocialPost = {
                id: account.pubkey.toString(),
                author,
                content,
                timestamp: Number(timestamp) * 1000,
                signature: account.pubkey.toString(),
                replyTo,
                likes,
                reposts,
                replies: repliesCount
              };
              
              repliesArray.push(reply);
              foundReplies++;
              
              // Early exit if we have enough replies
              if (foundReplies >= limit * 2) {
                break;
              }
            }
          }
        } catch {
          // Skip invalid accounts
          continue;
        }
      }
      
      // Sort by timestamp (newest first)
      repliesArray.sort((a, b) => b.timestamp - a.timestamp);
      
      const result = repliesArray.slice(0, limit);
      
      // Cache the results for 30 seconds
      this.setCachedReplies(cacheKey, result);
      
      console.log(`✅ Found ${result.length} replies from ${checkedAccounts} accounts`);
      return result;
    } catch (error) {
      console.error('Error fetching replies:', error);
      return [];
    }
  }

  // Simple reply cache to avoid repeated RPC calls
  private repliesCache = new Map<string, { data: SocialPost[], timestamp: number }>();
  
  private getCachedReplies(key: string): SocialPost[] | null {
    const cached = this.repliesCache.get(key);
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
      return cached.data;
    }
    return null;
  }
  
  private setCachedReplies(key: string, data: SocialPost[]): void {
    this.repliesCache.set(key, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.repliesCache.size > 50) {
      const now = Date.now();
      for (const [cacheKey, cacheValue] of this.repliesCache.entries()) {
        if (now - cacheValue.timestamp > 60000) { // Remove entries older than 1 minute
          this.repliesCache.delete(cacheKey);
        }
      }
    }
  }

  // Get conversation thread (post + all its replies recursively)
  async getConversationThread(postId: string): Promise<{ mainPost: SocialPost; replies: SocialPost[] }> {
    try {
      const allPosts = await this.getPosts(1000);
      const mainPost = allPosts.find(p => p.id === postId);
      
      if (!mainPost) {
        throw new Error('Post not found');
      }

      const replies = await this.getReplies(postId);
      
      return {
        mainPost,
        replies
      };
    } catch (error) {
      console.error('Error fetching conversation thread:', error);
      throw error;
    }
  }

  // Helper method to check if you're actually following someone and get account details
  async debugFollowStatus(userPubkey: PublicKey): Promise<void> {
    try {
      console.log('🐛 DEBUG: Checking follow status for:', userPubkey.toString());
      
      // Get ALL program accounts and manually check them
      const accounts = await this.getAllProgramAccounts();
      console.log('🐛 DEBUG: Total program accounts:', accounts.length);
      
      // Find accounts that match our follow criteria
      const potentialFollows: Array<{
        account: PublicKey;
        follower: PublicKey;
        following: PublicKey;
        timestamp: Date;
      }> = [];
      
      for (const account of accounts) {
        const data = account.account.data;
        if (data.length !== 81) continue;
        
        try {
          let offset = 8;
          const follower = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          const following = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          const timestamp = data.readBigInt64LE(offset);
          const timestampMs = Number(timestamp) * 1000;
          
          if (timestampMs < new Date('2020-01-01').getTime() || timestampMs > new Date('2050-01-01').getTime()) {
            continue;
          }
          
          if (follower.equals(userPubkey)) {
            potentialFollows.push({
              account: account.pubkey,
              follower,
              following,
              timestamp: new Date(timestampMs)
            });
          }
        } catch {
          continue;
        }
      }
      
      console.log('🐛 DEBUG: Found potential follows:', potentialFollows);
      
      // Now check what PDAs we would derive for these
      for (const follow of potentialFollows) {
        const [expectedPDA, bump] = this.getFollowPDA(follow.follower, follow.following);
        console.log('🐛 DEBUG: Follow relationship:');
        console.log('  Actual account:', follow.account.toString());
        console.log('  Expected PDA:', expectedPDA.toString());
        console.log('  PDA Bump:', bump);
        console.log('  Addresses match?', follow.account.equals(expectedPDA));
        console.log('  Follower:', follow.follower.toString());
        console.log('  Following:', follow.following.toString());
        console.log('  Timestamp:', follow.timestamp.toISOString());
        
        // Check if the account actually exists at the expected PDA
        const accountInfo = await this.connection.getAccountInfo(expectedPDA);
        console.log('  Account exists at expected PDA?', accountInfo !== null);
        
        if (accountInfo) {
          console.log('  Account size at PDA:', accountInfo.data.length);
          console.log('  Account owner:', accountInfo.owner.toString());
        }
      }
    } catch (error) {
      console.error('🐛 DEBUG: Error in debugFollowStatus:', error);
    }
  }

  // Force unfollow using the actual account address (for cleanup)
  async forceUnfollowByAccount(wallet: WalletAdapter, actualAccountPubkey: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: actualAccountPubkey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: SystemProgram.programId,
      data: Buffer.alloc(0), // Simple account close
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ Account force closed:', signature);
    return signature;
  }

  // Direct account closure for orphaned follow accounts
  async closeOrphanedFollowAccount(wallet: WalletAdapter, accountToClose: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Create a system program instruction to close the account and return rent to user
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accountToClose, isSigner: false, isWritable: true }, // Account to close
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // Rent destination (recipient)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // Authority (must be signer)
      ],
      programId: this.programId, // Our program should handle the closure
      data: INSTRUCTION_DISCRIMINATORS.unfollowUser, // Use the unfollow discriminator
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ Orphaned account closed:', signature);
    return signature;
  }

  // Smart cleanup that handles both normal and orphaned accounts
  async smartCleanupFollowing(wallet: WalletAdapter): Promise<string[]> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const results: string[] = [];
    
    // Get all potential follow accounts for this user
    const accounts = await this.getAllProgramAccounts();
    const orphanedAccounts: Array<{ account: PublicKey; following: PublicKey }> = [];
    
    for (const account of accounts) {
      const data = account.account.data;
      if (data.length !== 81) continue;
      
      try {
        let offset = 8;
        const follower = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const following = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const timestamp = data.readBigInt64LE(offset);
        const timestampMs = Number(timestamp) * 1000;
        
        if (timestampMs < new Date('2020-01-01').getTime() || timestampMs > new Date('2050-01-01').getTime()) {
          continue;
        }
        
        if (follower.equals(wallet.publicKey)) {
          // Check if this account is at the expected PDA
          const [expectedPDA] = this.getFollowPDA(follower, following);
          
          if (!account.pubkey.equals(expectedPDA)) {
            console.log('🧹 Found orphaned follow account:', account.pubkey.toString(), 'following:', following.toString());
            orphanedAccounts.push({ account: account.pubkey, following });
          }
        }
      } catch {
        continue;
      }
    }
    
    // Try to unfollow using the actual account addresses
    for (const orphanedAccount of orphanedAccounts) {
      try {
        console.log('🧹 Attempting to unfollow using actual account:', orphanedAccount.account.toString());
        
        const signature = await this.unfollowByActualAccount(
          wallet, 
          orphanedAccount.account, 
          orphanedAccount.following
        );
        
        console.log('✅ Successfully unfollowed using actual account address:', signature);
        results.push(signature);
      } catch (error) {
        console.error('❌ Failed to unfollow using actual account:', orphanedAccount.account.toString(), error);
      }
    }
    
    return results;
  }

  // Unfollow using actual account address (for orphaned accounts)
  async unfollowByActualAccount(
    wallet: WalletAdapter, 
    actualAccountAddress: PublicKey,
    followingUser: PublicKey
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const [followerProfilePDA] = this.getUserProfilePDA(wallet.publicKey);
    const [followingProfilePDA] = this.getUserProfilePDA(followingUser);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: actualAccountAddress, isSigner: false, isWritable: true }, // Use actual account address
        { pubkey: followerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: followingProfilePDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: followingUser, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: INSTRUCTION_DISCRIMINATORS.unfollowUser,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ User unfollowed using actual account address:', signature);
    return signature;
  }

  // Inspect account data and discriminator
  async inspectAccount(accountPubkey: PublicKey): Promise<void> {
    try {
      const accountInfo = await this.connection.getAccountInfo(accountPubkey);
      if (!accountInfo) {
        console.log('❌ Account not found:', accountPubkey.toString());
        return;
      }

      const data = accountInfo.data;
      console.log('🔍 Account inspection for:', accountPubkey.toString());
      console.log('📊 Account owner:', accountInfo.owner.toString());
      console.log('📏 Account size:', data.length, 'bytes');
      console.log('💰 Account lamports:', accountInfo.lamports);
      
      if (data.length >= 8) {
        const discriminator = data.slice(0, 8);
        console.log('🏷️  Account discriminator (hex):', Buffer.from(discriminator).toString('hex'));
        console.log('🏷️  Account discriminator (base64):', Buffer.from(discriminator).toString('base64'));
        
        // Check if it matches any of our expected discriminators
        const discriminatorHex = Buffer.from(discriminator).toString('hex');
        
        // Calculate expected discriminators
        const expectedFollowDiscriminator = Buffer.from(sha256.digest("global:follow_user")).slice(0, 8).toString('hex');
        const expectedPostDiscriminator = Buffer.from(sha256.digest("global:create_text_post")).slice(0, 8).toString('hex');
        const expectedProfileDiscriminator = Buffer.from(sha256.digest("global:initialize_user_profile")).slice(0, 8).toString('hex');
        
        console.log('🎯 Expected follow discriminator:', expectedFollowDiscriminator);
        console.log('🎯 Expected post discriminator:', expectedPostDiscriminator);
        console.log('🎯 Expected profile discriminator:', expectedProfileDiscriminator);
        
        if (discriminatorHex === expectedFollowDiscriminator) {
          console.log('✅ This appears to be a follow account');
        } else if (discriminatorHex === expectedPostDiscriminator) {
          console.log('✅ This appears to be a post account');
        } else if (discriminatorHex === expectedProfileDiscriminator) {
          console.log('✅ This appears to be a profile account');
        } else {
          console.log('❓ Unknown account type - discriminator doesn\'t match any expected types');
        }
      }
      
      // If it's 81 bytes, try to parse as follow data anyway
      if (data.length === 81) {
        console.log('📝 Attempting to parse as follow data (81 bytes):');
        try {
          let offset = 8; // Skip discriminator
          const follower = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          const following = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          const timestamp = data.readBigInt64LE(offset);
          const timestampMs = Number(timestamp) * 1000;
          
          console.log('👤 Follower:', follower.toString());
          console.log('👤 Following:', following.toString());
          console.log('⏰ Timestamp:', new Date(timestampMs).toISOString());
        } catch (parseError) {
          console.log('❌ Failed to parse as follow data:', parseError);
        }
      }
      
    } catch (error) {
      console.error('Error inspecting account:', error);
    }
  }

  // Force close any account by draining lamports (for accounts that can't be closed through program)
  async forceCloseAccount(wallet: WalletAdapter, accountToClose: PublicKey): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Get account info to see how much rent to recover
    const accountInfo = await this.connection.getAccountInfo(accountToClose);
    if (!accountInfo) {
      throw new Error('Account not found');
    }

    console.log('💰 Account has', accountInfo.lamports, 'lamports to recover');
    console.log('👤 Account owner:', accountInfo.owner.toString());

    // Create a custom instruction to transfer the account's lamports to the user
    // This won't work directly because we don't own the account, but let's try another approach
    
    // If the account is owned by our program, we can try to create a close instruction
    if (accountInfo.owner.equals(this.programId)) {
      console.log('🔧 Account is owned by our program, attempting program-based closure...');
      
      // Create a generic close instruction that just tries to close the account
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: accountToClose, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // Rent destination
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // Authority
        ],
        programId: this.programId,
        data: Buffer.concat([
          Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]), // Custom close discriminator
        ])
      });

      const transaction = new Transaction().add(instruction);
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

      console.log('✅ Account force closed:', signature);
      return signature;
    } else {
      throw new Error(`Account is owned by ${accountInfo.owner.toString()}, not our program. Cannot close.`);
    }
  }

  // Create an image post with cNFT reference
  async createImagePostWithCNft(
    wallet: WalletAdapter, 
    content: string, 
    cnftAddress: PublicKey,
    metadataCid?: string, // Optional metadata CID for IPFS metadata access
    replyTo?: PublicKey
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    if (content.length > 280) {
      throw new Error('Content too long (max 280 characters)');
    }

    // VALIDATE NFT EXISTS BEFORE CREATING POST
    console.log('🔍 Validating NFT exists on blockchain:', cnftAddress.toString());
    try {
      const nftAccount = await this.connection.getAccountInfo(cnftAddress);
      if (!nftAccount) {
        throw new Error(`NFT mint account not found: ${cnftAddress.toString()}. Cannot create post with invalid NFT reference.`);
      }
      
      // Verify it's actually a token mint account
      if (nftAccount.data.length < 82) { // Mint accounts are 82 bytes
        throw new Error(`Invalid NFT account data. Expected mint account but got ${nftAccount.data.length} bytes.`);
      }
      
      console.log('✅ NFT validation passed, proceeding with post creation');
    } catch (error) {
      console.error('❌ NFT validation failed:', error);
      throw new Error(`Cannot create image post: ${error instanceof Error ? error.message : 'NFT validation failed'}`);
    }

    // If metadata CID is provided, append it to content in a special format
    let finalContent = content;
    if (metadataCid) {
      finalContent = `${content}\n__META:${metadataCid}__`; // Hidden metadata reference
      console.log('📋 Including metadata CID in post for public access:', metadataCid);
    }

    const timestamp = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
    const [postPDA] = this.getPostPDA(wallet.publicKey, timestamp);
    const [userProfilePDA] = this.getUserProfilePDA(wallet.publicKey);

    // Ensure user profile exists
    await this.ensureUserProfile(wallet);

    // Create instruction data for image post with cNFT
    const instructionData = Buffer.alloc(8 + finalContent.length + 4 + 8 + 33);
    let offset = 0;
    
    // Instruction discriminator for create_image_post
    INSTRUCTION_DISCRIMINATORS.createImagePost.copy(instructionData, offset);
    offset += 8;
    
    // String serialization: length (4 bytes) + content
    instructionData.writeUInt32LE(finalContent.length, offset);
    offset += 4;
    Buffer.from(finalContent, 'utf8').copy(instructionData, offset);
    offset += finalContent.length;
    
    // Timestamp
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestamp), 0);
    timestampBuffer.copy(instructionData, offset);
    offset += 8;
    
    // Optional reply_to (1 byte flag + 32 bytes if present)
    if (replyTo) {
      instructionData.writeUInt8(1, offset);
      offset += 1;
      replyTo.toBuffer().copy(instructionData, offset);
    } else {
      instructionData.writeUInt8(0, offset);
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: postPDA, isSigner: false, isWritable: true },
        { pubkey: userProfilePDA, isSigner: false, isWritable: true },
        { pubkey: PLATFORM_TREASURY, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    await this.connection.confirmTransaction(signature, 'confirmed');
    
    console.log('✅ Image post created:', signature);
    
    // Now link the cNFT to the post (with additional validation)
    try {
      await this.linkCNftToPost(wallet, postPDA, cnftAddress);
    } catch (linkError) {
      console.error('⚠️ Failed to link cNFT to post, but post was created:', linkError);
      // Post was created successfully, but linking failed
      // This is not a critical error since the post exists
    }
    
    // Clear any cached data to reflect the new post
    this.clearAccountsCache();
    
    return signature;
  }

  // Link cNFT to existing post
  async linkCNftToPost(
    wallet: WalletAdapter,
    postPubkey: PublicKey,
    cnftAddress: PublicKey
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Create instruction data
    const instructionData = Buffer.alloc(8 + 32);
    let offset = 0;
    
    // Instruction discriminator for link_cnft_to_post
    INSTRUCTION_DISCRIMINATORS.linkCnftToPost.copy(instructionData, offset);
    offset += 8;
    
    // cNFT address
    cnftAddress.toBuffer().copy(instructionData, offset);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: postPubkey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

    console.log('✅ cNFT linked to post:', signature);
    return signature;
  }
} 