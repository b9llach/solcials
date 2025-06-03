'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../../utils/solcialsProgram';
import { SocialPost } from '../../types/social';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ReplyDialog from '../../components/ReplyDialog';
import { ArrowLeft, Clock, ExternalLink, UserPlus, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { PublicKey } from '@solana/web3.js';
import NFTImage from '../../components/NFTImage';
import { Toast } from '../../utils/toast';

export default function PostDetailPage() {
  const params = useParams();
  const signature = params.signature as string;
  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [following, setFollowing] = useState<PublicKey[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<SocialPost[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  
  // Cache for user profiles
  const [userProfiles, setUserProfiles] = useState<Map<string, { username?: string, displayName?: string }>>(new Map());

  const { connection } = useConnection();
  const wallet = useWallet();

  const refreshPost = () => {
    // Re-fetch the post to show any new replies or updates
    if (signature) {
      const fetchPost = async () => {
        try {
          const socialService = new SolcialsCustomProgramService(connection);
          const posts = await socialService.getPosts(100);
          
          const foundPost = posts.find(p => p.signature === signature || p.id === signature);
          
          if (foundPost) {
            setPost(foundPost);
            // Fetch user profile for the post author
            fetchUserProfile(foundPost.author);
            // Also fetch replies
            fetchReplies(foundPost.id);
          }
        } catch (err) {
          console.error('Error refreshing post:', err);
        }
      };
      
      fetchPost();
    }
  };

  const fetchReplies = async (postId: string) => {
    try {
      setLoadingReplies(true);
      const socialService = new SolcialsCustomProgramService(connection);
      const fetchedReplies = await socialService.getReplies(postId, 50);
      setReplies(fetchedReplies);
      
      // Fetch profiles for reply authors
      fetchedReplies.forEach(reply => {
        fetchUserProfile(reply.author);
      });
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  useEffect(() => {
    const fetchPost = async () => {
      if (!signature) return;

      try {
        setLoading(true);
        const socialService = new SolcialsCustomProgramService(connection);
        const posts = await socialService.getPosts(100);
        
        const foundPost = posts.find(p => p.signature === signature || p.id === signature);
        
        if (foundPost) {
          setPost(foundPost);
          // Fetch user profile for the post author
          fetchUserProfile(foundPost.author);
          
          // Fetch following list if wallet is connected
          if (wallet.publicKey) {
            try {
              const followingList = await socialService.getFollowing(wallet.publicKey);
              setFollowing(followingList);
            } catch (error) {
              console.warn('Error fetching following list:', error);
              setFollowing([]);
            }
          }

          // Fetch replies for this post
          fetchReplies(foundPost.id);
        } else {
          setError('Post not found');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [signature, connection, wallet.publicKey]);

  const fetchUserProfile = async (userPubkey: PublicKey) => {
    const userKey = userPubkey.toString();
    
    if (userProfiles.has(userKey)) {
      return;
    }

    try {
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const profile = await solcialsProgram.getUserProfile(userPubkey);
      
      setUserProfiles(prev => new Map(prev).set(userKey, {
        username: profile?.username || undefined,
        displayName: profile?.displayName || undefined
      }));
    } catch (error) {
      console.warn(`Failed to fetch profile for ${userKey}:`, error);
      setUserProfiles(prev => new Map(prev).set(userKey, {}));
    }
  };

  const getUserDisplayName = (userPubkey: PublicKey): string => {
    const userKey = userPubkey.toString();
    const profile = userProfiles.get(userKey);
    
    if (profile?.displayName) {
      return profile.displayName;
    } else if (profile?.username) {
      return profile.username;
    }
    
    return `${userKey.slice(0, 8)}...${userKey.slice(-4)}`;
  };

  const getUserHandle = (userPubkey: PublicKey): string | null => {
    const userKey = userPubkey.toString();
    const profile = userProfiles.get(userKey);
    return profile?.username || null;
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

  const isFollowing = (address: PublicKey) => {
    return following.some(addr => addr.equals(address));
  };

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
    window.location.href = `/wallet/${address.toString()}`;
  };

  const handleShare = async () => {
    if (!post) return;
    const postUrl = `${window.location.origin}/post/${post.signature}`;
    setShareUrl(postUrl);
    setShareDialogOpen(true);
    setCopied(false);
  };

  const handleLike = async () => {
    if (!post) return;
    
    if (!wallet.connected || !wallet.publicKey) {
      Toast.warning('Please connect your wallet to like posts');
      return;
    }

    if (isRequesting) {
      Toast.warning('Please wait for current request to complete');
      return;
    }

    const isLiked = likedPosts.has(post.signature);

    try {
      setIsRequesting(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      
      if (isLiked) {
        await solcialsProgram.unlikePost(wallet, new PublicKey(post.id));
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(post.signature);
          return newSet;
        });
        Toast.success('Post unliked!');
      } else {
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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 max-w-2xl py-8">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Feed</span>
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="h-11 w-11 bg-muted rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded"></div>
                    <div className="h-3 w-24 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted rounded"></div>
                  <div className="h-4 w-3/4 bg-muted rounded"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 max-w-2xl py-8">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Feed</span>
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-2">Post Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || 'The post you\'re looking for doesn\'t exist or has been removed.'}
              </p>
              <Link href="/">
                <Button>Go to Feed</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const hasImage = post.imageHash && post.imageUrl;
  const userHandle = getUserHandle(post.author);
  const isLiked = likedPosts.has(post.signature);
  const postContent = post.content;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-2xl py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Feed</span>
            </Button>
          </Link>
        </div>

        {/* Post rendered exactly like in PostList */}
        <Card className="hover:bg-muted/30 transition-all duration-200 shadow-sm border">
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
                  {postContent}
                </p>
              </div>
            )}

            {/* Post Image */}
            {hasImage && (
              <div className="mb-4">
                <NFTImage
                  imageUrl={post.imageUrl!}
                  alt="Post image"
                  width={600}
                  height={400}
                  postContent={post.content}
                  className="w-full rounded-lg"
                  onLoad={() => {
                    console.log('Image loaded successfully');
                  }}
                  onError={() => {
                    console.error('Failed to load image for post:', post.id);
                  }}
                />
              </div>
            )}
            
            {/* Interaction Bar - exactly like PostList */}
            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border/50">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <ReplyDialog 
                  post={post} 
                  onReplyCreated={refreshPost}
                />
                
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
                    href={`https://solscan.io/tx/${post.signature}?cluster=devnet`}
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
          </CardContent>
        </Card>

        {/* Inline Replies Section */}
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="h-px bg-border flex-1"></div>
            <span className="text-sm text-muted-foreground px-3">
              {(() => {
                const blockchainCount = post.replies || 0;
                const loadedCount = replies.length;
                
                // Prefer blockchain count if > 0, otherwise show loaded count
                const displayCount = blockchainCount > 0 ? blockchainCount : loadedCount;
                
                if (displayCount > 0) {
                  return `${displayCount} ${displayCount === 1 ? 'Reply' : 'Replies'}`;
                }
                return 'Replies';
              })()}
            </span>
            <div className="h-px bg-border flex-1"></div>
          </div>

          {loadingReplies ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-pulse">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="h-10 w-10 bg-muted rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-muted rounded"></div>
                      <div className="h-3 w-24 bg-muted rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded"></div>
                    <div className="h-4 w-3/4 bg-muted rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : replies.length > 0 ? (
            <div className="space-y-4">
              {replies.map((reply) => {
                const userHandle = getUserHandle(reply.author);
                
                return (
                  <Card key={reply.id} className="hover:bg-muted/30 transition-all duration-200">
                    <CardContent className="p-3 sm:p-6">
                      <div className="flex justify-between items-start mb-3 sm:mb-4">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1 sm:space-x-2">
                              <button
                                onClick={() => handleUserClick(reply.author)}
                                className="font-semibold text-foreground hover:text-primary transition-colors text-sm sm:text-base truncate"
                              >
                                {getUserDisplayName(reply.author)}
                              </button>
                              {userHandle && (
                                <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                  @{userHandle}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{formatTimestamp(reply.timestamp)}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="text-xs hidden sm:inline">reply</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Reply Content */}
                      <div className="mb-3 sm:mb-4">
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                          {reply.content}
                        </p>
                      </div>
                      
                      {/* Reply Actions */}
                      <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border/50">
                        <div className="flex items-center space-x-2 sm:space-x-4">
                          <ReplyDialog 
                            post={reply} 
                            onReplyCreated={refreshPost}
                          />
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const postUrl = `${window.location.origin}/post/${post.signature}`;
                              setShareUrl(postUrl);
                              setShareDialogOpen(true);
                            }}
                            className="text-muted-foreground hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all h-8 px-2 sm:px-3"
                          >
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="text-xs hidden sm:inline">Share</span>
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all h-8 px-2 sm:px-3"
                          >
                            <div className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex items-center justify-center">
                              ♡
                            </div>
                            <span className="text-xs hidden sm:inline">Like</span>
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
                              href={`https://solscan.io/tx/${reply.signature}?cluster=devnet`}
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <div className="text-2xl">💬</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">No replies yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Be the first to reply to this post
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Share Dialog - exactly like PostList */}
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
    </div>
  );
} 