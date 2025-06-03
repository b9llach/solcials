# Solana Social - Decentralized Social Media

A fully decentralized social media platform built on Solana blockchain where all posts and interactions are stored on-chain without any traditional database.

## 🌟 Features

- **Fully On-Chain**: All posts, follows, and interactions are stored as transactions on the Solana blockchain
- **No Database**: Zero reliance on traditional databases - everything lives on-chain
- **Wallet Integration**: Connect with popular Solana wallets (Phantom, Solflare, etc.)
- **Post Creation**: Share tweets/posts up to 280 characters
- **Follow System**: Follow other users by their wallet addresses
- **User Profiles**: View user profiles showing their posts and follower status
- **Transaction Explorer**: Direct links to Solana Explorer for transparency
- **Real-time Updates**: Fetch latest posts from the blockchain
- **Modern UI**: Built with shadcn/ui components for a professional look
- **Rate Limiting Protection**: Smart retry logic to handle RPC rate limits

## 🚀 How It Works

This application uses an innovative approach to create a social media platform without any centralized database:

### Data Storage
- **Posts**: Stored as memo instructions in Solana transactions with prefix `SOCIAL_POST:`
- **Follows**: Stored as memo instructions with prefix `SOCIAL_FOLLOW:`
- **All Data**: Permanently recorded on Solana blockchain for transparency and permanence

### Architecture
1. **Frontend**: Next.js 15 with TypeScript and Tailwind CSS 4
2. **UI Components**: shadcn/ui for modern, accessible design
3. **Blockchain**: Solana (currently configured for Devnet)
4. **Wallet Integration**: Solana Wallet Adapter
5. **Data Retrieval**: Parses transaction logs to reconstruct social data

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ 
- A Solana wallet (Phantom, Solflare, etc.)
- Some Devnet SOL for transaction fees

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <your-repo>
   cd social
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3000`

4. **Connect your wallet**:
   - Click "Connect Wallet" 
   - Choose your preferred Solana wallet
   - Make sure you're on Devnet
   - Get some Devnet SOL from a faucet if needed

## ⚡ Performance & Rate Limiting

### Major Rate Limiting Fixes (Latest Update)
We've implemented comprehensive fixes to prevent 429 rate limiting errors:

1. **Request Caching**: 30-second cache for all RPC requests to prevent duplicate calls
2. **Request Queueing**: All RPC requests are queued and processed sequentially with delays
3. **Smart Debouncing**: Prevents multiple simultaneous data fetches on wallet connection
4. **Reduced Batch Sizes**: Smaller request batches (3 instead of 5) with longer delays
5. **Auto-Connect Disabled**: Prevents immediate requests when page loads
6. **Connection Optimizations**: Disabled WebSocket and optimized connection settings

### How It Works
- **Caching Layer**: Identical requests within 30 seconds return cached data
- **Request Queue**: All RPC calls go through a queue with 500ms delays between requests
- **Debounce Logic**: Prevents rapid-fire requests when wallet connects/disconnects
- **Smart Retry**: Exponential backoff for 429 errors with queue integration

### Default RPC Limits
The app uses Solana's public RPC endpoints which have rate limits. With our new optimizations, you should experience:
- **Faster initial load** due to caching
- **No more 429 errors** under normal usage
- **Smoother wallet connection** experience
- **Better performance** with automatic request management

### Recommended: Custom RPC Setup
For even better performance, use a dedicated RPC provider:

1. **Get a free API key from:**
   - [Helius](https://helius.xyz) - Excellent for Solana development
   - [QuickNode](https://quicknode.com) - Fast, reliable endpoints
   - [Alchemy](https://alchemy.com) - Enterprise-grade infrastructure

2. **Update the RPC endpoint in** `src/app/components/WalletProvider.tsx`:
   ```typescript
   const endpoint = useMemo(() => {
     // Replace with your custom endpoint
     return 'https://rpc-devnet.helius.xyz/?api-key=YOUR_API_KEY';
     // return 'https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY';
   }, [network]);
   ```

### Built-in Rate Limiting Protection
The app includes:
- **Automatic retry logic** with exponential backoff
- **Request batching** to reduce RPC calls
- **Smart delays** between requests
- **Graceful error handling** for 429 errors

## 🎯 Usage

### Creating Posts
1. Connect your Solana wallet
2. Type your message (up to 280 characters)
3. Click "Post" - this creates a blockchain transaction
4. Your post appears in the feed once the transaction confirms

### Following Users
1. Click the "Follow" button on any post from a user you want to follow
2. This creates a follow transaction on-chain
3. Following status is tracked through blockchain transactions

### Viewing Profiles
1. Click on any user's avatar or name
2. View their complete post history
3. See follow status and follow/unfollow

### Exploring Transactions
- Click "View on Explorer" on any post to see the actual blockchain transaction
- All data is verifiable and transparent on Solana Explorer

## 🎨 UI Components

Built with **shadcn/ui** for a modern, professional look:

### Components Used
- **Cards** - Clean post containers with hover effects
- **Avatars** - User profile pictures with gradients
- **Buttons** - Multiple variants (default, outline, ghost)
- **Badges** - Status indicators and labels
- **Dialog** - Modal for user profiles
- **Skeleton** - Beautiful loading states
- **Form Elements** - Textarea, inputs with proper styling
- **Icons** - Lucide React icons throughout

### Features
- **Dark/Light Mode** - Automatic theme switching
- **Responsive Design** - Works on all screen sizes
- **Accessibility** - ARIA-compliant components
- **Smooth Animations** - Hover effects and transitions
- **Loading States** - Skeleton loaders for better UX

## 🏗️ Technical Architecture

### Key Components

- **WalletProvider**: Manages Solana wallet connections with rate limiting protection
- **SolanaSocialService**: Core blockchain interaction logic with retry mechanisms
- **CreatePost**: Modern UI for posting to blockchain with loading states
- **PostList**: Displays posts with skeleton loading and error handling
- **UserProfile**: Modal-based user profiles with shadcn Dialog
- **Header**: Navigation with wallet integration and modern styling

### Recent Improvements
- ✅ **Fixed Tailwind 4 compatibility** - Updated CSS imports and syntax
- ✅ **Added rate limiting protection** - Smart retry logic with exponential backoff
- ✅ **Upgraded to shadcn/ui** - Modern, accessible component library
- ✅ **Improved error handling** - Graceful degradation for network issues
- ✅ **Better performance** - Reduced RPC calls with intelligent batching

### Blockchain Integration

```typescript
// Example: Creating a post on-chain
const post = {
  id: `${wallet.publicKey}_${Date.now()}`,
  author: wallet.publicKey,
  content: "Hello Solana!",
  timestamp: Date.now()
};

