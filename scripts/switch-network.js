#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const networks = {
  devnet: {
    NEXT_PUBLIC_SOLANA_NETWORK: 'devnet',
    description: 'Development network for testing'
  },
  mainnet: {
    NEXT_PUBLIC_SOLANA_NETWORK: 'mainnet-beta',
    description: 'Main Solana network (production)'
  },
  testnet: {
    NEXT_PUBLIC_SOLANA_NETWORK: 'testnet',
    description: 'Test network'
  }
};

function updateEnvFile(network) {
  const envPath = path.join(process.cwd(), '.env.local');
  const envExamplePath = path.join(process.cwd(), 'env.example');
  
  // Read existing .env.local or create from example
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(envExamplePath)) {
    console.log('📋 Creating .env.local from env.example...');
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  } else {
    console.error('❌ No env.example file found. Please create one first.');
    process.exit(1);
  }

  // Update the network setting
  const networkConfig = networks[network];
  const updatedContent = envContent.replace(
    /NEXT_PUBLIC_SOLANA_NETWORK=.*/,
    `NEXT_PUBLIC_SOLANA_NETWORK=${networkConfig.NEXT_PUBLIC_SOLANA_NETWORK}`
  );

  // Write back to .env.local
  fs.writeFileSync(envPath, updatedContent);
  
  console.log(`✅ Switched to ${network} (${networkConfig.description})`);
  console.log(`📝 Updated .env.local with NEXT_PUBLIC_SOLANA_NETWORK=${networkConfig.NEXT_PUBLIC_SOLANA_NETWORK}`);
  console.log('🔄 Please restart your development server for changes to take effect');
}

function showUsage() {
  console.log('🌐 Solcials Network Switcher');
  console.log('');
  console.log('Usage: node scripts/switch-network.js [network]');
  console.log('');
  console.log('Available networks:');
  Object.entries(networks).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(8)} - ${config.description}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/switch-network.js devnet   # Switch to devnet');
  console.log('  node scripts/switch-network.js mainnet  # Switch to mainnet');
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  showUsage();
  process.exit(0);
}

const network = args[0].toLowerCase();

if (!networks[network]) {
  console.error(`❌ Unknown network: ${network}`);
  console.log('');
  showUsage();
  process.exit(1);
}

updateEnvFile(network); 