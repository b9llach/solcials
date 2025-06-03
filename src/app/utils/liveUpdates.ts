import { Connection } from '@solana/web3.js';
import { SolanaSocialService } from './solana';
import { SocialPost } from '../types/social';

export interface LiveUpdateOptions {
  pollInterval: number; // in milliseconds
  onNewPosts: (newPosts: SocialPost[]) => void;
  onError: (error: Error) => void;
  enabled: boolean;
}

export class LiveUpdateService {
  private connection: Connection;
  private socialService: SolanaSocialService;
  private pollInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private lastPostTimestamp: number = 0;
  private onNewPosts: (newPosts: SocialPost[]) => void;
  private onError: (error: Error) => void;
  private enabled: boolean = false;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 3;

  constructor(connection: Connection, options: LiveUpdateOptions) {
    this.connection = connection;
    this.socialService = new SolanaSocialService(connection);
    this.pollInterval = Math.max(options.pollInterval, 60000); // Minimum 1 minute
    this.onNewPosts = options.onNewPosts;
    this.onError = options.onError;
    this.enabled = options.enabled;
  }

  start() {
    if (!this.enabled || this.intervalId) {
      return;
    }

    console.log('🔴 Starting live updates...');
    
    // Set initial timestamp
    this.lastPostTimestamp = Date.now();
    
    // Start polling with reduced frequency
    this.intervalId = setInterval(async () => {
      try {
        await this.checkForNewPosts();
        this.consecutiveErrors = 0; // Reset error count on success
      } catch (error) {
        console.error('Live update error:', error);
        this.consecutiveErrors++;
        
        // If too many consecutive errors, disable live updates temporarily
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          console.warn('🚫 Too many consecutive errors, pausing live updates for 5 minutes');
          this.stop();
          setTimeout(() => {
            if (this.enabled) {
              console.log('🔄 Resuming live updates after cooldown');
              this.consecutiveErrors = 0;
              this.start();
            }
          }, 300000); // 5 minute cooldown
        }
        
        this.onError(error as Error);
      }
    }, this.pollInterval);
  }

  stop() {
    if (this.intervalId) {
      console.log('⏹️ Stopping live updates...');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  updatePollInterval(newInterval: number) {
    this.pollInterval = newInterval;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  private async checkForNewPosts() {
    try {
      // Fetch fewer recent posts to reduce API calls
      const recentPosts = await this.socialService.getPosts(10); // Reduced from 20
      
      // Filter for new posts since last check
      const newPosts = recentPosts.filter(post => 
        post.timestamp > this.lastPostTimestamp
      );

      if (newPosts.length > 0) {
        console.log(`📢 Found ${newPosts.length} new posts!`);
        
        // Update last timestamp
        this.lastPostTimestamp = Math.max(...newPosts.map(p => p.timestamp));
        
        // Notify about new posts
        this.onNewPosts(newPosts);
        
        // Show browser notification if permission granted
        this.showBrowserNotification(newPosts.length);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle rate limit errors more gracefully
      if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
        console.warn('⏳ Rate limited during live update check, will retry later');
        // Don't throw, just skip this update cycle
        return;
      }
      
      // For other errors, still don't throw to avoid breaking the polling
      console.warn('Error checking for new posts:', error);
    }
  }

  private showBrowserNotification(count: number) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Solcials', {
        body: `${count} new post${count > 1 ? 's' : ''} on your feed!`,
        icon: '/favicon.ico',
        tag: 'new-posts'
      });
    }
  }

  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }
}

// Utility function to create a live update service
export function createLiveUpdateService(
  connection: Connection,
  onNewPosts: (posts: SocialPost[]) => void,
  pollInterval: number = 30000 // 30 seconds default
): LiveUpdateService {
  return new LiveUpdateService(connection, {
    pollInterval,
    onNewPosts,
    onError: (error) => {
      console.error('Live update error:', error);
      // Could show toast notification here
    },
    enabled: true
  });
} 