'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { SocialPost } from '../types/social';
import { PublicKey } from '@solana/web3.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Clock, User, UserCheck, MessageSquare } from 'lucide-react';

interface UserProfileProps {
  userAddress: string;
  onClose: () => void;
}

export default function UserProfile({ userAddress, onClose }: UserProfileProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { connection } = useConnection();
  const wallet = useWallet();

  const userPublicKey = new PublicKey(userAddress);
  const fetchingRef = useRef(false);

  const fetchUserData = async () => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current) {
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      const socialService = new SolcialsCustomProgramService(connection);
      
      // Fetch user posts with smaller limit
      const allPosts = await socialService.getPosts(50);
      const userPosts = allPosts.filter(post => post.author.equals(userPublicKey));
      setPosts(userPosts);
      
      // Check if current user is following this user (only if wallet connected)
      if (wallet.publicKey) {
        try {
          const userFollowing = await socialService.getFollowing(wallet.publicKey);
          setIsFollowing(userFollowing.some(pk => pk.equals(userPublicKey)));
        } catch (error) {
          console.warn('Failed to fetch following status:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const handleFollow = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (isRequesting) {
      return;
    }

    try {
      setIsRequesting(true);
      const socialService = new SolcialsCustomProgramService(connection);
      await socialService.followUser(wallet, userPublicKey);
      setIsFollowing(true);
      alert('Successfully followed user!');
    } catch (error) {
      console.error('Error following user:', error);
      alert('Failed to follow user. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    // Add a small delay to avoid immediate request
    const timer = setTimeout(() => {
      fetchUserData();
    }, 300);

    return () => clearTimeout(timer);
  }, [userAddress]); // Only depend on userAddress

  const formatAddress = (address: PublicKey) => {
    const addressStr = address.toString();
    return `${addressStr.slice(0, 8)}...${addressStr.slice(-8)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info Section */}
          <div className="flex items-start space-x-4">
            <Avatar className="h-16 w-16 ring-2 ring-border">
              <AvatarFallback className="bg-gradient-to-r from-purple-400 to-blue-500 text-white font-bold text-xl">
                {formatAddress(userPublicKey).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {formatAddress(userPublicKey)}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  <span>{posts.length} posts</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  Solana Wallet
                </Badge>
                {wallet.connected && 
                 wallet.publicKey && 
                 !userPublicKey.equals(wallet.publicKey) && (
                  <Button
                    onClick={handleFollow}
                    disabled={isFollowing || isRequesting}
                    size="sm"
                    variant={isFollowing ? "secondary" : "default"}
                    className="flex items-center space-x-1"
                  >
                    {isRequesting ? (
                      <>
                        <User className="h-3 w-3 animate-spin" />
                        <span>Following...</span>
                      </>
                    ) : isFollowing ? (
                      <>
                        <UserCheck className="h-3 w-3" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" />
                        <span>Follow</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Posts Section */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Posts
            </h4>
            
            {loading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-muted-foreground space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto opacity-50" />
                    <p>No posts yet</p>
                    <Badge variant="outline" className="text-xs">
                      Be the first to post!
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Card key={post.signature} className="transition-shadow hover:shadow-sm">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                          {post.content}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(post.timestamp)}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-muted-foreground hover:text-primary h-auto p-0"
                          >
                            <a
                              href={`https://explorer.solana.com/tx/${post.signature}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-xs"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Explorer</span>
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 