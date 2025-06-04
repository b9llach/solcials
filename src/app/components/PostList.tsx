'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { SocialPost } from '../types/social';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ReplyDialog from './ReplyDialog';
import ThreadContext from './ThreadContext';
import NFTImage from './NFTImage';
import { ExternalLink, UserPlus, Clock, MessageSquare, Loader2, Users, Copy, Check } from 'lucide-react';
import { Toast } from '../utils/toast';

interface PostListProps {
  refreshTrigger: number;
  userFilter?: string; // Optional wallet address to filter posts by specific user
  feedType?: 'all' | 'following'; // Feed type for filtering
  height?: string; // Optional height for the ScrollArea, defaults to calc(100vh-200px)
}

// Utility function to clean metadata from post content for display
const cleanContentForDisplay = (content: string): string => {
  // Remove the metadata CID reference from display content
  return content.replace(/\n?__META:[a-zA-Z0-9]+__/g, '').trim();
};

// Phantom user to filter out
const PHANTOM_USER_ID = "9xxZrmjp3WQH4vTKAtf4oKCb3SAaY3THuS2Fxt3T64uu";

export default function PostList({ refreshTrigger, userFilter, feedType = 'all', height = 'h-[calc(100vh-200px)]' }: PostListProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [following, setFollowing] = useState<PublicKey[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  
  // Replies functionality
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesData, setRepliesData] = useState<Map<string, SocialPost[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  
  // Cache for user profiles to avoid repeated fetches
  const [userProfiles, setUserProfiles] = useState<Map<string, { username?: string, displayName?: string }>>(new Map());
  const [loadingProfiles, setLoadingProfiles] = useState<Set<string>>(new Set());

  const { connection } = useConnection();
  const wallet = useWallet();
  
  // Use refs to prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Browser caching helpers
  const getCacheKey = (key: string) => `solcials_${key}`;
  
  const getCachedData = (key: string, maxAge: number = 30000): unknown => {
    try {
      const cached = localStorage.getItem(getCacheKey(key));
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < maxAge) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    return null;
  };

  const setCachedData = (key: string, data: unknown): void => {
    try {
      localStorage.setItem(getCacheKey(key), JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  };

  const clearCachedData = (key: string): void => {
    try {
      localStorage.removeItem(getCacheKey(key));
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  };

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

    // Try cache first (only for initial load)
    if (!force && posts.length === 0) {
      const cachedPosts = getCachedData('posts', 60000); // 1 minute cache
      if (cachedPosts && Array.isArray(cachedPosts) && cachedPosts.length > 0) {
        console.log('📦 Using cached posts from localStorage');
        // Convert cached data back to proper format
        const restoredPosts = cachedPosts.map(post => ({
          ...post,
          author: new PublicKey(post.author),
          ...(post.replyTo ? { replyTo: new PublicKey(post.replyTo) } : {})
        }));
        setPosts(restoredPosts);
        setLoading(false);
        return;
      }
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
      const fetchedPosts = await socialService.getPosts(50);
      setPosts(fetchedPosts);
      
      // Cache posts for future use
      const postsToCache = fetchedPosts.map(post => ({
        ...post,
        author: post.author.toString(),
        ...(post.replyTo ? { replyTo: post.replyTo.toString() } : {})
      }));
      setCachedData('posts', postsToCache);
      
      // Fetch following list if needed for following feed and wallet is connected
      if (feedType === 'following' && wallet.publicKey && (force || following.length === 0)) {
        try {
          // Clear cached following data if force refresh
          if (force) {
            clearCachedData(`following_${wallet.publicKey.toString()}`);
          }
          
          const followingList = await socialService.getFollowing(wallet.publicKey);
          // Filter out phantom users
          const filteredFollowing = followingList.filter(pk => pk.toString() !== PHANTOM_USER_ID);
          setFollowing(filteredFollowing);
          // Cache following list
          setCachedData(`following_${wallet.publicKey.toString()}`, filteredFollowing.map(pk => pk.toString()));
        } catch (error) {
          console.warn('Error fetching following list:', error);
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
      Toast.warning('Please connect your wallet first');
      return;
    }

    if (isRequesting) {
      Toast.warning('Please wait for current request to complete');
      return;
    }

    try {
      setIsRequesting(true);
      const socialService = new SolcialsCustomProgramService(connection);
      await socialService.followUser(wallet, targetPublicKey);
      
      // Update local following list
      setFollowing(prev => [...prev, targetPublicKey]);
      Toast.success('Successfully followed user!');
    } catch (error) {
      console.error('Error following user:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('haven\'t set up their profile')) {
        Toast.warning('This user hasn\'t set up their profile yet. They need to create a post or update their profile first.');
      } else {
        Toast.error('Failed to follow user. Please try again.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleUnfollow = async (targetPublicKey: PublicKey) => {
    if (!wallet.connected || !wallet.publicKey) {
      Toast.warning('Please connect your wallet first');
      return;
    }

    if (isRequesting) {
      Toast.warning('Please wait for current request to complete');
      return;
    }

    try {
      setIsRequesting(true);
      const socialService = new SolcialsCustomProgramService(connection);
      await socialService.unfollowUser(wallet, targetPublicKey);
      
      // Update local following list
      setFollowing(prev => prev.filter(addr => !addr.equals(targetPublicKey)));
      Toast.success('Successfully unfollowed user!');
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Toast.error('Failed to unfollow user. Please try again.');
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

    // Check browser cache first
    const cachedProfile = getCachedData(`profile_${userKey}`, 300000); // 5 minute cache for profiles
    if (cachedProfile && typeof cachedProfile === 'object' && cachedProfile !== null) {
      setUserProfiles(prev => new Map(prev).set(userKey, cachedProfile as { username?: string, displayName?: string }));
      return;
    }

    try {
      setLoadingProfiles(prev => new Set(prev).add(userKey));
      
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const profile = await solcialsProgram.getUserProfile(userPubkey);
      
      const profileData = {
        username: profile?.username || undefined,
        displayName: profile?.displayName || undefined
      };
      
      setUserProfiles(prev => new Map(prev).set(userKey, profileData));
      
      // Cache the profile
      setCachedData(`profile_${userKey}`, profileData);
    } catch (error) {
      console.warn(`Failed to fetch profile for ${userKey}:`, error);
      // Set empty profile to avoid retrying
      const emptyProfile = {};
      setUserProfiles(prev => new Map(prev).set(userKey, emptyProfile));
      setCachedData(`profile_${userKey}`, emptyProfile);
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

  // Fetch replies for a specific post
  const fetchReplies = useCallback(async (postId: string) => {
    if (loadingReplies.has(postId) || repliesData.has(postId)) {
      return; // Already loading or loaded
    }

    try {
      setLoadingReplies(prev => new Set(prev).add(postId));
      const socialService = new SolcialsCustomProgramService(connection);
      const replies = await socialService.getReplies(postId, 10); // Limit to 10 replies for performance
      
      setRepliesData(prev => new Map(prev).set(postId, replies));
      
      // Fetch user profiles for reply authors
      replies.forEach(reply => {
        fetchUserProfile(reply.author);
      });
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoadingReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  }, [connection, loadingReplies, repliesData]);

  // Toggle replies visibility
  const toggleReplies = useCallback(async (postId: string) => {
    if (expandedReplies.has(postId)) {
      // Collapse replies
      setExpandedReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      // Expand replies
      setExpandedReplies(prev => new Set(prev).add(postId));
      
      // Fetch replies if not already loaded
      if (!repliesData.has(postId)) {
        await fetchReplies(postId);
      }
    }
  }, [expandedReplies, repliesData, fetchReplies]);

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
      
      // Load cached following list if available
      if (feedType === 'following') {
        const cachedFollowing = getCachedData(`following_${wallet.publicKey.toString()}`, 300000); // 5 min cache
        if (cachedFollowing && Array.isArray(cachedFollowing)) {
          try {
            const followingKeys = cachedFollowing
              .filter((keyStr: string) => keyStr !== PHANTOM_USER_ID) // Filter out phantom user
              .map((keyStr: string) => new PublicKey(keyStr));
            setFollowing(followingKeys);
          } catch (error) {
            console.warn('Error loading cached following list:', error);
          }
        }
      }
    } else {
      setLikedPosts(new Set());
      setFollowing([]);
    }
  }, [wallet.connected, wallet.publicKey, fetchUserLikes, feedType]);

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 p-2 sm:p-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-start space-x-2 sm:space-x-4">
                <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                  <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
                  <Skeleton className="h-12 sm:h-16 w-full" />
                  <Skeleton className="h-3 sm:h-4 w-32 sm:w-40" />
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
      <Card className="m-2 sm:m-4">
        <CardContent className="p-4 sm:p-8 text-center">
          <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm sm:text-base text-muted-foreground">
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
  
  console.log(`🔍 PostList Debug: feedType=${feedType}, posts.length=${posts.length}, following.length=${following.length}`);
  
  if (userFilter) {
    // Filter by specific user
    filteredPosts = posts.filter(post => post.author.toString() === userFilter);
    console.log(`👤 User filter applied: ${filteredPosts.length} posts for user ${userFilter}`);
  } else if (feedType === 'following' && wallet.publicKey) {
    // Filter by following list (include own posts)
    const beforeFilter = posts.length;
    filteredPosts = posts.filter(post => 
      post.author.equals(wallet.publicKey!) || 
      following.some(followedAddress => followedAddress.equals(post.author))
    );
    console.log(`👥 Following filter applied: ${beforeFilter} -> ${filteredPosts.length} posts`);
    console.log(`👥 Following list:`, following.map(pk => pk.toString().slice(0, 8) + '...'));
    console.log(`👤 Your pubkey:`, wallet.publicKey?.toString().slice(0, 8) + '...');
  } else {
    console.log(`🌍 All posts: ${filteredPosts.length} posts (no filter applied)`);
  }

  if (userFilter && filteredPosts.length === 0 && posts.length > 0) {
    return (
      <Card className="m-2 sm:m-4">
        <CardContent className="p-4 sm:p-8 text-center">
          <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm sm:text-base text-muted-foreground">This user hasn&apos;t posted anything yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (feedType === 'following' && filteredPosts.length === 0 && posts.length > 0) {
    return (
      <Card className="m-2 sm:m-4">
        <CardContent className="p-4 sm:p-8 text-center">
          <Users className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-base sm:text-lg font-medium mb-2">No posts from following</h3>
          <p className="text-sm text-muted-foreground">
            Start following some users to see their posts here!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ScrollArea className={`${height} w-full max-w-4xl mx-auto`}>
        <div className="space-y-3 sm:space-y-4 p-2 sm:p-4">
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
                Toast.warning('Please connect your wallet to like posts');
                return;
              }

              if (isRequesting) {
                Toast.warning('Please wait for current request to complete');
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
                  Toast.success('Post unliked!');
                } else {
                  // Like the post
                  await solcialsProgram.likePost(wallet, new PublicKey(post.id));
                  setLikedPosts(prev => new Set(prev).add(post.signature));
                  Toast.success('Post liked!');
                }
              } catch (error) {
                console.error('Error liking/unliking post:', error);
                Toast.error(`Failed to ${isLiked ? 'unlike' : 'like'} post. Please try again.`);
              } finally {
                setIsRequesting(false);
              }
            };

            return (
              <Card key={post.signature} className="hover:bg-muted/30 transition-all duration-200 shadow-sm border">
                {/* Show thread context if this is a reply */}
                {post.replyTo && (
                  <div className="p-3 sm:p-6 pb-0">
                    <ThreadContext 
                      replyToId={post.replyTo.toString()} 
                      onOriginalPostClick={(originalPost) => {
                        window.location.href = `/post/${originalPost.signature}`;
                      }}
                    />
                  </div>
                )}
                
                <CardContent className="p-3 sm:p-6">
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <button
                            onClick={() => handleUserClick(post.author)}
                            className="font-semibold text-foreground hover:text-primary transition-colors text-sm sm:text-base truncate"
                          >
                            {getUserDisplayName(post.author)}
                          </button>
                          {userHandle && (
                            <span className="text-xs sm:text-sm text-muted-foreground truncate">
                              @{userHandle}
                            </span>
                          )}
                          {/* Show reply indicator */}
                          {post.replyTo && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-blue-500">replying</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{formatTimestamp(post.timestamp)}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-xs hidden sm:inline">on chain</span>
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
                        className="flex items-center space-x-1 hover:bg-primary hover:text-primary-foreground transition-all ml-2 flex-shrink-0"
                        disabled={isRequesting}
                      >
                        <UserPlus className="h-3 w-3 flex-shrink-0" />
                        <span className="hidden sm:inline">
                          {isRequesting 
                            ? (isFollowing(post.author) ? 'Unfollowing...' : 'Following...') 
                            : (isFollowing(post.author) ? 'Unfollow' : 'Follow')
                          }
                        </span>
                        <span className="sm:hidden text-xs">
                          {isRequesting 
                            ? (isFollowing(post.author) ? '...' : '...') 
                            : (isFollowing(post.author) ? 'Unfollow' : 'Follow')
                          }
                        </span>
                      </Button>
                    )}
                  </div>
                  
                  {/* Post Content */}
                  {postContent && (
                    <div className="mb-3 sm:mb-4">
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                        {cleanContentForDisplay(postContent)}
                      </p>
                    </div>
                  )}

                  {/* Post Image */}
                  {hasImage && (
                    <div className="mb-3 sm:mb-4">
                      <NFTImage
                        imageUrl={post.imageUrl!}
                        alt="Post image"
                        width={500}
                        height={300}
                        postContent={post.content}
                        className="w-full cursor-pointer"
                        onLoad={() => {
                          // Image loaded successfully
                        }}
                        onError={() => {
                          console.error('Failed to load image for post:', post.id);
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Interaction Bar */}
                  <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border/50">
                    <div className="flex items-center space-x-2 sm:space-x-4">
                      <div className="flex items-center space-x-1">
                        <ReplyDialog 
                          post={post} 
                          onReplyCreated={() => {
                            debouncedFetchPosts(true);
                            // Clear replies cache to refresh count
                            setRepliesData(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(post.id);
                              return newMap;
                            });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleReplies(post.id)}
                          className="text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all h-8 px-2"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {(() => {
                              // Show blockchain count if > 0, otherwise show loaded count, otherwise show nothing
                              const blockchainCount = post.replies || 0;
                              const loadedReplies = repliesData.get(post.id);
                              const loadedCount = loadedReplies ? loadedReplies.length : 0;
                              
                              if (blockchainCount > 0) {
                                return blockchainCount;
                              } else if (loadedCount > 0) {
                                return loadedCount;
                              } else if (expandedReplies.has(post.id)) {
                                return '0';
                              } else {
                                return ''; // Show nothing until expanded
                              }
                            })()}
                          </span>
                          {expandedReplies.has(post.id) ? (
                            <span className="text-xs ml-1">↑</span>
                          ) : (
                            <span className="text-xs ml-1">↓</span>
                          )}
                        </Button>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleShare}
                        className="text-muted-foreground hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all h-8 px-2 sm:px-3"
                      >
                        <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="text-xs hidden sm:inline">Share</span>
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLike}
                        className={`transition-all h-8 px-2 sm:px-3 ${
                          isLiked 
                            ? 'text-red-500 bg-red-50 dark:bg-red-950/20' 
                            : 'text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                        }`}
                      >
                        <div className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex items-center justify-center">
                          {isLiked ? '♥' : '♡'}
                        </div>
                        <span className="text-xs hidden sm:inline">{isLiked ? 'Unlike' : 'Like'}</span>
                      </Button>
                    </div>
                    
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-muted-foreground hover:text-primary hover:bg-accent transition-all h-8 px-2 sm:px-3"
                      >
                        <a
                          href={`https://solscan.io/tx/${post.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="text-xs hidden sm:inline">View TX</span>
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Replies Dropdown */}
                  {expandedReplies.has(post.id) && (
                    <div className="mt-4 border-t border-border/30 pt-4">
                      {loadingReplies.has(post.id) ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Loading replies...</span>
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const replies = repliesData.get(post.id);
                            if (!replies || replies.length === 0) {
                              return (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  No replies yet. Be the first to reply!
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-3">
                                {replies.slice(0, 5).map((reply) => {
                                  const replyUserHandle = getUserHandle(reply.author);
                                  return (
                                    <div key={reply.id} className="pl-4 border-l-2 border-muted">
                                      <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                          <button
                                            onClick={() => handleUserClick(reply.author)}
                                            className="font-semibold text-sm hover:text-primary transition-colors"
                                          >
                                            {getUserDisplayName(reply.author)}
                                          </button>
                                          {replyUserHandle && (
                                            <span className="text-xs text-muted-foreground">@{replyUserHandle}</span>
                                          )}
                                          <span className="text-xs text-muted-foreground">•</span>
                                          <span className="text-xs text-muted-foreground">
                                            {formatTimestamp(reply.timestamp)}
                                          </span>
                                        </div>
                                        <p className="text-sm leading-relaxed pl-0">
                                          {reply.content}
                                        </p>
                                        <div className="flex items-center space-x-3">
                                          <ReplyDialog 
                                            post={reply} 
                                            onReplyCreated={() => {
                                              debouncedFetchPosts(true);
                                              // Refresh replies for this thread
                                              setRepliesData(prev => {
                                                const newMap = new Map(prev);
                                                newMap.delete(post.id);
                                                return newMap;
                                              });
                                              fetchReplies(post.id);
                                            }}
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const replyUrl = `${window.location.origin}/post/${post.signature}`;
                                              setShareUrl(replyUrl);
                                              setShareDialogOpen(true);
                                            }}
                                            className="text-muted-foreground hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all h-6 px-2"
                                          >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            <span className="text-xs">Share</span>
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {replies.length > 5 && (
                                  <div className="text-center pt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUserClick(post.author)}
                                      className="text-blue-500 hover:text-blue-600 text-xs"
                                    >
                                      View all {replies.length} replies →
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md mx-2 sm:mx-4">
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
                className="flex items-center space-x-1 flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Copy</span>
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