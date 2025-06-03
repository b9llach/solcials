import { Metadata } from 'next';
import { Connection } from '@solana/web3.js';
import { getNetworkConfig } from '../../utils/networkConfig';
import { SolcialsCustomProgramService } from '../../utils/solcialsProgram';

// Generate metadata for social sharing
export async function generateMetadata({ params }: { params: Promise<{ signature: string }> }): Promise<Metadata> {
  try {
    // Await params before using them
    const { signature } = await params;
    
    // Create a server-side connection for metadata fetching
    const networkConfig = getNetworkConfig();
    const connection = new Connection(networkConfig.endpoint);
    const socialService = new SolcialsCustomProgramService(connection);
    
    // Fetch posts to find the one with matching signature
    const posts = await socialService.getPosts(100);
    const post = posts.find(p => p.signature === signature || p.id === signature);
    
    if (!post) {
      return {
        title: 'post not found on solcials',
        description: 'this post could not be found',
      };
    }

    // Fetch user profile for the post author
    let authorDisplayName = `${post.author.toString().slice(0, 8)}...${post.author.toString().slice(-4)}`;
    let authorUsername = '';
    
    try {
      const profile = await socialService.getUserProfile(post.author);
      if (profile) {
        authorDisplayName = profile.displayName || profile.username || authorDisplayName;
        authorUsername = profile.username ? `@${profile.username}` : '';
      }
    } catch (error) {
      console.warn('Failed to fetch author profile for metadata:', error);
    }

    // Truncate content for description (Discord/Twitter limits)
    const description = post.content.length > 200 
      ? `${post.content.substring(0, 197)}...` 
      : post.content;

    const title = `${authorDisplayName} ${authorUsername}`;
    const siteName = 'solcials - post';
    const postUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/post/${signature}`;

    return {
      title: `${title} on solcials`,
      description,
      openGraph: {
        title,
        description,
        url: postUrl,
        siteName,
        type: 'article',
        publishedTime: new Date(post.timestamp).toISOString(),
        authors: [authorDisplayName],
        tags: ['solana', 'blockchain', 'social', 'decentralized'],
        ...(post.imageUrl && {
          images: [
            {
              url: post.imageUrl,
              width: 1200,
              height: 630,
              alt: `Image shared by ${authorDisplayName}`,
            },
          ],
        }),
      },
      twitter: {
        card: post.imageUrl ? 'summary_large_image' : 'summary',
        title,
        description,
        creator: authorUsername || 'unknown creator',
        site: 'solcials',
        ...(post.imageUrl && {
          images: [post.imageUrl],
        }),
      },
      // Additional meta tags for other platforms
      other: {
        'discord:title': title,
        'discord:description': description,
        'theme-color': '#ffffff', // white color for brand
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'solcials',
      description: 'view posts on the solana blockchain',
    };
  }
}

// Layout component for post pages
export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 