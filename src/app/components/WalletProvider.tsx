'use client';

import React, { FC, ReactNode, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletError } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { getNetworkConfig } from '../utils/networkConfig';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
    children: ReactNode;
}

const WalletContextProvider: FC<Props> = ({ children }) => {
    // Get network configuration from environment variables
    const networkConfig = useMemo(() => getNetworkConfig(), []);
    
    console.log(`🌐 Connecting to Solana ${networkConfig.displayName} (${networkConfig.network})`);
    console.log(`🔗 RPC Endpoint: ${networkConfig.endpoint}`);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    // Error handler to prevent wallet disconnection on errors
    const onError = useCallback((error: WalletError) => {
        console.warn('Wallet error (non-critical):', error.message);
        // Don't disconnect on connection errors, just log them
    }, []);

    return (
        <ConnectionProvider 
            endpoint={networkConfig.endpoint}
            config={{
                commitment: 'confirmed',
                wsEndpoint: undefined, // Disable WebSocket to reduce connections
                httpHeaders: {
                    'User-Agent': 'Solcials/1.0',
                },
                fetchMiddleware: undefined,
                disableRetryOnRateLimit: false,
                confirmTransactionInitialTimeout: 30000, // 30 seconds
            }}
        >
            <WalletProvider 
                wallets={wallets} 
                autoConnect={true} // Enable auto-connect to maintain connection across navigation
                localStorageKey="solcials-wallet" // Custom key for wallet persistence
                onError={onError} // Handle errors gracefully without disconnecting
            >
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider; 