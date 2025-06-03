'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { useUserProfile } from '../hooks/useUserProfile';
import { SocialPost } from '../types/social';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import Header from '../components/Header';
import PostList from '../components/PostList';
import { 
  User, 
  Settings, 
  Edit3, 
  MapPin, 
  Link as LinkIcon, 
  Users, 
  MessageSquare,
  Heart,
  VerifiedIcon,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Clock
} from 'lucide-react';

export default function ProfilePage() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { 
    profile, 
    loading, 
    updateProfile
  } = useUserProfile();
  
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [followersData, setFollowersData] = useState<PublicKey[]>([]);
  const [followingData, setFollowingData] = useState<PublicKey[]>([]);
  const [likedPosts, setLikedPosts] = useState<SocialPost[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, { username?: string, displayName?: string }>>(new Map());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    bio: '',
    websiteUrl: '',
    location: ''
  });

  // Initialize edit form when profile loads
  useEffect(() => {
    if (profile) {
      setEditForm({
        username: profile.username || '',
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        websiteUrl: profile.websiteUrl || '',
        location: profile.location || ''
      });
    }
  }, [profile]);

  // Fetch user profiles for liked posts
  useEffect(() => {
    likedPosts.forEach(post => {
      fetchUserProfile(post.author);
    });
  }, [likedPosts]);

  const validateUsername = (username: string): string | null => {
    if (!username) return null; // Username is optional
    
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 20) return 'Username must be 20 characters or less';
    if (/\s/.test(username)) return 'Username cannot contain spaces';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    if (username.startsWith('_') || username.endsWith('_')) return 'Username cannot start or end with underscore';
    
    return null;
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (editForm.username) {
      const usernameError = validateUsername(editForm.username);
      if (usernameError) errors.username = usernameError;
    }
    
    if (editForm.displayName.length > 50) {
      errors.displayName = 'Display name must be 50 characters or less';
    }
    
    if (editForm.bio.length > 160) {
      errors.bio = 'Bio must be 160 characters or less';
    }
    
    if (editForm.websiteUrl && !/^https?:\/\/.+/.test(editForm.websiteUrl)) {
      errors.websiteUrl = 'Website must be a valid URL (http:// or https://)';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) {
      return;
    }

    if (!publicKey || !signTransaction) {
      console.error('Wallet not properly connected');
      return;
    }

    try {
      setSaving(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      
      // Update profile with form data using the real Solana program
      await solcialsProgram.updateUserProfile(
        {
          publicKey,
          signTransaction,
          connected
        },
        editForm.username || undefined,
        editForm.displayName || undefined,
        editForm.bio || undefined,
        editForm.websiteUrl || undefined,
        editForm.location || undefined
      );
      
      // Update local cache immediately with the new data
      updateProfile({
        username: editForm.username || undefined,
        displayName: editForm.displayName || undefined,
        bio: editForm.bio || undefined,
        websiteUrl: editForm.websiteUrl || undefined,
        location: editForm.location || undefined
      });
      
      setEditing(false);
      setValidationErrors({});
      
      // Success message
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMsg.textContent = '✅ Profile updated successfully on Solana!';
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 4000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      
      const errorMsg = document.createElement('div');
      errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      errorMsg.textContent = '❌ Failed to update profile. Please try again.';
      document.body.appendChild(errorMsg);
      setTimeout(() => document.body.removeChild(errorMsg), 3000);
    } finally {
      setSaving(false);
    }
  };

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const loadFollowersData = async () => {
    if (!publicKey) return;
    
    try {
      setLoadingFollowers(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const followers = await solcialsProgram.getFollowers(publicKey);
      setFollowersData(followers);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowingData = async () => {
    if (!publicKey) return;
    
    try {
      setLoadingFollowing(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const following = await solcialsProgram.getFollowing(publicKey);
      setFollowingData(following);
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const loadLikedPosts = async () => {
    if (!publicKey) return;
    
    try {
      setLoadingLikes(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const likes = await solcialsProgram.getUserLikes(publicKey);
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

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">connect your wallet</h2>
              <p className="text-muted-foreground mb-4">
                connect your solana wallet to view your profile
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
                    {profile?.displayName || profile?.username || 'Anonymous'}
                  </h1>
                  {profile?.verified && (
                    <VerifiedIcon className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                {profile?.username && (
                  <p className="text-muted-foreground">@{profile.username}</p>
                )}
              </div>
              
              <div className="flex space-x-2 mt-4 sm:mt-0">
                <Dialog open={editing} onOpenChange={setEditing}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit3 className="h-4 w-4 mr-2" />
                      edit profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>edit profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">username</label>
                        <Input
                          value={editForm.username}
                          onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                          placeholder="@username (3-20 chars, no spaces)"
                          className={validationErrors.username ? 'border-red-500' : ''}
                        />
                        {validationErrors.username && (
                          <div className="flex items-center mt-1 text-sm text-red-500">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {validationErrors.username}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">display name</label>
                        <Input
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                          placeholder="Your display name"
                          className={validationErrors.displayName ? 'border-red-500' : ''}
                        />
                        {validationErrors.displayName && (
                          <div className="flex items-center mt-1 text-sm text-red-500">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {validationErrors.displayName}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">bio (max 160 chars)</label>
                        <Textarea
                          value={editForm.bio}
                          onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                          placeholder="tell us about yourself..."
                          rows={3}
                          className={validationErrors.bio ? 'border-red-500' : ''}
                        />
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs text-muted-foreground">
                            {editForm.bio.length}/160
                          </div>
                          {validationErrors.bio && (
                            <div className="flex items-center text-sm text-red-500">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {validationErrors.bio}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">website</label>
                        <Input
                          value={editForm.websiteUrl}
                          onChange={(e) => setEditForm({...editForm, websiteUrl: e.target.value})}
                          placeholder="https://your-website.com"
                          className={validationErrors.websiteUrl ? 'border-red-500' : ''}
                        />
                        {validationErrors.websiteUrl && (
                          <div className="flex items-center mt-1 text-sm text-red-500">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {validationErrors.websiteUrl}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">location</label>
                        <Input
                          value={editForm.location}
                          onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                          placeholder="Your location"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={handleSaveProfile} className="flex-1" disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              saving...
                            </>
                          ) : (
                            'save changes'
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setEditing(false)}>
                          cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="space-y-4 mb-6">
          {profile?.bio && (
            <p className="text-sm leading-relaxed">{profile.bio}</p>
          )}
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {profile?.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile?.websiteUrl && (
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
              <span className="font-semibold">{profile?.followersCount.toLocaleString()}</span>
              <span className="text-muted-foreground">followers</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-semibold">{profile?.followingCount.toLocaleString()}</span>
              <span className="text-muted-foreground">following</span>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-xs font-mono">
              {publicKey?.toString()}
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

        {/* Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="posts" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>posts</span>
              <Badge variant="secondary" className="text-xs">
                {profile?.postCount || 0}
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
            <PostList refreshTrigger={0} userFilter={publicKey?.toString()} />
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
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">no liked posts yet</p>
                  <p className="text-xs text-muted-foreground mt-2">posts you like will appear here</p>
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
                        following
                      </Button>
                    </div>
                  </Card>
                ))}
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
                        follow back
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">no followers yet</p>
                  <p className="text-xs text-muted-foreground mt-2">when people follow you, they&apos;ll appear here</p>
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