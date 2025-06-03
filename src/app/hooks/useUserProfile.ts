import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';

interface UserProfile {
  user: string;
  username?: string;
  displayName?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  followersCount: number;
  followingCount: number;
  postCount: number;
  createdAt: number;
  verified: boolean;
  lastUpdated: number; // For cache invalidation
}

const PROFILE_CACHE_KEY = 'solcials_user_profile';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function useUserProfile() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile from cache or fetch from blockchain
  useEffect(() => {
    if (!connected || !publicKey) {
      setProfile(null);
      setError(null);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load from cache first
        const cachedProfile = getCachedProfile(publicKey.toString());
        if (cachedProfile && !isCacheExpired(cachedProfile)) {
          console.log('📦 Using cached profile data');
          setProfile(cachedProfile);
          setLoading(false);
          return;
        }

        // Fetch from blockchain
        console.log('🔄 Fetching profile from blockchain...');
        const solcialsProgram = new SolcialsCustomProgramService(connection);
        
        // Get actual post count
        const allPosts = await solcialsProgram.getPosts(100);
        const userPosts = allPosts.filter(post => post.author.equals(publicKey));
        const userPostCount = userPosts.length;

        // Try to get user profile
        const userProfile = await solcialsProgram.getUserProfile(publicKey);
        
        let profileData: UserProfile;
        
        if (userProfile) {
          profileData = {
            user: userProfile.user.toString(),
            username: userProfile.username ?? undefined,
            displayName: userProfile.displayName ?? undefined,
            bio: userProfile.bio ?? undefined,
            websiteUrl: userProfile.websiteUrl ?? undefined,
            location: userProfile.location ?? undefined,
            followersCount: Number(userProfile.followersCount),
            followingCount: Number(userProfile.followingCount),
            postCount: userPostCount,
            createdAt: Number(userProfile.createdAt),
            verified: userProfile.verified,
            lastUpdated: Date.now()
          };
        } else {
          // Create default profile
          profileData = {
            user: publicKey.toString(),
            username: undefined,
            displayName: undefined,
            bio: undefined,
            websiteUrl: undefined,
            location: undefined,
            followersCount: 0,
            followingCount: 0,
            postCount: userPostCount,
            createdAt: Date.now(),
            verified: false,
            lastUpdated: Date.now()
          };
        }

        // Cache the profile
        setCachedProfile(publicKey.toString(), profileData);
        setProfile(profileData);
        
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile');
        
        // Try to use cached data even if expired as fallback
        const cachedProfile = getCachedProfile(publicKey.toString());
        if (cachedProfile) {
          console.log('📦 Using expired cached profile as fallback');
          setProfile(cachedProfile);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [connected, publicKey, connection]);

  // Update profile in both state and cache
  const updateProfile = (updatedData: Partial<UserProfile>) => {
    if (!profile || !publicKey) return;

    const newProfile = {
      ...profile,
      ...updatedData,
      lastUpdated: Date.now()
    };

    setProfile(newProfile);
    setCachedProfile(publicKey.toString(), newProfile);
  };

  // Clear cache (useful when profile is updated on blockchain)
  const clearCache = () => {
    if (!publicKey) return;
    
    localStorage.removeItem(`${PROFILE_CACHE_KEY}_${publicKey.toString()}`);
  };

  // Get display name for current user
  const getDisplayName = (): string => {
    if (!profile || !publicKey) {
      return publicKey ? formatAddress(publicKey.toString()) : 'Anonymous';
    }
    
    return profile.displayName || profile.username || formatAddress(profile.user);
  };

  // Get username handle
  const getUsername = (): string | null => {
    return profile?.username || null;
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    clearCache,
    getDisplayName,
    getUsername,
    isLoggedIn: connected && !!publicKey
  };
}

// Helper functions for localStorage management
function getCachedProfile(userKey: string): UserProfile | null {
  try {
    const cached = localStorage.getItem(`${PROFILE_CACHE_KEY}_${userKey}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(userKey: string, profile: UserProfile): void {
  try {
    localStorage.setItem(`${PROFILE_CACHE_KEY}_${userKey}`, JSON.stringify(profile));
  } catch (error) {
    console.warn('Failed to cache profile:', error);
  }
}

function isCacheExpired(profile: UserProfile): boolean {
  return Date.now() - profile.lastUpdated > CACHE_EXPIRY_MS;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
} 