import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { SocialPost, SocialInteraction } from '../types/social';

// Memo program ID for storing social posts
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction>(transaction: T) => Promise<T>;
  connected: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class SolanaSocialService {
  private connection: Connection;
  private socialProgram: PublicKey;
  private cache = new Map<string, CacheEntry<unknown>>();
  private requestQueue: Array<() => Promise<unknown>> = [];
  private isProcessingQueue = false;
  private static readonly CACHE_DURATION = 300000; // Increased to 5 minutes cache
  private static readonly REQUEST_DELAY = 3000; // Increased to 3 seconds between requests
  private isRequesting = false;
  private cachedPosts: SocialPost[] = [];
  private lastFetch = 0;
  private lastRequestTime = 0;
  private requestCount = 0;
  private maxRequestsPerMinute = 5; // Reduced to 5 requests per minute (very conservative)

  constructor(connection: Connection) {
    this.connection = connection;
    this.socialProgram = MEMO_PROGRAM_ID;
  }

  // Enhanced rate limiting check
  private canMakeRequest(): boolean {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastRequestTime > 60000) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    
    // Check if we've exceeded the rate limit
    if (this.requestCount >= this.maxRequestsPerMinute) {
      console.warn('🚫 Rate limit reached, blocking request');
      return false;
    }
    
    return true;
  }

  private incrementRequestCount(): void {
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  // Simple cache mechanism
  private getCacheKey(method: string, params?: unknown): string {
    return `${method}_${params ? JSON.stringify(params) : ''}`;
  }

  private getCachedData<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SolanaSocialService.CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  private setCachedData<T>(cacheKey: string, data: T): void {
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  // Queue requests to prevent overwhelming the RPC
  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          this.incrementRequestCount();
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.warn('Queued request failed:', error);
        }
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, SolanaSocialService.REQUEST_DELAY));
      }
    }
    
    this.isProcessingQueue = false;
  }

  // Helper method to retry requests with exponential backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2, // Reduced retries
    baseDelay: number = 2000 // Increased base delay to 2 seconds
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxRetries;
        const isRateLimit = error instanceof Error && 
          (error.message.includes('429') || 
           error.message.includes('rate') || 
           error.message.includes('Too Many Requests'));
        
        if (isRateLimit) {
          console.warn(`🚫 Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}). Using cached data if available.`);
          
          if (isLastAttempt) {
            // Instead of throwing, return cached data or empty result
            console.warn('Max rate limit retries exceeded, returning fallback data');
            // This will be handled by the calling method
            throw new Error('RATE_LIMIT_EXCEEDED');
          }
        } else if (isLastAttempt) {
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // Create a post by sending a transaction with the post data in the memo
  async createPost(
    wallet: WalletAdapter,
    content: string
  ): Promise<SocialPost> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Parse the content if it's JSON (from image posts)
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
      // Not JSON, treat as plain text
      postContent = content;
    }

    const post: Omit<SocialPost, 'signature'> = {
      id: `${wallet.publicKey.toString()}_${Date.now()}`,
      author: wallet.publicKey,
      content: postContent,
      timestamp: Date.now(),
      ...(imageData || {})
    };

    // Create the complete post data with our app identifier
    const completePostData = {
      ...post,
      ...imageData
    };

    // Add SOLCIALS prefix to identify posts from our app
    const postDataWithPrefix = `<SOLCIALS>${JSON.stringify(completePostData)}`;
    
    // Create a transaction with memo instruction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey, // Send to self with 0 lamports
        lamports: 0,
      })
    );

    // Add memo instruction with prefixed post data
    const memoInstruction = {
      keys: [],
      programId: this.socialProgram,
      data: Buffer.from(postDataWithPrefix, 'utf8'),
    };
    transaction.add(memoInstruction);

    // Get recent blockhash with retry
    const { blockhash } = await this.retryWithBackoff(() => 
      this.connection.getLatestBlockhash()
    );
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.retryWithBackoff(() =>
      this.connection.sendRawTransaction(signedTransaction.serialize())
    );
    
    // Clear posts cache after successful post creation
    this.cache.delete('getPosts');
    
    return {
      ...post,
      signature,
    };
  }

  // Follow a user by sending a transaction with follow data in memo
  async followUser(
    wallet: WalletAdapter,
    targetPublicKey: PublicKey
  ): Promise<SocialInteraction> {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    const interaction: Omit<SocialInteraction, 'signature'> = {
      type: 'follow',
      from: wallet.publicKey,
      to: targetPublicKey,
      timestamp: Date.now(),
    };

    const interactionData = JSON.stringify(interaction);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 0,
      })
    );

    const memoInstruction = {
      keys: [],
      programId: this.socialProgram,
      data: Buffer.from(`SOCIAL_FOLLOW:${interactionData}`, 'utf8'),
    };
    transaction.add(memoInstruction);

    const { blockhash } = await this.retryWithBackoff(() => 
      this.connection.getLatestBlockhash()
    );
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.retryWithBackoff(() =>
      this.connection.sendRawTransaction(signedTransaction.serialize())
    );
    
    // Clear following cache after successful follow
    this.cache.delete(`getFollowing_${wallet.publicKey.toString()}`);
    
    return {
      ...interaction,
      signature,
    };
  }

  // Get posts by parsing transaction memos from the blockchain
  async getPosts(limit: number = 10): Promise<SocialPost[]> {
    if (this.isRequesting) {
      console.log('🚫 Request already in progress, using cached data...');
      return this.cachedPosts.slice(0, limit);
    }

    // Check cache first (10 minute cache for very aggressive caching)
    const now = Date.now();
    if (this.lastFetch && (now - this.lastFetch) < 600000 && this.cachedPosts.length > 0) {
      console.log('📦 Using cached posts (10min cache)');
      return this.cachedPosts.slice(0, limit);
    }

    // Additional rate limiting check
    if (!this.canMakeRequest()) {
      console.warn('🚫 Rate limit reached, returning cached posts');
      return this.cachedPosts.slice(0, limit);
    }

    try {
      this.isRequesting = true;
      console.log('🔍 Fetching recent transaction signatures...');

      const confirmedSignatures = await this.retryWithBackoff(() =>
        this.connection.getSignaturesForAddress(
          this.socialProgram,
          { limit: Math.min(limit, 20) }, // Further reduced limit
          'confirmed'
        )
      );

      if (confirmedSignatures.length === 0) {
        console.log('📭 No transactions found');
        return this.cachedPosts.length > 0 ? this.cachedPosts : [];
      }

      console.log(`📨 Found ${confirmedSignatures.length} transactions`);

      const posts: SocialPost[] = [];
      const batchSize = 2; // Further reduced batch size
      const maxBatches = 3; // Limit number of batches to process

      // Process in smaller batches with longer delays
      for (let i = 0; i < Math.min(confirmedSignatures.length, batchSize * maxBatches); i += batchSize) {
        const batch = confirmedSignatures.slice(i, i + batchSize);
        
        try {
          const batchPromises = batch.map(async (signature, index) => {
            // Staggered delays within batch
            await new Promise(resolve => setTimeout(resolve, index * 200));
            
            try {
              const transaction = await this.retryWithBackoff(() =>
                this.connection.getTransaction(signature.signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0
                })
              );

              if (!transaction) return null;

              const accountKeys = transaction.transaction.message.getAccountKeys();
              const authorKey = accountKeys.get(0);

              if (!authorKey) return null;

              // Look for memo instruction with SOLCIALS prefix
              let memoContent = '';
              const instructions = transaction.transaction.message.compiledInstructions;
              
              for (const instruction of instructions) {
                const programId = accountKeys.get(instruction.programIdIndex);
                if (programId?.equals(MEMO_PROGRAM_ID)) {
                  const data = instruction.data;
                  if (data && data.length > 0) {
                    try {
                      memoContent = Buffer.from(data).toString('utf8');
                      break;
                    } catch {
                      console.warn('Failed to decode memo data');
                    }
                  }
                }
              }

              // Only process posts that start with our SOLCIALS prefix
              if (!memoContent.startsWith('<SOLCIALS>')) {
                return null;
              }

              // Remove the prefix and parse the post data
              const postDataString = memoContent.substring(10); // Remove '<SOLCIALS>'
              
              if (!postDataString.trim()) return null;

              let parsedPost;
              try {
                parsedPost = JSON.parse(postDataString);
              } catch {
                console.warn('Failed to parse SOLCIALS post data');
                return null;
              }

              // Validate that this is a valid post structure
              if (!parsedPost.author || parsedPost.content === undefined || !parsedPost.timestamp) {
                console.warn('Invalid SOLCIALS post structure');
                return null;
              }

              const post: SocialPost = {
                id: signature.signature,
                author: new PublicKey(parsedPost.author),
                content: parsedPost.content,
                timestamp: parsedPost.timestamp,
                signature: signature.signature,
                imageHash: parsedPost.imageHash || '',
                imageUrl: parsedPost.imageUrl || '',
                imageSize: parsedPost.imageSize || 0
              };

              return post;
            } catch (error) {
              console.warn(`Failed to process transaction ${signature.signature}:`, error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          const validPosts = batchResults.filter((post): post is SocialPost => post !== null);
          posts.push(...validPosts);

          // Longer delay between batches
          if (i + batchSize < Math.min(confirmedSignatures.length, batchSize * maxBatches)) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
          }
        } catch (error) {
          console.warn(`Error processing batch starting at ${i}:`, error);
          // Continue with next batch instead of failing completely
        }
      }

      // Sort by timestamp (most recent first) and limit
      const sortedPosts = posts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      // Update cache with longer duration
      this.cachedPosts = sortedPosts;
      this.lastFetch = now;

      console.log(`✅ Successfully fetched ${sortedPosts.length} posts`);
      return sortedPosts;

    } catch (error) {
      console.error('❌ Error fetching posts:', error);
      
      // Check if it's a rate limit error
      if (error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
        console.warn('🚫 Rate limit hit - extending cache time and returning cached data');
        // Extend cache time to 30 minutes when rate limited
        this.lastFetch = now + 1800000; // Add 30 minutes to cache
      }
      
      // Always return cached posts if available, even on error
      if (this.cachedPosts.length > 0) {
        console.log('🔄 Returning cached posts due to error');
        return this.cachedPosts.slice(0, limit);
      }
      
      // If no cached posts, return empty array instead of throwing
      console.warn('No cached posts available, returning empty array');
      return [];
    } finally {
      this.isRequesting = false;
    }
  }

  // Get user's posts
  async getUserPosts(userPublicKey: PublicKey): Promise<SocialPost[]> {
    const cacheKey = `getUserPosts_${userPublicKey.toString()}`;
    const cachedPosts = this.getCachedData<SocialPost[]>(cacheKey);
    
    if (cachedPosts) {
      return cachedPosts;
    }

    const allPosts = await this.getPosts(50);
    const userPosts = allPosts.filter(post => post.author.equals(userPublicKey));
    
    this.setCachedData(cacheKey, userPosts);
    return userPosts;
  }

  // Get following list by parsing follow transactions
  async getFollowing(userPublicKey: PublicKey): Promise<PublicKey[]> {
    const cacheKey = `getFollowing_${userPublicKey.toString()}`;
    const cachedFollowing = this.getCachedData<PublicKey[]>(cacheKey);
    
    if (cachedFollowing) {
      return cachedFollowing;
    }

    const following: PublicKey[] = [];
    
    try {
      const signatures = await this.retryWithBackoff(() =>
        this.connection.getSignaturesForAddress(
          this.socialProgram,
          { limit: 50 } // Reduced limit
        )
      );

      // Process in smaller batches
      const batchSize = 3;
      for (let i = 0; i < Math.min(signatures.length, 30); i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (sig) => {
          try {
            const transaction = await this.retryWithBackoff(() =>
              this.connection.getParsedTransaction(sig.signature)
            );
            
            if (transaction?.meta?.logMessages) {
              for (const log of transaction.meta.logMessages) {
                if (log.includes('SOCIAL_FOLLOW:')) {
                  const interactionDataStr = log.split('SOCIAL_FOLLOW:')[1];
                  try {
                    const interaction = JSON.parse(interactionDataStr);
                    if (interaction.from === userPublicKey.toString() && interaction.type === 'follow') {
                      const targetKey = new PublicKey(interaction.to);
                      if (!following.find(pk => pk.equals(targetKey))) {
                        following.push(targetKey);
                      }
                    }
                  } catch (e) {
                    console.warn('Failed to parse interaction data:', e);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Failed to fetch transaction:', e);
          }
        }));

        // Add delay between batches
        if (i + batchSize < signatures.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED') {
        console.warn('Rate limit exceeded for getFollowing, returning empty array');
        // Return empty array instead of throwing
        return [];
      }
      console.error('Error fetching following:', error);
      // Return empty array instead of throwing
      return [];
    }

    this.setCachedData(cacheKey, following);
    return following;
  }
} 