'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { SocialPost } from '../types/social';
import { PublicKey } from '@solana/web3.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ExternalLink, UserPlus, Clock, MessageSquare, Loader2, ImageIcon, Users, Copy, Check } from 'lucide-react';

interface PostListProps {
  refreshTrigger: number;
  userFilter?: string; // Optional wallet address to filter posts by specific user
  feedType?: 'all' | 'following'; // Feed type for filtering
}

export default function PostList({ refreshTrigger, userFilter, feedType = 'all' }: PostListProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [following, setFollowing] = useState<PublicKey[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  
  // Cache for user profiles to avoid repeated fetches
  const [userProfiles, setUserProfiles] = useState<Map<string, { username?: string, displayName?: string }>>(new Map());
  const [loadingProfiles, setLoadingProfiles] = useState<Set<string>>(new Set());

  const { connection } = useConnection();
  const wallet = useWallet();
  
  // Use refs to prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchPosts = useCallback(async (force = false) => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current && !force) {
      console.log('Already fetching, skipping...');
      return;
    }

    // Debounce requests to prevent spam
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 10000) {
      console.log('Too soon since last fetch, skipping...');
      return;
    }

    try {
      fetchingRef.current = true;
      setIsRequesting(true);
      lastFetchRef.current = now;
      
      if (!posts.length || force) {
        setLoading(true);
      }

      const socialService = new SolcialsCustomProgramService(connection);
      
      // Fetch posts
      const fetchedPosts = await socialService.getPosts(20); // Reduced from 30
      setPosts(fetchedPosts);
      
      // Fetch following list if needed for following feed and wallet is connected
      if (feedType === 'following' && wallet.publicKey && (force || following.length === 0)) {
        try {
          const followingList = await socialService.getFollowing(wallet.publicKey);
          setFollowing(followingList);
        } catch (error) {
          console.warn('Error fetching following list:', error);
          // Don't fail the whole operation if following fetch fails
          setFollowing([]);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Provide fallback empty state instead of crashing
      if (posts.length === 0) {
        setPosts([]);
      }
    } finally {
      setLoading(false);
      setIsRequesting(false);
      fetchingRef.current = false;
    }
  }, [connection, wallet.publicKey, posts.length, following.length, userFilter, feedType]);

  const debouncedFetchPosts = useCallback((force = false) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      fetchPosts(force);
    }, 5000); // Increased debounce to 5 seconds to prevent rate limits
  }, [fetchPosts]);

  const handleFollow = async (targetPublicKey: PublicKey) => {
    if (!wallet.connected || !wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (isRequesting) {
      alert('Please wait for current request to complete');
      return;
    }

    try {
      setIsRequesting(true);
      const socialService = new SolcialsCustomProgramService(connection);
      await socialService.followUser(wallet, targetPublicKey);
      
      // Update local following list
      setFollowing(prev => [...prev, targetPublicKey]);
      alert('Successfully followed user!');
    } catch (error) {
      console.error('Error following user:', error);
      alert('Failed to follow user. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleUnfollow = async (targetPublicKey: PublicKey) => {
    if (!wallet.connected || !wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (isRequesting) {
      alert('Please wait for current request to complete');
      return;
    }

    try {
      setIsRequesting(true);
      const socialService = new SolcialsCustomProgramService(connection);
      await socialService.unfollowUser(wallet, targetPublicKey);
      
      // Update local following list
      setFollowing(prev => prev.filter(addr => !addr.equals(targetPublicKey)));
      alert('Successfully unfollowed user!');
    } catch (error) {
      console.error('Error unfollowing user:', error);
      alert('Failed to unfollow user. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleUserClick = (address: PublicKey) => {
    // Always navigate to wallet-based profile page
    window.location.href = `/wallet/${address.toString()}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchPosts(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedType]); // Re-fetch when feed type changes

  // Fetch on refresh trigger (when new post is created)
  useEffect(() => {
    if (refreshTrigger > 0) {
      debouncedFetchPosts(true);
    }
  }, [refreshTrigger, debouncedFetchPosts]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const formatAddress = (address: PublicKey) => {
    const addressStr = address.toString();
    return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const isFollowing = (address: PublicKey) => {
    return following.some(followedAddress => followedAddress.equals(address));
  };

  const fetchUserProfile = useCallback(async (userPubkey: PublicKey) => {
    const userKey = userPubkey.toString();
    
    // Don't fetch if already cached or currently loading
    if (userProfiles.has(userKey) || loadingProfiles.has(userKey)) {
      return;
    }

    try {
      setLoadingProfiles(prev => new Set(prev).add(userKey));
      
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const profile = await solcialsProgram.getUserProfile(userPubkey);
      
      setUserProfiles(prev => new Map(prev).set(userKey, {
        username: profile?.username || undefined,
        displayName: profile?.displayName || undefined
      }));
    } catch (error) {
      console.warn(`Failed to fetch profile for ${userKey}:`, error);
      // Set empty profile to avoid retrying
      setUserProfiles(prev => new Map(prev).set(userKey, {}));
    } finally {
      setLoadingProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(userKey);
        return newSet;
      });
    }
  }, [connection, userProfiles, loadingProfiles]);

  // Helper function to get display name for a user
  const getUserDisplayName = (userPubkey: PublicKey): string => {
    const userKey = userPubkey.toString();
    const profile = userProfiles.get(userKey);
    
    if (profile?.displayName) {
      return profile.displayName;
    } else if (profile?.username) {
      return profile.username;
    }
    
    // Fallback to formatted address
    return formatAddress(userPubkey);
  };

  // Helper function to get username for a user (for @handle display)
  const getUserHandle = (userPubkey: PublicKey): string | null => {
    const userKey = userPubkey.toString();
    const profile = userProfiles.get(userKey);
    return profile?.username || null;
  };

  // Effect to fetch user profiles when posts change
  useEffect(() => {
    posts.forEach(post => {
      fetchUserProfile(post.author);
    });
  }, [posts, fetchUserProfile]);

  const fetchUserLikes = useCallback(async () => {
    if (!wallet.publicKey) return;
    
    try {
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const userLikes = await solcialsProgram.getUserLikes(wallet.publicKey);
      const likedSignatures = new Set(userLikes.map(post => post.signature));
      setLikedPosts(likedSignatures);
    } catch (error) {
      console.warn('Error fetching user likes:', error);
    }
  }, [connection, wallet.publicKey]);

  // Load user likes when wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      fetchUserLikes();
    } else {
      setLikedPosts(new Set());
    }
  }, [wallet.connected, wallet.publicKey, fetchUserLikes]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="m-4">
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {userFilter 
              ? 'This user has not posted anything yet.' 
              : feedType === 'following' 
                ? 'No posts from people you follow yet. Start following some users!'
                : 'No posts found. Be the first to post!'
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter posts based on feed type and user filter
  let filteredPosts = posts;
  
  if (userFilter) {
    // Filter by specific user
    filteredPosts = posts.filter(post => post.author.toString() === userFilter);
  } else if (feedType === 'following' && wallet.publicKey) {
    // Filter by following list (include own posts)
    filteredPosts = posts.filter(post => 
      post.author.equals(wallet.publicKey!) || 
      following.some(followedAddress => followedAddress.equals(post.author))
    );
  }

  if (userFilter && filteredPosts.length === 0 && posts.length > 0) {
    return (
      <Card className="m-4">
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">This user hasn&apos;t posted anything yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (feedType === 'following' && filteredPosts.length === 0 && posts.length > 0) {
    return (
      <Card className="m-4">
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No posts from following</h3>
          <p className="text-muted-foreground">
            Start following some users to see their posts here!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4 p-4">
        {filteredPosts.map((post) => {
          // Posts are now pre-filtered and parsed by the service
          const postContent = post.content;
          const hasImage = post.imageHash && post.imageUrl;
          const userHandle = getUserHandle(post.author);
          const isLiked = likedPosts.has(post.signature);

          const handleShare = async () => {
            const postUrl = `${window.location.origin}/post/${post.signature}`;
            setShareUrl(postUrl);
            setShareDialogOpen(true);
            setCopied(false);
          };

          const handleLike = async () => {
            if (!wallet.connected || !wallet.publicKey) {
              alert('Please connect your wallet to like posts');
              return;
            }

            if (isRequesting) {
              alert('Please wait for current request to complete');
              return;
            }

            try {
              setIsRequesting(true);
              const solcialsProgram = new SolcialsCustomProgramService(connection);
              
              if (isLiked) {
                // Unlike the post
                await solcialsProgram.unlikePost(wallet, new PublicKey(post.id));
                setLikedPosts(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(post.signature);
                  return newSet;
                });
                alert('Post unliked!');
              } else {
                // Like the post
                await solcialsProgram.likePost(wallet, new PublicKey(post.id));
                setLikedPosts(prev => new Set(prev).add(post.signature));
                alert('Post liked!');
              }
            } catch (error) {
              console.error('Error liking/unliking post:', error);
              alert(`Failed to ${isLiked ? 'unlike' : 'like'} post. Please try again.`);
            } finally {
              setIsRequesting(false);
            }
          };

          return (
            <Card key={post.signature} className="hover:bg-muted/30 transition-all duration-200 shadow-sm border">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUserClick(post.author)}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {getUserDisplayName(post.author)}
                        </button>
                        {userHandle && (
                          <span className="text-sm text-muted-foreground">
                            @{userHandle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimestamp(post.timestamp)}</span>
                        <span>•</span>
                        <span className="text-xs">on chain</span>
                      </div>
                    </div>
                  </div>
                  {wallet.connected && 
                   wallet.publicKey && 
                   !post.author.equals(wallet.publicKey) && (
                    <Button
                      onClick={() => isFollowing(post.author) ? handleUnfollow(post.author) : handleFollow(post.author)}
                      size="sm"
                      variant={isFollowing(post.author) ? "secondary" : "outline"}
                      className="flex items-center space-x-1 hover:bg-primary hover:text-primary-foreground transition-all"
                      disabled={isRequesting}
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>
                        {isRequesting 
                          ? (isFollowing(post.author) ? 'Unfollowing...' : 'Following...') 
                          : (isFollowing(post.author) ? 'Unfollow' : 'Follow')
                        }
                      </span>
                    </Button>
                  )}
                </div>
                
                {/* Post Content */}
                {postContent && (
                  <div className="mb-4">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed text-base">
                      {postContent}
                    </p>
                  </div>
                )}

                {/* Post Image */}
                {hasImage && (
                  <div className="mb-4">
                    <div className="rounded-xl overflow-hidden border bg-muted/10">
                      <img 
                        src={post.imageUrl} 
                        alt="Post image" 
                        className="w-full max-h-96 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => window.open(post.imageUrl!, '_blank')}
                      />
                    </div>
                    {post.imageSize && post.imageSize > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        {(post.imageSize / 1024 / 1024).toFixed(2)} MB • Stored on IPFS
                      </p>
                    )}
                  </div>
                )}
                
                {/* Interaction Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      <span className="text-xs">Reply</span>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShare}
                      className="text-muted-foreground hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      <span className="text-xs">Share</span>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLike}
                      className={`transition-all ${
                        isLiked 
                          ? 'text-red-500 bg-red-50 dark:bg-red-950/20' 
                          : 'text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                      }`}
                    >
                      <div className="h-4 w-4 mr-1 flex items-center justify-center">
                        {isLiked ? '♥' : '♡'}
                      </div>
                      <span className="text-xs">{isLiked ? 'Unlike' : 'Like'}</span>
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-muted-foreground hover:text-primary hover:bg-accent transition-all"
                    >
                      <a
                        href={`https://solscan.io/tx/${post.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-xs">View TX</span>
                      </a>
                    </Button>

                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Load More Button */}
        {posts.length >= 10 && (
          <div className="text-center py-4">
            <Button 
              variant="outline" 
              onClick={() => fetchPosts(true)}
              disabled={isRequesting}
              className="min-w-[120px]"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy this link to share the post:
            </p>
            <div className="flex items-center space-x-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 text-sm"
              />
              <Button
                onClick={copyToClipboard}
                size="sm"
                className="flex items-center space-x-1"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 