// Stored as memo instruction in Solana transaction
const memoData = `SOCIAL_POST:${JSON.stringify(post)}`;
```

### Data Flow

1. **User Action** → shadcn UI Component
2. **Component** → SolanaSocialService (with retry logic)
3. **Service** → Solana Blockchain (via wallet signing)
4. **Blockchain** → Transaction Confirmation
5. **UI Update** → Re-fetch with skeleton loading

## 🔧 Configuration

### Network Settings
- Currently configured for **Solana Devnet**
- To change networks, modify `WalletProvider.tsx`:
  ```typescript
  const network = WalletAdapterNetwork.Devnet; // or Mainnet, Testnet
  ```

### Supported Wallets
- Phantom
- Solflare
- Additional wallets can be added in `WalletProvider.tsx`

### Customizing UI
- All components use shadcn/ui - easily customizable
- Color scheme defined in `globals.css`
- Icons from Lucide React - 1000+ available icons

## 🔐 Security & Privacy

- **Decentralized**: No central authority controls data
- **Transparent**: All data visible on blockchain
- **Permanent**: Posts cannot be deleted (blockchain immutability)
- **Self-Sovereign**: Users control their own keys and data
- **No Tracking**: No traditional analytics or user tracking

## 🚨 Important Notes

### Costs
- Each post/follow costs a small Solana transaction fee (~0.000005 SOL)
- Consider transaction costs for high-frequency usage

### Permanence
- **All posts are permanent** - they cannot be deleted once on-chain
- Think carefully before posting sensitive information

### Privacy
- All data is **public** and visible on blockchain explorers
- Wallet addresses are the only form of identity

### Performance
- Loading posts requires blockchain queries (may take a few seconds)
- Performance improves significantly with custom RPC endpoints
- Built-in retry logic handles temporary network issues

## 🛠️ Troubleshooting

### Common Issues

1. **"429 Rate Limited" errors**:
   - Use a custom RPC endpoint (see Performance section)
   - Wait a few seconds and try again
   - The app will automatically retry failed requests

2. **CSS not loading**:
   - We've fixed Tailwind 4 compatibility issues
   - Clear browser cache and restart dev server

3. **Wallet connection issues**:
   - Ensure you're on the correct network (Devnet)
   - Try refreshing the page
   - Check wallet browser extension is unlocked

4. **Slow loading**:
   - Default RPC has rate limits
   - Consider using a custom RPC provider
   - App uses intelligent batching to minimize requests

## 📚 Future Enhancements

- **Content Indexing**: Improve post loading speed with indexing service
- **Enhanced Profiles**: Add bio, avatar, username features  
- **Media Support**: Images and videos support
- **Search Functionality**: Find posts and users
- **Mobile App**: React Native version
- **Mainnet Deploy**: Production deployment
- **Token Integration**: Social tokens and monetization
- **Advanced UI**: More shadcn components (data tables, charts, etc.)

## 🤝 Contributing

This is an open-source project. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use and modify for your own projects.

## 🆘 Support

For issues or questions:
1. Check the browser console for errors
2. Verify wallet connection and network
3. Ensure sufficient SOL for transactions
4. Check Solana network status
5. Try using a custom RPC endpoint for better reliability

---

**Built with ❤️ on Solana using shadcn/ui**

*Experience the future of decentralized social media - where you own your data and no central authority can silence you.*
