'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Header from './components/Header';
import CreatePost from './components/CreatePost';
import PostList from './components/PostList';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createLiveUpdateService } from './utils/liveUpdates';
import { createWebSocketLiveUpdateService } from './utils/liveUpdatesWebSocket';
import { SocialPost } from './types/social';
import { Globe, Users, NotebookPenIcon } from 'lucide-react';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showMobileComposer, setShowMobileComposer] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();

  // Initialize live updates - WebSocket if Helius API key available, otherwise HTTP polling
  useEffect(() => {
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS;
    
    if (heliusApiKey) {
      // Use WebSocket for real-time updates with Helius
      console.log('🚀 Using WebSocket live updates with Helius');
      const service = createWebSocketLiveUpdateService(
        (newPosts: SocialPost[]) => {
          console.log('📢 New posts received via WebSocket:', newPosts.length);
          setRefreshTrigger(prev => prev + 1);
        }
      );
      
      service.start();

      return () => {
        console.log('🧹 Cleaning up WebSocket service...');
        service.stop();
      };
    } else {
      // Fallback to HTTP polling
      console.log('⚠️ Helius API key not found, using HTTP polling fallback');
      const service = createLiveUpdateService(
        connection,
        (newPosts: SocialPost[]) => {
          console.log('📢 New posts received via HTTP polling:', newPosts.length);
          setRefreshTrigger(prev => prev + 1);
        },
        300000 // 5 minutes for HTTP polling
      );
      
      service.start();

      return () => {
        service.stop();
      };
    }
  }, []); // Remove connection dependency to prevent recreation

  const handlePostCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowMobileComposer(false); // Close mobile composer
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="container mx-auto px-4 max-w-2xl flex h-full">
          {/* Main Feed - Full width Twitter-like layout */}
          <main className="flex-1 flex flex-col border-x border-border/50 min-w-0">
            {/* Feed Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
                <TabsList className="grid w-full grid-cols-2 h-12 bg-transparent border-0 rounded-none">
                  <TabsTrigger 
                    value="all" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    all posts
                  </TabsTrigger>
                  <TabsTrigger 
                    value="following" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
                    disabled={!connected}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    following
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* All Posts Feed */}
              <TabsContent value="all" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <PostList refreshTrigger={refreshTrigger} feedType="all" />
                </ScrollArea>
              </TabsContent>

              {/* Following Feed */}
              <TabsContent value="following" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  {connected && publicKey ? (
                    <PostList refreshTrigger={refreshTrigger} feedType="following" />
                  ) : (
                    <div className="p-8 text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">connect to see following</h3>
                      <p className="text-muted-foreground">
                        connect your wallet to see posts from people you follow
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      {/* Floating Action Button - Bigger and bolder + */}
      {connected && (
        <Dialog open={showMobileComposer} onOpenChange={setShowMobileComposer}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-40"
            >
              <NotebookPenIcon className="h-10 w-10 font-bold stroke-[3]" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-4 max-h-[80vh] overflow-y-auto">
            <DialogTitle className="sr-only">create new post</DialogTitle>
            <CreatePost onPostCreated={handlePostCreated} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
