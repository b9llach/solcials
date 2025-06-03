'use client';

import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService, CustomUserProfile } from '../utils/solcialsProgram';
import { PublicKey } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Header from '../components/Header';

export default function DebugPage() {
  const [profiles, setProfiles] = useState<{ pubkey: PublicKey, profile: CustomUserProfile }[]>([]);
  const [loading, setLoading] = useState(false);
  const { connection } = useConnection();

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      const allProfiles = await solcialsProgram.getAllUserProfiles();
      setProfiles(allProfiles);
      console.log('All user profiles:', allProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllProfiles();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Debug: User Profiles</h1>
          <Button onClick={loadAllProfiles} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>

        <div className="space-y-4">
          {profiles.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  {loading ? 'Loading profiles...' : 'No user profiles found.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            profiles.map(({ pubkey, profile }) => (
              <Card key={pubkey.toString()}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {profile.displayName || profile.username || 'Anonymous'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div><strong>Wallet:</strong> {pubkey.toString()}</div>
                    <div><strong>Username:</strong> {profile.username || 'None'}</div>
                    <div><strong>Display Name:</strong> {profile.displayName || 'None'}</div>
                    <div><strong>Bio:</strong> {profile.bio || 'None'}</div>
                    <div><strong>Location:</strong> {profile.location || 'None'}</div>
                    <div><strong>Website:</strong> {profile.websiteUrl || 'None'}</div>
                    <div><strong>Followers:</strong> {profile.followersCount}</div>
                    <div><strong>Following:</strong> {profile.followingCount}</div>
                    <div><strong>Posts:</strong> {profile.postCount}</div>
                    <div><strong>Verified:</strong> {profile.verified ? 'Yes' : 'No'}</div>
                    <div><strong>Created:</strong> {new Date(profile.createdAt * 1000).toLocaleDateString()}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 