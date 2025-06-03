'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { useUserProfile } from '../hooks/useUserProfile';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, MessageSquarePlus, Image as ImageIcon, MapPin, Smile, X, Upload } from 'lucide-react';
import Image from 'next/image';

interface CreatePostProps {
  onPostCreated: () => void;
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [postCost, setPostCost] = useState<{ totalCost: number; breakdown: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { connection } = useConnection();
  const wallet = useWallet();
  const { loading: profileLoading, getDisplayName, getUsername } = useUserProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate costs when image changes
  useEffect(() => {
    const calculateCosts = async () => {
      if (!mounted) return;
      
      const customService = new SolcialsCustomProgramService(connection);
      const costs = await customService.calculatePostCosts(!!selectedImage, selectedImage?.size);
      setPostCost(costs);
    };

    calculateCosts();
  }, [selectedImage, connection, mounted]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('please select an image file');
      return;
    }

    // Validate file size (5MB limit for on-chain storage)
    if (file.size > 5 * 1024 * 1024) {
      alert('image must be smaller than 5MB');
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      alert('please connect your wallet first');
      return;
    }

    if (!content.trim() && !selectedImage) {
      alert('please enter some content or select an image');
      return;
    }

    if (content.length > 280) {
      alert('post must be 280 characters or less');
      return;
    }

    try {
      setIsPosting(true);
      const customService = new SolcialsCustomProgramService(connection);
      
      if (selectedImage) {
        // Image post with platform fee
        setIsUploadingImage(true);
        
        try {
          console.log('📸 Creating image post with Solcials program...');
          await customService.createImagePost(wallet, content.trim());
          
          // TODO: Implement image chunking in a follow-up step
          console.log('⚠️ Image chunking not yet implemented - post created without image data');
          
        } catch (error) {
          console.error('Solcials program image post failed:', error);
          alert('Failed to create image post. Please try again.');
          return;
        } finally {
          setIsUploadingImage(false);
        }
      } else {
        // Text-only post (free)
        console.log('📝 Creating text post with Solcials program...');
        await customService.createTextPost(wallet, content.trim());
      }
      
      console.log('✅ Post created with Solcials program!');
      
      setContent('');
      removeImage();
      onPostCreated();
      
      // Success feedback
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMsg.textContent = selectedImage 
        ? '🎉✨ Premium image post created!' 
        : '🎉📝 Text post created!';
      
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 4000);
      
    } catch (error) {
      console.error('error creating post:', error);
      
      if (error instanceof Error && error.message.includes('User profile')) {
        alert('Creating your user profile first, then try posting again.');
      } else {
        alert('failed to create post. please try again.');
      }
    } finally {
      setIsPosting(false);
      setIsUploadingImage(false);
    }
  };

  const remainingChars = 280 - content.length;
  const isOverLimit = remainingChars < 0;

  // Get formatted cost display
  const getPostCostDisplay = () => {
    if (!postCost) return 'calculating...';
    return `${(postCost.totalCost / 1e9).toFixed(4)} SOL`;
  };

  // Show loading state during hydration
  if (!mounted) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">loading post composer...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!wallet.connected) {
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <MessageSquarePlus className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h3 className="text-lg font-medium text-foreground">connect your wallet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  connect your solana wallet to start posting on the blockchain
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                your posts will be stored permanently on-chain
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                {profileLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground">loading...</span>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium">
                      {getDisplayName()}
                    </span>
                    {getUsername() && (
                      <span className="text-xs text-muted-foreground">
                        @{getUsername()}
                      </span>
                    )}
                  </>
                )}
                <Badge variant="secondary" className="text-xs">
                  <div className="h-2 w-2 bg-green-500 rounded-full mr-1" />
                  online
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                what&apos;s happening?
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={selectedImage ? "add a caption to your image..." : "share your thoughts with the solana community..."}
                className={`min-h-[120px] resize-none border-0 focus-visible:ring-1 text-base placeholder:text-muted-foreground/60 ${
                  isOverLimit ? 'focus-visible:ring-red-500' : 'focus-visible:ring-primary'
                }`}
                disabled={isPosting}
              />

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative">
                  <div className="relative rounded-xl overflow-hidden border bg-muted/20">
                    <Image src={imagePreview} alt="preview" width={400} height={300} className="w-full h-auto max-h-64 object-cover" />
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">creating with Solcials program...</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                      disabled={isPosting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center">
                      <Upload className="h-3 w-3 mr-1" />
                      {selectedImage?.name} ({(selectedImage?.size || 0 / 1024 / 1024).toFixed(2)} MB)
                    </div>
                    <div className="text-orange-600 dark:text-orange-400">
                      cost: {getPostCostDisplay()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Character Counter & Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    disabled={isPosting || selectedImage !== null}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    disabled={isPosting}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    disabled={isPosting}
                  >
                    <MapPin className="h-4 w-4" />
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
                    disabled={isPosting || (!content.trim() && !selectedImage) || isOverLimit || isUploadingImage}
                    className="min-w-[100px] bg-primary hover:bg-primary/90"
                  >
                    {isPosting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        posting...
                      </>
                    ) : isUploadingImage ? (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        creating...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>

          {/* Post Info */}
          <div className="pt-3 border-t bg-muted/20 -mx-6 px-6 py-3 rounded-b-lg">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                  ✨ solcials program
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {selectedImage ? 'premium post' : 'standard post'}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  cost: {getPostCostDisplay()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 