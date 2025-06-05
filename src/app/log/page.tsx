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
              <div>• implemented twitter share button (6/5/25)</div>
              <div>• implemented solana program architecture (6/4/25)</div>
              <div>• implemented anchor framework integration (6/4/25)</div>
              <div>• implemented user profile system (6/4/25)</div>
              <div>• implemented wallet connection and authentication (6/4/25)</div>
              <div>• implemented text posts (network fees only) (6/4/25)</div>
              <div>• implemented image posts (network fees only) (6/4/25)</div>
              <div>• implemented post likes and unlikes (6/4/25)</div>
              <div>• implemented user following system (6/4/25)</div>
              <div>• implemented unfollow functionality (6/4/25)</div>
              <div>• implemented username availability checking (6/4/25)</div>
              <div>• implemented username uniqueness validation (6/4/25)</div>
              <div>• implemented post replies and threading (6/4/25)</div>
              <div>• implemented conversation view (6/4/25)</div>
              <div>• implemented cnft integration with metadata (6/4/25)</div>
              <div>• implemented nft image posts (6/4/25)</div>
              <div>• implemented metadata extraction from content (6/4/25)</div>
              <div>• implemented content sanitization for ui display (6/4/25)</div>
              <div>• implemented global account caching (6/4/25)</div>
              <div>• implemented rate limiting and retry logic (6/4/25)</div>
              <div>• implemented comprehensive error handling (6/4/25)</div>
              <div>• implemented rpc connection optimization (6/4/25)</div>
              <div>• implemented transaction confirmation handling (6/4/25)</div>
              <div>• implemented pda based account derivation (6/4/25)</div>
              <div>• implemented rent exempt account storage (6/4/25)</div>
              <div>• implemented zero platform fees (6/4/25)</div>
              <div>• implemented responsive mobile design (6/4/25)</div>
              <div>• implemented dark/light theme toggle (6/4/25)</div>
              <div>• implemented wallet security validation (6/4/25)</div>
              <div>• implemented profile customization (username, bio, website, location) (6/4/25)</div>
              <div>• implemented custom 404 and error pages (6/4/25)</div>
              <div>• implemented scroll area height fixes (6/4/25)</div>
              <div>• implemented typescript compilation fixes (6/4/25)</div>
              <div>• implemented metadata visibility fixes (6/4/25)</div>
              <div>• implemented comprehensive logging system (6/4/25)</div>
              <div>• implemented mainnet deployment (6/4/25)</div>
              <div>• implemented program id verification (6/4/25)</div>
              <div>• implemented wallet balance validation (6/4/25)</div>
              <div>• implemented post timestamp validation (6/4/25)</div>
              <div>• implemented account collision detection (6/4/25)</div>
              <div>• implemented orphaned account cleanup (6/4/25)</div>
              <div>• implemented follow relationship debugging (6/4/25)</div>
              <div>• implemented account inspection tools (6/4/25)</div>
              <div>• implemented force account closure (6/4/25)</div>
              <div>• implemented smart cleanup system (6/4/25)</div>
              <div>• implemented replies cache system (6/4/25)</div>
              <div>• implemented conversation threading (6/4/25)</div>
              <div>• implemented image chunk support (6/4/25)</div>
              <div>• implemented cnft address validation (6/4/25)</div>
              <div>• implemented post content cleaning utilities (6/4/25)</div>
              <div>• implemented development statistics tracking (6/4/25)</div>
              <div>• implemented git conflict resolution (6/4/25)</div>
              <div>• implemented production ready infrastructure (6/4/25)</div>
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