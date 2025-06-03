'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './ThemeToggle';
import ClientOnlyWalletButton from './ClientOnlyWalletButton';
import { Search, Home, ArrowLeft } from 'lucide-react';

export default function Header() {
  const wallet = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleBackClick = () => {
    router.back();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement search functionality
      console.log('Searching for:', searchQuery);
    }
  };

  const isHomePage = pathname === '/';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Left Section - Logo/Brand and Navigation */}
          <div className="flex items-center space-x-4">
            {/* Back button when not on home page */}
            {/* {!isHomePage && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackClick}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )} */}

            {/* Logo and Brand - Clickable to go home */}
            <button 
              onClick={handleLogoClick}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <h1 className="text-xl font-bold text-foreground">
                solcials |
              </h1>
              <Badge variant="outline" className="text-xs">
                testing in devnet
              </Badge>
            </button>

            {/* Home button (always visible for quick access) */}
            {/* {!isHomePage && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogoClick}
                className="text-muted-foreground hover:text-foreground hidden sm:flex"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            )} */}
          </div>

          {/* Center Section - Search Bar (Hidden on mobile) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search posts, users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-0 focus:bg-background transition-colors"
                />
              </div>
            </form>
          </div>

          {/* Right Section - Theme Toggle & Wallet */}
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            
            {/* Status indicator when not connected */}
            {mounted && !wallet.connected && (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  Connect to post
                </Badge>
              </div>
            )}
            
            {/* Wallet Button - Handles both connect and disconnect with dropdown */}
            <div className="custom-wallet-button">
              <ClientOnlyWalletButton />
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden border-t py-3">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search posts, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-0 focus:bg-background transition-colors"
              />
            </div>
          </form>
        </div>
      </div>
    </header>
  );
} 