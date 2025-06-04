import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LogPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">solcials development log</h1>
            <Badge variant="outline" className="text-sm">
              beta 0.1.1
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">
            chronological log of everything implemented in solcials
          </p>
        </div>

        {/* Development Log */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>implementation log</CardTitle>
            <CardDescription>
              everything that has been built
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm font-mono">
              <div>• implemented solana program architecture</div>
              <div>• implemented anchor framework integration</div>
              <div>• implemented user profile system</div>
              <div>• implemented wallet connection and authentication</div>
              <div>• implemented text posts (network fees only)</div>
              <div>• implemented image posts (network fees only)</div>
              <div>• implemented post likes and unlikes</div>
              <div>• implemented user following system</div>
              <div>• implemented unfollow functionality</div>
              <div>• implemented username availability checking</div>
              <div>• implemented username uniqueness validation</div>
              <div>• implemented post replies and threading</div>
              <div>• implemented conversation view</div>
              <div>• implemented cnft integration with metadata</div>
              <div>• implemented nft image posts</div>
              <div>• implemented metadata extraction from content</div>
              <div>• implemented content sanitization for ui display</div>
              <div>• implemented global account caching</div>
              <div>• implemented rate limiting and retry logic</div>
              <div>• implemented comprehensive error handling</div>
              <div>• implemented rpc connection optimization</div>
              <div>• implemented transaction confirmation handling</div>
              <div>• implemented pda based account derivation</div>
              <div>• implemented rent exempt account storage</div>
              <div>• implemented zero platform fees</div>
              <div>• implemented responsive mobile design</div>
              <div>• implemented dark/light theme toggle</div>
              <div>• implemented wallet security validation</div>
              <div>• implemented profile customization (username, bio, website, location)</div>
              <div>• implemented custom 404 and error pages</div>
              <div>• implemented scroll area height fixes</div>
              <div>• implemented typescript compilation fixes</div>
              <div>• implemented metadata visibility fixes</div>
              <div>• implemented comprehensive logging system</div>
              <div>• implemented mainnet deployment</div>
              <div>• implemented program id verification</div>
              <div>• implemented wallet balance validation</div>
              <div>• implemented post timestamp validation</div>
              <div>• implemented account collision detection</div>
              <div>• implemented orphaned account cleanup</div>
              <div>• implemented follow relationship debugging</div>
              <div>• implemented account inspection tools</div>
              <div>• implemented force account closure</div>
              <div>• implemented smart cleanup system</div>
              <div>• implemented replies cache system</div>
              <div>• implemented conversation threading</div>
              <div>• implemented image chunk support</div>
              <div>• implemented cnft address validation</div>
              <div>• implemented post content cleaning utilities</div>
              <div>• implemented development statistics tracking</div>
              <div>• implemented git conflict resolution</div>
              <div>• implemented production ready infrastructure</div>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>system information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm font-mono">
              <div>program id: 7a6vstpjcuYDJDGiyvhkTCteZePCwpwDzucLCe2uacmY</div>
              <div>network: solana mainnet</div>
              <div>platform fees: 0 sol (completely free)</div>
              <div>account storage: rent exempt</div>
              <div>framework: anchor</div>
              <div>frontend: next.js + typescript</div>
              <div>ui: tailwind + shadcn</div>
              <div>wallet: solana wallet adapter</div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm font-mono">
              <div>total features: 45+</div>
              <div>platform cost: free</div>
              <div>deployment: mainnet</div>
              <div>status: production</div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Button asChild className="px-8">
            <Link href="/">
              back to feed
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 