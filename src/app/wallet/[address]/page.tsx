'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useParams } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { SolcialsCustomProgramService } from '../../utils/solcialsProgram';
import { SocialPost } from '../../types/social';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import Header from '../../components/Header';
import PostList from '../../components/PostList';
import { 
  User, 
  MapPin, 
  Link as LinkIcon, 
  Users, 
  MessageSquare,
  Heart,
  VerifiedIcon,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Clock,
  UserPlus,
  UserCheck
} from 'lucide-react';

interface UserProfile {
  user: PublicKey;
  username?: string;
  displayName?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  followersCount: number;
  followingCount: number;
  postCount: number;
  createdAt: number;
  verified: boolean;
}

export default function WalletProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPublicKey, setUserPublicKey] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actualPostCount, setActualPostCount] = useState(0);
  const [followersData, setFollowersData] = useState<PublicKey[]>([]);
  const [followingData, setFollowingData] = useState<PublicKey[]>([]);
  const [likedPosts, setLikedPosts] = useState<SocialPost[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, { username?: string, displayName?: string }>>(new Map());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (address) {
      loadWalletProfile();
    }
  }, [address]);

  const loadWalletProfile = async () => {
    try {
      setLoading(true);
      const walletPubkey = new PublicKey(address);
      setUserPublicKey(walletPubkey);
      
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      
      // Get actual post count
      const allPosts = await solcialsProgram.getPosts(100);
      const userPosts = allPosts.filter(post => post.author.equals(walletPubkey));
      const userPostCount = userPosts.length;
      setActualPostCount(userPostCount);
      
      // Try to get user profile
      const userProfile = await solcialsProgram.getUserProfile(walletPubkey);
      
      if (userProfile) {
        const profileData: UserProfile = {
          user: userProfile.user,
          username: userProfile.username ?? undefined,
          displayName: userProfile.displayName ?? undefined,
          bio: userProfile.bio ?? undefined,
          websiteUrl: userProfile.websiteUrl ?? undefined,
          location: userProfile.location ?? undefined,
          followersCount: Number(userProfile.followersCount),
          followingCount: Number(userProfile.followingCount),
          postCount: userPostCount,
          createdAt: Number(userProfile.createdAt),
          verified: userProfile.verified
        };
        
        setProfile(profileData);
      } else {
        // Create a default profile if none exists
        const defaultProfile: UserProfile = {
          user: walletPubkey,
          username: undefined,
          displayName: undefined,
          bio: undefined,
          websiteUrl: undefined,
          location: undefined,
          followersCount: 0,
          followingCount: 0,
          postCount: userPostCount,
          createdAt: Date.now(),
          verified: false
        };
        
        setProfile(defaultProfile);
      }
      
      // Check if current user is following this user
      if (connected && publicKey) {
        console.log('🔍 Checking if', publicKey.toString(), 'is following', walletPubkey.toString());
        const following = await solcialsProgram.getFollowing(publicKey);
        console.log('📋 Current user following list:', following.map(pk => pk.toString()));
        const isCurrentlyFollowing = following.some(addr => addr.equals(walletPubkey));
        console.log('✅ Is following?', isCurrentlyFollowing);
        setIsFollowing(isCurrentlyFollowing);
      }
    } catch (error) {
      console.error('Error loading wallet profile:', error);
      // Invalid wallet address
      setProfile(null);
      setUserPublicKey(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!connected || !publicKey || !userPublicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (isRequesting) return;

    try {
      setIsRequesting(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      
      if (isFollowing) {
        await solcialsProgram.unfollowUser({ publicKey, signTransaction, connected }, userPublicKey);
        setIsFollowing(false);
        alert('Successfully unfollowed user!');
      } else {
        await solcialsProgram.followUser({ publicKey, signTransaction, connected }, userPublicKey);
        setIsFollowing(true);
        alert('Successfully followed user!');
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      alert(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user. Please try again.`);
    } finally {
      setIsRequesting(false);
    }
  };

  // Load functions for tabs (similar to other profile pages)
  const loadFollowersData = async () => {
    if (!userPublicKey) return;
    
    try {
      setLoadingFollowers(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const followers = await solcialsProgram.getFollowers(userPublicKey);
      setFollowersData(followers);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowingData = async () => {
    if (!userPublicKey) return;
    
    try {
      setLoadingFollowing(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const following = await solcialsProgram.getFollowing(userPublicKey);
      setFollowingData(following);
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const loadLikedPosts = async () => {
    if (!userPublicKey) return;
    
    try {
      setLoadingLikes(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const likes = await solcialsProgram.getUserLikes(userPublicKey);
      setLikedPosts(likes);
    } catch (error) {
      console.error('Error loading liked posts:', error);
    } finally {
      setLoadingLikes(false);
    }
  };

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

  const handleShare = (post: SocialPost) => {
    const postUrl = `${window.location.origin}/post/${post.signature}`;
    setShareUrl(postUrl);
    setShareDialogOpen(true);
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

  const copyAddress = async () => {
    if (userPublicKey) {
      await navigator.clipboard.writeText(userPublicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch user profiles for liked posts
  useEffect(() => {
    likedPosts.forEach(post => {
      fetchUserProfile(post.author);
    });
  }, [likedPosts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-48 bg-muted rounded-lg mb-4"></div>
            <div className="flex space-x-4">
              <div className="w-24 h-24 bg-muted rounded-full"></div>
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !userPublicKey) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Invalid wallet address</h2>
              <p className="text-muted-foreground mb-4">
                The wallet address {address} is not valid
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-4 mb-6">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold">
                    {profile.displayName || profile.username || `${address.slice(0, 8)}...${address.slice(-4)}`}
                  </h1>
                  {profile.verified && (
                    <VerifiedIcon className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                {profile.username && (
                  <p className="text-muted-foreground">@{profile.username}</p>
                )}
              </div>
              
              <div className="flex space-x-2 mt-4 sm:mt-0">
                {connected && 
                 publicKey && 
                 !userPublicKey.equals(publicKey) && (
                  <Button
                    onClick={handleFollow}
                    variant={isFollowing ? "secondary" : "default"}
                    size="sm"
                    disabled={isRequesting}
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isFollowing ? 'Unfollowing...' : 'Following...'}
                      </>
                    ) : isFollowing ? (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="space-y-4 mb-6">
          {profile.bio && (
            <p className="text-sm leading-relaxed">{profile.bio}</p>
          )}
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {profile.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile.websiteUrl && (
              <div className="flex items-center space-x-1">
                <LinkIcon className="h-4 w-4" />
                <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" 
                   className="text-blue-500 hover:underline">
                  {profile.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          <div className="flex space-x-6">
            <div className="flex items-center space-x-1">
              <span className="font-semibold">{profile.followersCount.toLocaleString()}</span>
              <span className="text-muted-foreground">followers</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-semibold">{profile.followingCount.toLocaleString()}</span>
              <span className="text-muted-foreground">following</span>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-xs font-mono">
              {userPublicKey.toString()}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAddress}
              className="h-6 w-6 p-0"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Tabs - Same as other profile pages */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="posts" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>posts</span>
              <Badge variant="secondary" className="text-xs">
                {actualPostCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="likes" onClick={() => !loadingLikes && likedPosts.length === 0 && loadLikedPosts()}>
              <Heart className="h-4 w-4 mr-2" />
              likes
              {likedPosts.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {likedPosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="following" onClick={() => !loadingFollowing && followingData.length === 0 && loadFollowingData()}>
              <Users className="h-4 w-4 mr-2" />
              following
              {followingData.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {followingData.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="followers" onClick={() => !loadingFollowers && followersData.length === 0 && loadFollowersData()}>
              <Users className="h-4 w-4 mr-2" />
              followers
              {followersData.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {followersData.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="posts" className="mt-6">
            <div className="max-h-[500px] overflow-y-auto">
              <PostList refreshTrigger={0} userFilter={userPublicKey.toString()} />
            </div>
          </TabsContent>
          
          <TabsContent value="likes" className="mt-6">
            {loadingLikes ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">loading liked posts...</p>
                </CardContent>
              </Card>
            ) : likedPosts.length > 0 ? (
              <div className="max-h-[500px] overflow-y-auto">
                <div className="space-y-4">
                  {likedPosts.map((post) => {
                    const userHandle = getUserHandle(post.author);
                    
                    return (
                      <Card key={post.id} className="hover:bg-muted/30 transition-all duration-200">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <button className="font-semibold text-foreground hover:text-primary transition-colors">
                                  {getUserDisplayName(post.author)}
                                </button>
                                {userHandle && (
                                  <span className="text-sm text-muted-foreground">
                                    @{userHandle}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed">{post.content}</p>
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                <Heart className="h-3 w-3 text-red-500" />
                                <span>liked</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShare(post)}
                                  className="text-muted-foreground hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all h-auto px-2 py-1"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Share</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="text-muted-foreground hover:text-primary hover:bg-accent transition-all h-auto px-2 py-1"
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
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">no liked posts yet</p>
                  <p className="text-xs text-muted-foreground mt-2">posts this user likes will appear here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="following" className="mt-6">
            {loadingFollowing ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">loading following list...</p>
                </CardContent>
              </Card>
            ) : followingData.length > 0 ? (
              <div className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {followingData.map((userKey) => (
                    <Card key={userKey.toString()} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {userKey.toString().slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{getUserDisplayName(userKey)}</p>
                            <p className="text-xs text-muted-foreground">@{getUserHandle(userKey)}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          view profile
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">not following anyone yet</p>
                  <p className="text-xs text-muted-foreground mt-2">discover and follow other users to see their content</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="followers" className="mt-6">
            {loadingFollowers ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">loading followers...</p>
                </CardContent>
              </Card>
            ) : followersData.length > 0 ? (
              <div className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {followersData.map((userKey) => (
                    <Card key={userKey.toString()} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {userKey.toString().slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{getUserDisplayName(userKey)}</p>
                            <p className="text-xs text-muted-foreground">@{getUserHandle(userKey)}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          view profile
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">no followers yet</p>
                  <p className="text-xs text-muted-foreground mt-2">when people follow this user, they&apos;ll appear here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
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
    </div>
  );
} 