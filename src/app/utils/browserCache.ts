/**
 * Browser Cache Utility for Zero-Cost Vercel Hosting
 * Reduces API calls by caching data in localStorage
 */

interface CacheItem {
  data: unknown;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class BrowserCache {
  private static readonly PREFIX = 'solcials_';
  
  static set(key: string, data: unknown, ttl: number = 300000): void {
    try {
      const item: CacheItem = {
        data,
        timestamp: Date.now(),
        ttl
      };
      
      localStorage.setItem(
        this.PREFIX + key, 
        JSON.stringify(item)
      );
    } catch (error) {
      console.warn('Cache write failed:', error);
      // Fail silently to not break the app
    }
  }
  
  static get<T = unknown>(key: string): T | null {
    try {
      const stored = localStorage.getItem(this.PREFIX + key);
      if (!stored) return null;
      
      const item: CacheItem = JSON.parse(stored);
      const now = Date.now();
      
      // Check if expired
      if (now - item.timestamp > item.ttl) {
        this.remove(key);
        return null;
      }
      
      return item.data as T;
    } catch (error) {
      console.warn('Cache read failed:', error);
      return null;
    }
  }
  
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.warn('Cache remove failed:', error);
    }
  }
  
  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }
  
  static getStats(): { totalItems: number; totalSize: string } {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      let totalSize = 0;
      cacheKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      });
      
      return {
        totalItems: cacheKeys.length,
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`
      };
    } catch (error) {
      console.warn('Cache stats failed:', error);
      return { totalItems: 0, totalSize: '0 KB' };
    }
  }
  
  static cleanExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      cacheKeys.forEach(key => {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const item: CacheItem = JSON.parse(stored);
            const now = Date.now();
            
            if (now - item.timestamp > item.ttl) {
              localStorage.removeItem(key);
            }
          } catch {
            // Invalid format, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }
}

// Cache TTL constants for different data types
export const CACHE_TTL = {
  POSTS: 60000,        // 1 minute for posts (fresh content)
  PROFILES: 300000,    // 5 minutes for user profiles (less frequently changed)
  FOLLOWING: 600000,   // 10 minutes for following lists (rarely changed)
  LIKES: 180000,       // 3 minutes for likes (moderately dynamic)
  REPLIES: 120000,     // 2 minutes for replies (fairly dynamic)
} as const;

// Auto-cleanup on app load
if (typeof window !== 'undefined') {
  // Clean expired cache on load
  BrowserCache.cleanExpired();
  
  // Set up periodic cleanup (every 10 minutes)
  setInterval(() => {
    BrowserCache.cleanExpired();
  }, 600000);
} 