'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import ClientOnlyWalletButton from './ClientOnlyWalletButton';
import { Search, Twitter } from 'lucide-react';

export default function Header() {
  const wallet = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/wallet/${searchQuery}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4">
          {/* Left Section - Logo/Brand */}
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-shrink">
            {/* Logo and Brand - Clickable to go home */}
            <button 
              onClick={handleLogoClick}
              className="flex items-center space-x-1 sm:space-x-2 hover:opacity-80 transition-opacity min-w-0"
            >
              <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
                solcials
              </h1>
              <span className="hidden sm:inline text-base sm:text-xl font-bold text-foreground">|</span>
              <Badge variant="outline" className="text-xs hidden sm:inline-flex whitespace-nowrap">
                beta 0.1.1
              </Badge>
              <Badge variant="outline" className="text-xs sm:hidden">
                beta 0.1.1
              </Badge>
            </button>
          </div>

          {/* Center Section - Search Bar (Hidden on mobile) */}
          <div className="hidden lg:flex flex-1 max-w-md mx-4 xl:mx-8">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="paste wallet"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-0 focus:bg-background transition-colors"
                />
              </div>
            </form>
          </div>

          {/* Right Section - Theme Toggle & Wallet */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Development Log"
            >
              <Link href="/log">
                <span className="hidden sm:inline">devlog</span>
                <span className="sm:hidden">log</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <a
                href="https://x.com/solcialsonsol"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="follow us on twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </Button>
            <ThemeToggle />
            
            {/* Status indicator when not connected - Hidden on small mobile */}
            {mounted && !wallet.connected && (
              <div className="hidden sm:flex items-center space-x-2">
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  Connect to post
                </Badge>
              </div>
            )}
            
            {/* Wallet Button */}
            <div className="flex-shrink-0">
              <ClientOnlyWalletButton />
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {/* <div className="lg:hidden border-t py-2 sm:py-3">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search posts, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-0 focus:bg-background transition-colors h-9"
              />
            </div>
          </form>
        </div> */}
      </div>
    </header>
  );
} 