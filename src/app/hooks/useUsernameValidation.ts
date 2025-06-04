import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { getNetworkConfig } from '../utils/networkConfig';

interface UsernameValidationState {
  username: string;
  isChecking: boolean;
  lastCheckResult: { available: boolean; message: string } | null;
  error: string | null;
}

export function useUsernameValidation(initialUsername: string = '') {
  const { publicKey } = useWallet();
  const [state, setState] = useState<UsernameValidationState>({
    username: initialUsername,
    isChecking: false,
    lastCheckResult: null,
    error: null
  });

  // Manual username checking (only called when needed)
  const checkUsername = useCallback(async (username: string): Promise<{ available: boolean; message: string }> => {
    if (!username || username.trim() === '') {
      return { available: true, message: 'No username provided' };
    }

    setState(prev => ({
      ...prev,
      isChecking: true,
      error: null
    }));

    try {
      const networkConfig = getNetworkConfig();
      const connection = new Connection(networkConfig.endpoint);
      const solcialsProgram = new SolcialsCustomProgramService(connection);
      
      const result = await solcialsProgram.isUsernameAvailable(username, publicKey || undefined);
      
      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheckResult: result,
        error: null
      }));

      return result;
    } catch (error) {
      console.error('Username validation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check username availability';
      
      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheckResult: null,
        error: errorMessage
      }));

      throw new Error(errorMessage);
    }
  }, [publicKey]);

  // Update username (no automatic validation)
  const setUsername = useCallback((username: string) => {
    setState(prev => ({
      ...prev,
      username,
      lastCheckResult: null,
      error: null
    }));
  }, []);

  // Basic client-side validation (for immediate feedback)
  const getBasicValidation = useCallback((username: string) => {
    if (!username) return { isValid: true, message: '' };
    
    if (username.length < 3) return { isValid: false, message: 'Username must be at least 3 characters' };
    if (username.length > 50) return { isValid: false, message: 'Username cannot be longer than 50 characters' };
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return { isValid: false, message: 'Username can only contain letters, numbers, and underscores' };
    
    const reserved = ['admin', 'root', 'user', 'null', 'undefined', 'solcials', 'solana', 'about', 'help', 'support', 'api', 'www', 'mail', 'ftp', 'localhost', 'test'];
    if (reserved.includes(username.toLowerCase())) return { isValid: false, message: 'This username is reserved' };
    
    return { isValid: true, message: '' };
  }, []);

  return {
    username: state.username,
    setUsername,
    isChecking: state.isChecking,
    checkUsername, // Manual check function
    getBasicValidation, // Client-side validation
    lastCheckResult: state.lastCheckResult,
    error: state.error
  };
} 