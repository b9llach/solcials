import { Metadata } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { getNetworkConfig } from '../../utils/networkConfig';
import { SolcialsCustomProgramService } from '../../utils/solcialsProgram';

// Generate metadata for social sharing
export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  try {
    // Await params before using them
    const { address } = await params;
    
    // Validate address format
    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(address);
    } catch {
      return {
        title: 'invalid address on solcials',
        description: 'this wallet address could not be found',
      };
    }

    // Create a server-side connection for metadata fetching
    const networkConfig = getNetworkConfig();
    const connection = new Connection(networkConfig.endpoint);
    const socialService = new SolcialsCustomProgramService(connection);
    
    // Fetch user profile
    let userDisplayName = `${address.slice(0, 8)}...${address.slice(-4)}`;
    let userUsername = '';
    let userBio = 'decentralized profile on solana';
    let postCount = 0;
    let followersCount = 0;
    let followingCount = 0;
    
    try {
      const profile = await socialService.getUserProfile(userPubkey);
      if (profile) {
        userDisplayName = profile.displayName || profile.username || userDisplayName;
        userUsername = profile.username ? `@${profile.username}` : '';
        userBio = profile.bio || 'decentralized profile on solana';
        followersCount = Number(profile.followersCount || 0);
        followingCount = Number(profile.followingCount || 0);
      }

      // Get actual post count
      const allPosts = await socialService.getPosts(100);
      const userPosts = allPosts.filter(post => post.author.equals(userPubkey));
      postCount = userPosts.length;
    } catch (error) {
      console.warn('Failed to fetch user profile for metadata:', error);
    }

    // Create description with stats
    const stats = [];
    if (postCount > 0) stats.push(`${postCount} posts`);
    if (followersCount > 0) stats.push(`${followersCount} followers`);
    if (followingCount > 0) stats.push(`${followingCount} following`);
    
    const statsString = stats.length > 0 ? ` • ${stats.join(' • ')}` : '';
    const description = userBio.length > 100 
      ? `${userBio.substring(0, 97)}...${statsString}` 
      : `${userBio}${statsString}`;

    const title = `${userDisplayName} ${userUsername}`;
    const siteName = 'solcials - user';
    const profileUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/wallet/${address}`;

    return {
      title: `${title} on solcials`,
      description,
      openGraph: {
        title,
        description,
        url: profileUrl,
        siteName,
        type: 'profile',
        username: userUsername,
        firstName: userDisplayName,
      },
      twitter: {
        card: 'summary',
        title,
        description,
        creator: userUsername || 'unknown creator',
        site: 'solcials',
      },
      // Additional meta tags for other platforms
      other: {
        'discord:title': title,
        'discord:description': description,
        'theme-color': '#ffffff', // white color for brand
        'profile:username': userUsername,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for wallet profile:', error);
    return {
      title: 'solcials',
      description: 'view profiles on the solana blockchain',
    };
  }
}

// Layout component for wallet profile pages
// This layout inherits WalletProvider from the root layout
export default function WalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simply pass through children - WalletProvider is already available from root layout
  return <>{children}</>;
} 