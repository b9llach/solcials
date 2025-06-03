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
        className="min-w-[120px] sm:min-w-[140px] bg-background/50 backdrop-blur border-primary/20 flex items-center justify-center"
      >
        <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
        <span className="hidden sm:inline">
          {connecting ? 'Connecting...' : disconnecting ? 'Disconnecting...' : 'Loading...'}
        </span>
        <span className="sm:hidden">
          {connecting ? 'Connecting' : disconnecting ? 'Disconnecting' : 'Loading'}
        </span>
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
            className="min-w-[120px] sm:min-w-[140px] bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/40 dark:hover:to-blue-900/40 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-center space-x-1 sm:space-x-2 w-full">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="font-medium text-purple-700 dark:text-purple-300 text-xs sm:text-sm truncate">
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
    <div className="wallet-adapter-button-trigger flex items-center justify-center">
      <WalletMultiButton 
        style={{
          background: 'linear-gradient(135deg, rgb(147 51 234) 0%, rgb(59 130 246) 100%)',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'white',
          minWidth: '120px',
          width: '100%',
          height: '36px',
          transition: 'all 0.3s ease',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
        className="!bg-none hover:scale-105 hover:shadow-lg transition-all duration-300 !flex !items-center !justify-center"
      />
      <style jsx global>{`
        .wallet-adapter-button {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
        }
        .wallet-adapter-button-trigger .wallet-adapter-button {
          width: 100% !important;
          min-width: 120px !important;
        }
        @media (min-width: 640px) {
          .wallet-adapter-button-trigger .wallet-adapter-button {
            min-width: 140px !important;
          }
        }
      `}</style>
    </div>
  );
} 