'use client';

import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { SocialPost } from '../types/social';
import { Button } from '@/components/ui/button';
import { Clock, ExternalLink, Loader2 } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';

interface ThreadContextProps {
  replyToId: string;
  onOriginalPostClick?: (post: SocialPost) => void;
}

export default function ThreadContext({ replyToId, onOriginalPostClick }: ThreadContextProps) {
  const [originalPost, setOriginalPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ username?: string, displayName?: string }>({});
  
  const { connection } = useConnection();

  useEffect(() => {
    const fetchOriginalPost = async () => {
      try {
        setLoading(true);
        const solcialsProgram = new SolcialsCustomProgramService(connection);
        const allPosts = await solcialsProgram.getPosts(200); // Get more posts to find the original
        
        const foundPost = allPosts.find(post => post.id === replyToId);
        
        if (foundPost) {
          setOriginalPost(foundPost);
          // Fetch user profile for original post author
          fetchUserProfile(foundPost.author);
        }
      } catch (error) {
        console.error('Error fetching original post:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOriginalPost();
  }, [replyToId, connection]);

  const fetchUserProfile = async (userPubkey: PublicKey) => {
    try {
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const profile = await solcialsProgram.getUserProfile(userPubkey);
      
      setUserProfile({
        username: profile?.username || undefined,
        displayName: profile?.displayName || undefined
      });
    } catch (error) {
      console.warn(`Failed to fetch profile for ${userPubkey.toString()}:`, error);
    }
  };

  const getUserDisplayName = (userPubkey: PublicKey): string => {
    if (userProfile?.displayName) {
      return userProfile.displayName;
    } else if (userProfile?.username) {
      return userProfile.username;
    }
    
    const userKey = userPubkey.toString();
    return `${userKey.slice(0, 8)}...${userKey.slice(-4)}`;
  };

  const getUserHandle = (): string | null => {
    return userProfile?.username || null;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes < 1 ? 'now' : `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return diffInDays === 1 ? '1d' : `${diffInDays}d`;
    }
  };

  if (loading) {
    return (
      <div className="bg-muted/30 rounded-lg p-3 mb-2 border-l-2 border-muted">
        <div className="animate-pulse flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading original post...</span>
        </div>
      </div>
    );
  }

  if (!originalPost) {
    return (
      <div className="bg-muted/30 rounded-lg p-3 mb-2 border-l-2 border-red-200">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground">⚠️ Original post not found</span>
        </div>
      </div>
    );
  }

  const userHandle = getUserHandle();

  return (
    <div className="bg-muted/30 rounded-lg p-3 mb-2 border-l-2 border-primary/30">
      <div className="flex items-start space-x-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 mb-1">
            <button
              onClick={() => onOriginalPostClick?.(originalPost)}
              className="font-medium text-foreground hover:text-primary transition-colors text-sm truncate"
            >
              {getUserDisplayName(originalPost.author)}
            </button>
            {userHandle && (
              <span className="text-xs text-muted-foreground truncate">
                @{userHandle}
              </span>
            )}
            <span className="text-xs text-muted-foreground">•</span>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatTimestamp(originalPost.timestamp)}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {originalPost.content}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-primary/70">Original post</span>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              <a
                href={`/post/${originalPost.signature}`}
                className="flex items-center space-x-1"
              >
                <ExternalLink className="h-3 w-3" />
                <span>View</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 