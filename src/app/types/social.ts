import { PublicKey } from '@solana/web3.js';

export interface SocialPost {
  id: string;
  author: PublicKey;
  content: string;
  timestamp: number;
  signature: string;
  // Image support
  imageHash?: string;
  imageUrl?: string;
  imageSize?: number;
}

export interface UserProfile {
  wallet: PublicKey;
  username?: string;
  bio?: string;
  avatar?: string;
  following: PublicKey[];
  followers: PublicKey[];
  postCount: number;
}

export interface SocialInteraction {
  type: 'follow' | 'unfollow' | 'like' | 'repost';
  from: PublicKey;
  to?: PublicKey;
  postId?: string;
  timestamp: number;
  signature: string;
}

export interface PostStats {
  likes: number;
  reposts: number;
  replies: number;
} 