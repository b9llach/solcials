import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

export interface NetworkConfig {
  network: WalletAdapterNetwork;
  endpoint: string;
  displayName: string;
  isMainnet: boolean;
}

/**
 * Get the current network configuration based on environment variables
 */
export function getNetworkConfig(): NetworkConfig {
  // Get network from environment variable, default to devnet
  const networkEnv = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase() || 'devnet';
  
  let network: WalletAdapterNetwork;
  let displayName: string;
  let isMainnet = false;
  
  // Map environment variable to WalletAdapterNetwork
  switch (networkEnv) {
    case 'mainnet-beta':
    case 'mainnet':
      network = WalletAdapterNetwork.Mainnet;
      displayName = 'Mainnet';
      isMainnet = true;
      break;
    case 'testnet':
      network = WalletAdapterNetwork.Testnet;
      displayName = 'Testnet';
      break;
    case 'devnet':
    default:
      network = WalletAdapterNetwork.Devnet;
      displayName = 'Devnet';
      break;
  }

  // Get RPC endpoint
  const endpoint = getRpcEndpoint(network);

  return {
    network,
    endpoint,
    displayName,
    isMainnet
  };
}

/**
 * Get the appropriate RPC endpoint for the given network
 */
function getRpcEndpoint(network: WalletAdapterNetwork): string {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS;
  
  // Check for custom RPC URLs first
  const customMainnetRpc = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
  const customDevnetRpc = process.env.NEXT_PUBLIC_DEVNET_RPC_URL;
  const customTestnetRpc = process.env.NEXT_PUBLIC_TESTNET_RPC_URL;
  
  // Use custom RPC if provided
  if (network === WalletAdapterNetwork.Mainnet && customMainnetRpc) {
    console.log('🔧 Using custom mainnet RPC endpoint');
    return customMainnetRpc;
  }
  
  if (network === WalletAdapterNetwork.Devnet && customDevnetRpc) {
    console.log('🔧 Using custom devnet RPC endpoint');
    return customDevnetRpc;
  }
  
  if (network === WalletAdapterNetwork.Testnet && customTestnetRpc) {
    console.log('🔧 Using custom testnet RPC endpoint');
    return customTestnetRpc;
  }
  
  // Use Helius if API key is provided
  if (heliusApiKey) {
    const heliusNetwork = network === WalletAdapterNetwork.Mainnet ? 'mainnet' : 'devnet';
    console.log(`🚀 Using Helius RPC for improved performance on ${heliusNetwork}`);
    return `https://${heliusNetwork}.helius-rpc.com/?api-key=${heliusApiKey}`;
  }
  
  // Fallback to public RPC
  console.log(`⚠️ Using public ${network} RPC (rate limited)`);
  return clusterApiUrl(network);
}

/**
 * Get WebSocket endpoint for the current network (for Helius)
 */
export function getWebSocketEndpoint(): string | null {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS;
  if (!heliusApiKey) return null;
  
  const config = getNetworkConfig();
  const heliusNetwork = config.isMainnet ? 'mainnet' : 'devnet';
  
  return `wss://${heliusNetwork}.helius-rpc.com/?api-key=${heliusApiKey}`;
}

/**
 * Get the program ID from environment variables
 */
export function getProgramId(): string {
  return process.env.NEXT_PUBLIC_SOLCIALS_PROGRAM_ID || '2dMkuyNN2mUiSWyW1UGTRE7CkfULpudVdMCbASCChLpv';
}

/**
 * Get the platform treasury from environment variables
 */
export function getPlatformTreasury(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_TREASURY || 'DpfkoSVQNmh3XS2JgzU39nMHMqz9VH7ag2447GkRt8va';
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';
} 