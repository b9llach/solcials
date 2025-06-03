'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { useUserProfile } from '../hooks/useUserProfile';
import { SocialPost } from '../types/social';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, Loader2, MessageSquare, Image as ImageIcon, X } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';

interface ReplyDialogProps {
  post: SocialPost;
  onReplyCreated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export default function ReplyDialog({ post, onReplyCreated, open, onOpenChange, children }: ReplyDialogProps) {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, { username?: string, displayName?: string }>>(new Map());
  
  const { connection } = useConnection();
  const wallet = useWallet();
  const { loading: profileLoading, getDisplayName, getUsername } = useUserProfile();

  useEffect(() => {
    setMounted(true);
    fetchUserProfile(post.author);
  }, []);

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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!content.trim() && !selectedImage) {
      alert('Please enter some content or select an image');
      return;
    }

    if (content.length > 280) {
      alert('Reply must be 280 characters or less');
      return;
    }

    try {
      setIsPosting(true);
      const customService = new SolcialsCustomProgramService(connection);
      
      if (selectedImage) {
        // Image reply with platform fee
        console.log('📸 Creating image reply with Solcials program...');
        await customService.createImageReply(wallet, content.trim(), post.id);
        
        // TODO: Implement image chunking for replies
        console.log('⚠️ Image chunking not yet implemented - reply created without image data');
        
      } else {
        // Text-only reply
        console.log('📝 Creating text reply with Solcials program...');
        await customService.createTextReply(wallet, content.trim(), post.id);
      }
      
      console.log('✅ Reply created with Solcials program!');
      
      setContent('');
      removeImage();
      onReplyCreated();
      
      // Close dialog
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        setIsDialogOpen(false);
      }
      
      // Success feedback
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMsg.textContent = selectedImage 
        ? '🎉✨ Premium image reply created!' 
        : '🎉💬 Reply created!';
      
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 4000);
      
    } catch (error) {
      console.error('Error creating reply:', error);
      
      if (error instanceof Error && error.message.includes('User profile')) {
        alert('Creating your user profile first, then try replying again.');
      } else {
        alert('Failed to create reply. Please try again.');
      }
    } finally {
      setIsPosting(false);
    }
  };

  const remainingChars = 280 - content.length;
  const isOverLimit = remainingChars < 0;
  const originalHandle = getUserHandle(post.author);

  if (!mounted) {
    return null;
  }

  const dialogContent = (
    <div className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Reply to {getUserDisplayName(post.author)}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4 mt-4">
        {/* Original Post Context */}
        <div className="p-3 bg-muted/20 rounded-lg border-l-2 border-primary/30">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {post.author.toString().slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium">{getUserDisplayName(post.author)}</span>
            {originalHandle && (
              <span className="text-xs text-muted-foreground">@{originalHandle}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>
        </div>

        {/* Reply Form */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="space-y-1">
              {profileLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-sm font-medium text-muted-foreground">loading...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{getDisplayName()}</span>
                  {getUsername() && (
                    <span className="text-xs text-muted-foreground">@{getUsername()}</span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Replying to @{originalHandle || 'user'}</p>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Post your reply..."
                  className={`min-h-[100px] resize-none border-0 focus-visible:ring-1 text-base placeholder:text-muted-foreground/60 ${
                    isOverLimit ? 'focus-visible:ring-red-500' : 'focus-visible:ring-primary'
                  }`}
                  disabled={isPosting}
                />

                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative">
                    <div className="relative rounded-xl overflow-hidden border bg-muted/20">
                      <img src={imagePreview} alt="preview" className="w-full h-auto max-h-48 object-cover" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                        disabled={isPosting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="reply-image-input"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => document.getElementById('reply-image-input')?.click()}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      disabled={isPosting || selectedImage !== null}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`text-sm font-mono ${
                      isOverLimit ? 'text-red-500' : 
                      remainingChars <= 20 ? 'text-yellow-500' : 
                      'text-muted-foreground'
                    }`}>
                      {remainingChars}
                    </span>
                    
                    <Button
                      type="submit"
                      disabled={isPosting || (!content.trim() && !selectedImage) || isOverLimit}
                      className="min-w-[80px] bg-primary hover:bg-primary/90"
                    >
                      {isPosting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          replying...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>

            {/* Info */}
            <div className="pt-3 border-t bg-muted/20 -mx-6 px-6 py-3 rounded-b-lg">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                    💬 reply
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {selectedImage ? 'premium reply' : 'standard reply'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (children) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {dialogContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all h-8 px-2 sm:px-3"
        >
          <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          <span className="text-xs hidden sm:inline">Reply</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
} 