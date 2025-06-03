import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram
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
  imageChunks: PublicKey[];
  totalImageChunks: number;
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

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = SOLCIALS_PROGRAM_ID;
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

    // Ensure both profiles exist
    await this.ensureUserProfile(wallet);

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
    try {
      console.log('🔍 Fetching posts from Solcials custom program...');
      
      // Hard-coded filter for specific transaction to exclude
      const EXCLUDED_TRANSACTIONS = ['FETGTvVFBPx2c3ojK3wquiYm2vuCGei8rUkAVCjqPKib'];
      
      // Get all accounts owned by our program (remove filter for now)
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        // Remove the memcmp filter since Anchor discriminators are complex
        // We'll filter in code instead
      });

      console.log(`📦 Found ${accounts.length} program accounts`);

      const posts: SocialPost[] = [];

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
          
          // Parse Post struct fields:
          // pub author: Pubkey (32 bytes)
          // pub content: String (4 bytes length + content)
          // pub post_type: u8 (1 byte)
          // pub image_chunks: Vec<Pubkey> (4 bytes length + chunks)
          // pub total_image_chunks: u8 (1 byte)
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

          // Image chunks vector length (4 bytes)
          if (data.length < offset + 4) continue;
          const imageChunksLength = data.readUInt32LE(offset);
          offset += 4;

          // Skip image chunks (32 bytes each)
          offset += imageChunksLength * 32;

          // Total image chunks (1 byte)
          if (data.length < offset + 1) continue;
          const totalImageChunks = data.readUInt8(offset);
          offset += 1;

          // Reply to option (1 byte discriminator + optional 32 bytes)
          if (data.length < offset + 1) continue;
          const hasReplyTo = data.readUInt8(offset);
          offset += 1;
          if (hasReplyTo === 1) {
            offset += 32; // Skip reply_to pubkey
          }

          // Timestamp (8 bytes)
          if (data.length < offset + 8) continue;
          const timestamp = data.readBigInt64LE(offset);
          offset += 8;

          // Skip likes, reposts and replies (8 bytes each)
          offset += 24;

          const post: SocialPost = {
            id: account.pubkey.toString(),
            author,
            content,
            timestamp: Number(timestamp) * 1000, // Convert to milliseconds
            signature: account.pubkey.toString(),
            // Add image data if it's an image post
            ...(postType === 1 && totalImageChunks > 0 ? {
              imageHash: `${account.pubkey.toString()}_chunks`,
              imageUrl: '', // Would need to reconstruct from chunks
              imageSize: 0
            } : {})
          };

          posts.push(post);
        } catch (error) {
          console.warn('Failed to parse post account:', error);
          continue;
        }
      }

      // Sort by timestamp (most recent first) and limit
      const sortedPosts = posts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      console.log(`✅ Successfully fetched ${sortedPosts.length} posts from custom program`);
      return sortedPosts;

    } catch (error) {
      console.error('❌ Error fetching posts from custom program:', error);
      return [];
    }
  }

  // Get following list (fetch from custom program)
  async getFollowing(userPubkey: PublicKey): Promise<PublicKey[]> {
    try {
      console.log('🔍 Fetching following list for:', userPubkey.toString());
      
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // Skip discriminator
              bytes: userPubkey.toBase58(), // follower field
            },
          },
        ],
      });

      const following: PublicKey[] = [];

      for (const account of accounts) {
        try {
          const data = account.account.data;
          
          // Check if this looks like a follow account (discriminator check)
          if (data.length < 8 + 32 + 32) continue;
          
          let offset = 8; // Skip discriminator
          
          // Read follower (32 bytes) - should match our user
          const followerBytes = data.slice(offset, offset + 32);
          const follower = new PublicKey(followerBytes);
          offset += 32;
          
          // Read following (32 bytes) - this is who we're following
          const followingBytes = data.slice(offset, offset + 32);
          const followingUser = new PublicKey(followingBytes);
          
          // Verify this is actually a follow relationship for our user
          if (follower.equals(userPubkey)) {
            following.push(followingUser);
          }
        } catch (error) {
          console.warn('Failed to parse follow account:', error);
          continue;
        }
      }

      console.log(`✅ Found ${following.length} following relationships`);
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
      
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 8 + 32, // Skip discriminator + follower field
              bytes: userPubkey.toBase58(), // following field
            },
          },
        ],
      });

      const followers: PublicKey[] = [];

      for (const account of accounts) {
        try {
          const data = account.account.data;
          
          // Check if this looks like a follow account
          if (data.length < 8 + 32 + 32) continue;
          
          let offset = 8; // Skip discriminator
          
          // Read follower (32 bytes) - this is who's following us
          const followerBytes = data.slice(offset, offset + 32);
          const follower = new PublicKey(followerBytes);
          offset += 32;
          
          // Read following (32 bytes) - should match our user
          const followingBytes = data.slice(offset, offset + 32);
          const following = new PublicKey(followingBytes);
          
          // Verify this is actually a follow relationship for our user
          if (following.equals(userPubkey)) {
            followers.push(follower);
          }
        } catch (error) {
          console.warn('Failed to parse follow account:', error);
          continue;
        }
      }

      console.log(`✅ Found ${followers.length} followers`);
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
      
      // First, get all like relationships for this user
      const likeAccounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // Skip discriminator
              bytes: userPubkey.toBase58(), // user field
            },
          },
        ],
      });

      const likedPostIds: PublicKey[] = [];

      // Parse like accounts to get post IDs
      for (const account of likeAccounts) {
        try {
          const data = account.account.data;
          
          // Check if this looks like a like account
          if (data.length < 8 + 32 + 32) continue;
          
          let offset = 8; // Skip discriminator
          
          // Read user (32 bytes) - should match our user
          const userBytes = data.slice(offset, offset + 32);
          const user = new PublicKey(userBytes);
          offset += 32;
          
          // Read post (32 bytes) - this is the liked post
          const postBytes = data.slice(offset, offset + 32);
          const post = new PublicKey(postBytes);
          
          // Verify this is actually a like by our user
          if (user.equals(userPubkey)) {
            likedPostIds.push(post);
          }
        } catch (error) {
          console.warn('Failed to parse like account:', error);
          continue;
        }
      }

      // Now fetch the actual posts
      const allPosts = await this.getPosts(100); // Get more posts to find liked ones
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
      const accounts = await this.connection.getProgramAccounts(this.programId);
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
} 