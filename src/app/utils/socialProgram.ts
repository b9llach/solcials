import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram
} from '@solana/web3.js';
import { SocialPost } from '../types/social';

interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction>(transaction: T) => Promise<T>;
  connected: boolean;
}

export class SocialProgramService {
  private connection: Connection;
  private postsCache = new Map<string, SocialPost[]>();
  private cacheExpiry = 60000; // 1 minute cache

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // Create a deterministic address for user's posts
  private getUserPostsAccount(userPubkey: PublicKey): PublicKey {
    const [postsAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("solcials_posts"), userPubkey.toBuffer()],
      SystemProgram.programId
    );
    return postsAccount;
  }

  // Create a deterministic address for individual posts
  private getPostAccount(userPubkey: PublicKey, postId: string): PublicKey {
    const [postAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("solcials_post"), 
        userPubkey.toBuffer(),
        Buffer.from(postId)
      ],
      SystemProgram.programId
    );
    return postAccount;
  }

  // Create a post by creating a dedicated account
  async createPost(
    wallet: WalletAdapter,
    content: string
  ): Promise<SocialPost> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Parse content if it's JSON (from image posts)
    let postContent = '';
    let imageData = null;
    
    try {
      const parsed = JSON.parse(content);
      if (parsed.content !== undefined) {
        postContent = parsed.content;
        imageData = {
          imageHash: parsed.imageHash || '',
          imageUrl: parsed.imageUrl || '',
          imageSize: parsed.imageSize || 0
        };
      }
    } catch {
      postContent = content;
    }

    const postId = Date.now().toString();
    const post: SocialPost = {
      id: postId,
      author: wallet.publicKey,
      content: postContent,
      timestamp: Date.now(),
      signature: '', // Will be filled after transaction
      imageHash: imageData?.imageHash || '',
      imageUrl: imageData?.imageUrl || '',
      imageSize: imageData?.imageSize || 0
    };

    // Create the post account
    const postAccount = this.getPostAccount(wallet.publicKey, postId);
    
    // Serialize post data
    const postData = JSON.stringify(post);
    const dataSize = Buffer.byteLength(postData, 'utf8') + 32; // Extra space for metadata
    
    // Calculate rent for the account
    const rentExemption = await this.connection.getMinimumBalanceForRentExemption(dataSize);

    const transaction = new Transaction();

    // Create the account to store post data
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: postAccount,
        lamports: rentExemption,
        space: dataSize,
        programId: SystemProgram.programId,
      })
    );

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    
    // Wait for confirmation
    await this.connection.confirmTransaction(signature);

    // Now write the post data to the account
    // Note: In a real implementation, you'd want a custom program to handle this
    // For now, we'll store it in the account data (this is a simplified approach)
    
    post.signature = signature;
    
    // Clear cache
    this.postsCache.clear();
    
    return post;
  }

  // Get all posts by scanning for post accounts
  async getAllPosts(limit: number = 20): Promise<SocialPost[]> {
    try {
      // This is a simplified approach - in a real custom program,
      // you'd have better indexing
      
      // For now, we'll use the memo approach but with better organization
      const signatures = await this.connection.getSignaturesForAddress(
        SystemProgram.programId,
        { limit: 100 }
      );

      const posts: SocialPost[] = [];
      
      // Process signatures in batches
      for (const sig of signatures.slice(0, limit)) {
        try {
          const transaction = await this.connection.getTransaction(sig.signature);
          if (!transaction) continue;

          // Look for our post creation pattern
          // const accountKeys = transaction.transaction.message.getAccountKeys();
          
          // This is where a custom program would shine - 
          // we'd have dedicated post accounts we could query directly
          
        } catch (error) {
          console.warn('Error processing transaction:', error);
        }
      }

      return posts;
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  }

  // Get posts for a specific user
  async getUserPosts(userPubkey: PublicKey): Promise<SocialPost[]> {
    const cacheKey = userPubkey.toString();
    const cached = this.postsCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // In a custom program, we'd query the user's posts account directly
      // const userPostsAccount = this.getUserPostsAccount(userPubkey);
      
      // For now, return empty array - this would be implemented in the custom program
      const posts: SocialPost[] = [];
      
      this.postsCache.set(cacheKey, posts);
      return posts;
    } catch (error) {
      console.error('Error fetching user posts:', error);
      return [];
    }
  }
}

// Custom Program Architecture (for reference)
export const CUSTOM_PROGRAM_DESIGN = `
// This is what we'd build with Anchor/Rust:

use anchor_lang::prelude::*;

#[program]
pub mod solcials {
    use super::*;
    
    pub fn create_post(
        ctx: Context<CreatePost>,
        content: String,
        image_hash: Option<String>,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.author = ctx.accounts.author.key();
        post.content = content;
        post.image_hash = image_hash;
        post.timestamp = Clock::get()?.unix_timestamp;
        Ok(())
    }
    
    pub fn get_user_posts(
        ctx: Context<GetUserPosts>
    ) -> Result<Vec<Post>> {
        // Direct query of user's posts
        // Much faster than scanning all transactions
    }
}

#[account]
pub struct Post {
    pub author: Pubkey,
    pub content: String,
    pub image_hash: Option<String>,
    pub timestamp: i64,
}

Benefits:
- Direct queries by user
- No scanning required
- Built-in indexing
- Much faster
- Lower costs
`; 