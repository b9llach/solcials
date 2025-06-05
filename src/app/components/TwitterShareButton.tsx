'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface TwitterShareButtonProps {
  url: string;
  text: string;
  via?: string;
  hashtags?: string[];
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
  showText?: boolean;
}
 
// Utility function to generate better Twitter share text
export const generateTwitterShareText = (
  authorName: string,
  content: string,
  isImagePost: boolean = false
): string => {
  // Clean and prepare content
  const cleanedContent = content.replace(/\n?__META:[a-zA-Z0-9]+__/g, '').trim();
  
  // Handle different post types
  if (!cleanedContent || cleanedContent.length === 0) {
    // Image-only or empty post
    if (isImagePost) {
      return `check out this image post by ${authorName} on @solcialsonsol`;
    } else {
      return `check out this post by ${authorName} on @solcialsonsol`;
    }
  }
  
  // Post with content
  const maxContentLength = 40;
  const truncatedContent = cleanedContent.length > maxContentLength 
    ? `${cleanedContent.substring(0, maxContentLength)}...`
    : cleanedContent;
  
  return `check out this post by ${authorName} on @solcialsonsol: "${truncatedContent}"`;
};

export default function TwitterShareButton({
  url,
  text,
  via = 'solcialsonsol',
  hashtags = ['solcialsonsol', 'solana'],
  size = 'sm',
  variant = 'ghost',
  className = '',
  showText = true
}: TwitterShareButtonProps) {
  
  const handleTwitterShare = () => {
    // Construct Twitter intent URL
    const twitterUrl = new URL('https://twitter.com/intent/tweet');
    
    // Add parameters
    twitterUrl.searchParams.set('text', text);
    twitterUrl.searchParams.set('url', url);    
    
    if (via) {
      twitterUrl.searchParams.set('via', via);
    }
    
    if (hashtags && hashtags.length > 0) {
      twitterUrl.searchParams.set('hashtags', hashtags.join(','));
    }

    // Open in new tab
    window.open(
      twitterUrl.toString(),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const getIconSize = () => {
    switch (size) {
      case 'lg':
        return 'h-5 w-5';
      case 'default':
        return 'h-4 w-4';
      case 'sm':
      default:
        return 'h-3 w-3';
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleTwitterShare}
      className={`text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all ${className}`}
      title="Share on Twitter"
    >
      <svg 
        className={`${getIconSize()} ${showText ? 'mr-1' : ''}`}
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      {showText && (
        <span className="text-xs hidden sm:inline">
          share
        </span>
      )}
    </Button>
  );
} 