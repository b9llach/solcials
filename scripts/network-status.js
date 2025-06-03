#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getCurrentNetwork() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️ No .env.local file found');
    console.log('💡 Run `npm run network:devnet` to set up your network configuration');
    return null;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const networkMatch = envContent.match(/NEXT_PUBLIC_SOLANA_NETWORK=(.+)/);
  
  if (!networkMatch) {
    console.log('⚠️ NEXT_PUBLIC_SOLANA_NETWORK not found in .env.local');
    return null;
  }

  return networkMatch[1].trim();
}

function showNetworkStatus() {
  console.log('🌐 Solcials Network Status');
  console.log('============================');
  
  const currentNetwork = getCurrentNetwork();
  
  if (!currentNetwork) {
    return;
  }

  let networkDisplay, description, isMainnet;
  
  switch (currentNetwork.toLowerCase()) {
    case 'mainnet-beta':
    case 'mainnet':
      networkDisplay = 'Mainnet';
      description = 'Production network';
      isMainnet = true;
      break;
    case 'devnet':
      networkDisplay = 'Devnet';
      description = 'Development network';
      isMainnet = false;
      break;
    case 'testnet':
      networkDisplay = 'Testnet';
      description = 'Test network';
      isMainnet = false;
      break;
    default:
      networkDisplay = currentNetwork;
      description = 'Unknown network';
      isMainnet = false;
  }

  console.log(`Current Network: ${networkDisplay} ${isMainnet ? '🔴' : '🟡'}`);
  console.log(`Description:     ${description}`);
  console.log(`Environment:     NEXT_PUBLIC_SOLANA_NETWORK=${currentNetwork}`);
  
  if (isMainnet) {
    console.log('');
    console.log('⚠️  WARNING: You are on MAINNET');
    console.log('💰 Real SOL transactions will occur');
    console.log('🚨 Make sure you know what you are doing!');
  }

  console.log('');
  console.log('🔧 To switch networks:');
  console.log('   npm run network:devnet   # Switch to devnet');
  console.log('   npm run network:mainnet  # Switch to mainnet');
  console.log('   npm run network:testnet  # Switch to testnet');
}

showNetworkStatus(); 