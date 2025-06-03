'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../../utils/solcialsProgram';
import { SocialPost } from '../../types/social';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, ExternalLink, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { PublicKey } from '@solana/web3.js';

export default function PostDetailPage() {
  const params = useParams();
  const signature = params.signature as string;
  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { connection } = useConnection();

  useEffect(() => {
    const fetchPost = async () => {
      if (!signature) return;

      try {
        setLoading(true);
        const socialService = new SolcialsCustomProgramService(connection);
        const posts = await socialService.getPosts(100); // Get more posts to find the specific one
        
        const foundPost = posts.find(p => p.signature === signature || p.id === signature);
        
        if (foundPost) {
          setPost(foundPost);
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
  }, [signature, connection]);

  const formatAddress = (address: PublicKey) => {
    const addressStr = address.toString();
    return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
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

        <Card className="shadow-sm border">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3 mb-4">
              <Avatar className="h-12 w-12 ring-2 ring-background">
                <AvatarFallback className="bg-gradient-to-r from-purple-400 to-blue-500 text-white font-bold">
                  {formatAddress(post.author).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-semibold text-foreground">
                    {formatAddress(post.author)}
                  </span>
                  {hasImage && (
                    <Badge variant="outline" className="text-xs">
                      📸 Image
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
                    Solcials
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimestamp(post.timestamp)}</span>
                  <span>•</span>
                  <span className="text-xs">On-chain</span>
                </div>
              </div>
            </div>
            
            {/* Post Content */}
            {post.content && (
              <div className="mb-4">
                <p className="text-foreground whitespace-pre-wrap leading-relaxed text-lg">
                  {post.content}
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
                    className="w-full max-h-96 object-cover"
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
            
            {/* Post Metadata */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="text-sm text-muted-foreground">
                Posted on Solcials • Blockchain social media
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
                
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  Blockchain
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 