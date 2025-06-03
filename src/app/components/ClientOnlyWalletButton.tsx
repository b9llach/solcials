'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, LogOut, User, Zap } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

export default function ClientOnlyWalletButton() {
  const [mounted, setMounted] = useState(false);
  const { connected, publicKey, disconnect, connecting, disconnecting } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || connecting || disconnecting) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        disabled
        className="min-w-[140px] bg-background/50 backdrop-blur border-primary/20"
      >
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        {connecting ? 'Connecting...' : disconnecting ? 'Disconnecting...' : 'Loading...'}
      </Button>
    );
  }

  if (connected && publicKey) {
    const formatAddress = (address: string) => {
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const handleDisconnect = () => {
      disconnect().catch(console.error);
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="min-w-[140px] bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/40 dark:hover:to-blue-900/40 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-purple-700 dark:text-purple-300">
                {formatAddress(publicKey.toString())}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur border-border/50">
          <div className="px-3 py-2">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Solcials Wallet</span>
            </div>
            <div className="mt-1">
              <code className="text-xs text-muted-foreground font-mono break-all">
                {publicKey.toString()}
              </code>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/me" className="flex items-center space-x-2 cursor-pointer">
              <User className="h-4 w-4" />
              <span>View Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleDisconnect}
            className="flex items-center space-x-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="wallet-adapter-button-trigger">
      <WalletMultiButton 
        style={{
          background: 'linear-gradient(135deg, rgb(147 51 234) 0%, rgb(59 130 246) 100%)',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'white',
          minWidth: '140px',
          height: '36px',
          transition: 'all 0.3s ease',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        }}
        className="!bg-none hover:scale-105 hover:shadow-lg transition-all duration-300"
      />
    </div>
  );
} 