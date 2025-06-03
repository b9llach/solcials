# Deployment Guide for Solcials

## Environment Variables Required

### For Vercel Deployment

You need to set these environment variables in your Vercel dashboard:

1. **Go to your Vercel project dashboard**
2. **Navigate to Settings > Environment Variables**
3. **Add the following variables:**

```
NEXT_PUBLIC_LIGHTHOUSE_API_KEY=your_lighthouse_api_key_here
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Getting Your Lighthouse API Key

1. **Visit** [Lighthouse Storage](https://lighthouse.storage/)
2. **Sign up** for an account
3. **Generate an API key** from your dashboard
4. **Copy the key** and add it to Vercel environment variables

### Image Loading Issues on Production

If images aren't loading on Vercel but work on localhost, check:

#### 1. Environment Variables
- Ensure `NEXT_PUBLIC_LIGHTHOUSE_API_KEY` is set in Vercel
- Verify the API key is valid and has upload permissions

#### 2. IPFS Gateway Issues
- Images are stored on IPFS via Lighthouse
- Gateway URLs: `https://gateway.lighthouse.storage/ipfs/{cid}`
- Check browser console for 404 errors on image URLs

#### 3. Metadata Storage
- NFT metadata is stored in localStorage on localhost
- On production, localStorage is empty for new users
- The app now includes fallbacks for missing metadata

#### 4. Debug Steps

Check the browser console for these logs:
```
🔍 Lighthouse Service Initialization:
  - Environment: production
  - API Key present: true
  - API Key length: 64
```

If you see `API Key present: false`, the environment variable isn't set properly.

### Common Issues & Solutions

#### "No image available" error
- **Cause**: NFT metadata not found or NFT mint account doesn't exist
- **Solution**: App now shows placeholder images for missing metadata

#### "NFT mint account not found" error
- **Cause**: Posts reference NFT addresses that don't exist on the blockchain
- **Root cause**: NFT creation failed but post was still created
- **Solution**: 
  1. New posts now validate NFT exists before creating post
  2. Use the NFT cleanup utility to remove invalid metadata
  3. App shows placeholder images for invalid NFTs

#### "Lighthouse API key not configured" error
- **Cause**: Missing or invalid API key
- **Solution**: Set `NEXT_PUBLIC_LIGHTHOUSE_API_KEY` in Vercel

#### Images load slowly
- **Cause**: IPFS gateway latency
- **Solution**: Images are decentralized, loading time varies

#### NFT Creation Issues
- **Cause**: Network differences between localhost and production
- **Solution**: 
  1. Ensure you're using the same Solana network (devnet)
  2. Clear localStorage when switching environments
  3. Use the NFT cleanup button to remove invalid entries

## NFT Validation & Cleanup

### Automatic NFT Validation
The app now includes automatic validation:
- **Before post creation**: Validates NFT exists on blockchain
- **After NFT creation**: Confirms mint account was actually created
- **During image loading**: Shows placeholders for invalid NFTs

### Manual Cleanup
If you're seeing "no image available" errors:
1. **Check browser console** for NFT validation errors
2. **Use NFT cleanup utility** (if implemented in your UI)
3. **Clear localStorage** to reset all NFT metadata
4. **Try creating new image posts** with the improved validation

## Testing Your Deployment

1. **Create a new post** with an image
2. **Check browser console** for error messages
3. **Verify environment variables** are loaded
4. **Test image upload** and display

## Debugging Commands

Add these to check your environment:

```javascript
// In browser console
console.log('Environment:', process.env.NODE_ENV);
console.log('Lighthouse Key:', !!process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY);
```

## Support

If you continue having issues:
1. Check Vercel deployment logs
2. Verify environment variables are set
3. Test Lighthouse API key separately
4. Check browser network tab for failed requests 