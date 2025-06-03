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
import { getSimplifiedNFTService } from '../utils/simplifiedNftService';
import { getLighthouseService } from '../utils/lighthouseService';
import { getImageDimensions, formatFileSize } from '../utils/imageUtils';
import { Toast } from '../utils/toast';

interface CreatePostProps {
  onPostCreated: () => void;
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number; aspectRatio: number } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [postCost, setPostCost] = useState<{ totalCost: number; breakdown: string } | null>(null);
  const [lighthouseBalance, setLighthouseBalance] = useState<{ dataLimit: string; dataUsed: string }>({ dataLimit: '0', dataUsed: '0' });
  const [loadingLighthouse, setLoadingLighthouse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { connection } = useConnection();
  const wallet = useWallet();
  const { loading: profileLoading, getDisplayName, getUsername } = useUserProfile();

  useEffect(() => {
    setMounted(true);
    loadLighthouseInfo();
  }, []);

  // Load Lighthouse storage information
  const loadLighthouseInfo = async () => {
    if (!mounted) return;
    
    try {
      setLoadingLighthouse(true);
      const lighthouseService = getLighthouseService();
      
      // Test connection first
      const connectionTest = await lighthouseService.testConnection();
      console.log('🔍 Lighthouse connection test:', connectionTest.message);
      
      if (!connectionTest.isValid) {
        console.warn('⚠️ Lighthouse API key issue:', connectionTest.message);
        setLighthouseBalance({ dataLimit: 'API Key Error', dataUsed: connectionTest.message });
        return;
      }
      
      const balance = await lighthouseService.getBalance();
      setLighthouseBalance(balance);
    } catch (error) {
      console.warn('Could not load Lighthouse info:', error);
      setLighthouseBalance({ 
        dataLimit: 'Error', 
        dataUsed: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setLoadingLighthouse(false);
    }
  };

  // Calculate costs when image changes
  useEffect(() => {
    const calculateCosts = async () => {
      if (!mounted) return;
      
      let totalCost = 0.00036; // Base text post cost
      let breakdown = 'text post creation';
      
      if (selectedImage) {
        totalCost = 0.001; // NFT creation cost
        breakdown = 'NFT + post creation';
        
        // Add Lighthouse cost estimate
        try {
          const lighthouseService = getLighthouseService();
          const { estimatedCost } = lighthouseService.getUploadCostEstimate(selectedImage.size);
          breakdown += ` + ${estimatedCost} storage`;
        } catch (error) {
          console.warn('Could not get Lighthouse cost:', error);
          breakdown += ' + IPFS/Filecoin storage';
        }
      }
      
      setPostCost({
        totalCost: totalCost * 1e9,
        breakdown
      });
    };

    calculateCosts();
  }, [selectedImage, mounted]);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      Toast.error('please select an image file');
      return;
    }

    // Add 1MB file size limit for better performance and user experience
    if (file.size > 1024 * 1024) { // 1MB in bytes
      Toast.error('image must be smaller than 1MB');
      return;
    }

    setSelectedImage(file);

    // Create preview and get dimensions
    const reader = new FileReader();
    reader.onload = async (e) => {
      const preview = e.target?.result as string;
      setImagePreview(preview);
      
      // Get image dimensions
      try {
        const dimensions = await getImageDimensions(file);
        setImageDimensions(dimensions);
        console.log('📐 Image dimensions:', dimensions);
      } catch (error) {
        console.warn('Could not get image dimensions:', error);
        setImageDimensions(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      Toast.warning('Please connect your wallet first');
      return;
    }

    if (!content.trim() && !selectedImage) {
      Toast.warning('Please enter some content or select an image');
      return;
    }

    if (content.length > 280) {
      Toast.error('Post must be 280 characters or less');
      return;
    }

    try {
      setIsPosting(true);
      const customService = new SolcialsCustomProgramService(connection);
      
      if (selectedImage) {
        // Image post with cNFT creation
        setIsUploadingImage(true);
        
        try {
          console.log('🎨 Creating image post with NFT...');
          
          // Step 1: Create the NFT
          const nftService = getSimplifiedNFTService();
          const { nftAddress } = await nftService.createImageNFT(
            {
              publicKey: wallet.publicKey,
              signTransaction: wallet.signTransaction,
              signAllTransactions: wallet.signAllTransactions,
              connected: wallet.connected
            },
            selectedImage,
            content.trim()
          );
          
          console.log('✅ NFT created:', nftAddress.toString());
          
          // Step 2: Create the image post with NFT reference
          await customService.createImagePostWithCNft(
            wallet, 
            content.trim(), 
            nftAddress
          );
          
          console.log('✅ Image post created with NFT reference!');
          
        } catch (error) {
          console.error('Failed to create image post with NFT:', error);
          Toast.error('Failed to create image post. Please try again.');
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
      Toast.success(selectedImage 
        ? 'Image post created with NFT!' 
        : 'Text post created!'
      );
      
    } catch (error) {
      console.error('error creating post:', error);
      
      // Better error debugging for production
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        if (error.message.includes('Lighthouse')) {
          Toast.error('Image upload failed. Please check your internet connection and try again.');
        } else if (error.message.includes('User profile')) {
          Toast.info('Creating your user profile first, then try posting again.');
        } else if (error.message.includes('API key')) {
          Toast.error('Image upload service unavailable. Please try posting without an image.');
        } else {
          Toast.error('Failed to create post. Please try again.');
        }
      } else {
        Toast.error('Failed to create post. Please try again.');
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
    <div className="space-y-4 w-full">
      <Card className="shadow-sm w-full border-0 sm:border">
        <CardHeader className="pb-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                {profileLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground">loading profile...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {getDisplayName() || 'Anonymous User'}
                      </span>
                      {getUsername() && (
                        <span className="text-xs text-muted-foreground truncate">
                          @{getUsername()}
                        </span>
                      )}
                      {!getUsername() && wallet.publicKey && (
                        <span className="text-xs text-muted-foreground truncate">
                          {wallet.publicKey.toString().slice(0, 8)}...{wallet.publicKey.toString().slice(-4)}
                        </span>
                      )}
                      {(!getDisplayName() || !getUsername()) && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 flex-shrink-0">
                          setup profile
                        </Badge>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      <div className="h-2 w-2 bg-green-500 rounded-full mr-1" />
                      online
                    </Badge>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {(!getDisplayName() || !getUsername()) && !profileLoading 
                  ? "complete your profile to get started" 
                  : "what's happening?"
                }
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 px-4 sm:px-6 lg:px-8 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4 w-full">
            <div className="space-y-4 w-full">
              <div className="w-full overflow-hidden">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={selectedImage ? "add a caption to your image..." : "share your thoughts with the solana community..."}
                  className={`min-h-[160px] sm:min-h-[200px] w-full resize-none border-0 focus-visible:ring-1 text-base placeholder:text-muted-foreground/60 break-words whitespace-pre-wrap overflow-hidden ${
                    isOverLimit ? 'focus-visible:ring-red-500' : 'focus-visible:ring-primary'
                  }`}
                  style={{
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    maxWidth: '100%',
                    width: '100%'
                  }}
                  disabled={isPosting}
                />
              </div>

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative w-full overflow-hidden">
                  <div className="relative rounded-xl overflow-hidden border bg-muted/20 w-full">
                    <div className="w-full flex justify-center bg-gray-50 dark:bg-gray-900">
                      <div className="relative max-w-full">
                        <Image 
                          src={imagePreview} 
                          alt="preview" 
                          width={0}
                          height={0}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="w-auto h-auto max-w-full max-h-[400px] sm:max-h-[500px] rounded-xl"
                          style={{ 
                            width: 'auto',
                            height: 'auto',
                            maxWidth: '100%'
                          }}
                        />
                      </div>
                    </div>
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
                      className="absolute top-3 right-3 bg-black/70 hover:bg-black/80 text-white rounded-full p-2 transition-colors z-10"
                      disabled={isPosting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-start justify-between text-sm text-muted-foreground gap-2">
                    <div className="flex items-center min-w-0 flex-1">
                      <Upload className="h-4 w-4 mr-2 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{selectedImage?.name}</span>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span className="hidden sm:inline">{selectedImage ? formatFileSize(selectedImage.size) : ''}</span>
                          {imageDimensions && (
                            <span className="hidden sm:inline">
                              • {imageDimensions.width}×{imageDimensions.height}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-orange-600 dark:text-orange-400 font-medium flex-shrink-0 text-xs sm:text-sm">
                      {getPostCostDisplay()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Character Counter & Actions */}
              <div className="flex items-center justify-between pt-2 gap-2">
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
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-accent flex-shrink-0"
                    disabled={isPosting || selectedImage !== null}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-accent flex-shrink-0 hidden sm:flex"
                    disabled={isPosting}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-accent flex-shrink-0 hidden sm:flex"
                    disabled={isPosting}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className={`text-xs sm:text-sm font-mono font-medium ${
                    isOverLimit ? 'text-red-500' : 
                    remainingChars <= 20 ? 'text-yellow-500' : 
                    'text-muted-foreground'
                  }`}>
                    {remainingChars}
                  </span>
                  
                  <Button
                    type="submit"
                    disabled={isPosting || (!content.trim() && !selectedImage) || isOverLimit || isUploadingImage}
                    className="min-w-[100px] sm:min-w-[120px] h-9 bg-primary hover:bg-primary/90 flex-shrink-0 text-sm"
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
          <div className="pt-3 border-t bg-muted/20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 rounded-b-lg overflow-hidden">
            <div className="flex items-start justify-between text-xs text-muted-foreground gap-2">
              <div className="flex items-center flex-wrap gap-1 min-w-0">
                <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700 flex-shrink-0">
                  ✨ solcials
                </Badge>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {selectedImage ? 'NFT' : 'text'}
                </Badge>
                {selectedImage && (
                  <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700 flex-shrink-0 hidden sm:inline-flex">
                    🔗 permanent
                  </Badge>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  cost: {getPostCostDisplay()}
                </div>
              </div>
            </div>
            
            {/* Lighthouse Wallet Info for Image Posts */}
            {selectedImage && (
              <div className="mt-2 pt-2 border-t border-border/30 overflow-hidden">
                <div className="flex items-start justify-between text-xs gap-2">
                  <div className="flex items-center space-x-2 text-muted-foreground min-w-0 flex-1">
                    <span className="flex-shrink-0">Lighthouse:</span>
                    {loadingLighthouse ? (
                      <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                    ) : (
                      <>
                        <span className="font-mono truncate text-xs">
                          {lighthouseBalance.dataLimit ? `${lighthouseBalance.dataLimit.slice(0, 6)}...${lighthouseBalance.dataLimit.slice(-4)}` : 'Loading...'}
                        </span>
                        <span className="text-green-600 flex-shrink-0 text-xs">
                          {lighthouseBalance.dataUsed}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 