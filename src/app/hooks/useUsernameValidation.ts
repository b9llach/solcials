import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { getNetworkConfig } from '../utils/networkConfig';

interface UsernameValidationState {
  username: string;
  isChecking: boolean;
  isAvailable: boolean | null;
  message: string;
  error: string | null;
}

export function useUsernameValidation(initialUsername: string = '') {
  const { publicKey } = useWallet();
  const [state, setState] = useState<UsernameValidationState>({
    username: initialUsername,
    isChecking: false,
    isAvailable: null,
    message: '',
    error: null
  });

  // Debounced username checking
  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.trim() === '') {
      setState(prev => ({
        ...prev,
        isChecking: false,
        isAvailable: null,
        message: '',
        error: null
      }));
      return;
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
        isAvailable: result.available,
        message: result.message,
        error: null
      }));
    } catch (error) {
      console.error('Username validation error:', error);
      setState(prev => ({
        ...prev,
        isChecking: false,
        isAvailable: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to check username availability'
      }));
    }
  }, [publicKey]);

  // Debounce username checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (state.username && state.username.trim() !== '') {
        checkUsername(state.username);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [state.username, checkUsername]);

  // Update username and trigger validation
  const setUsername = useCallback((username: string) => {
    setState(prev => ({
      ...prev,
      username,
      isAvailable: null,
      message: '',
      error: null
    }));
  }, []);

  // Force re-check current username
  const recheckUsername = useCallback(() => {
    if (state.username) {
      checkUsername(state.username);
    }
  }, [state.username, checkUsername]);

  // Get validation status for UI
  const getValidationStatus = useCallback(() => {
    if (state.error) {
      return { status: 'error' as const, message: state.error };
    }
    
    if (state.isChecking) {
      return { status: 'checking' as const, message: 'Checking availability...' };
    }
    
    if (state.isAvailable === true) {
      return { status: 'available' as const, message: state.message };
    }
    
    if (state.isAvailable === false) {
      return { status: 'unavailable' as const, message: state.message };
    }
    
    return { status: 'idle' as const, message: '' };
  }, [state]);

  return {
    username: state.username,
    setUsername,
    isChecking: state.isChecking,
    isAvailable: state.isAvailable,
    message: state.message,
    error: state.error,
    recheckUsername,
    getValidationStatus,
    // Helper computed properties
    canSave: state.isAvailable === true && !state.isChecking,
    showSpinner: state.isChecking,
    hasError: !!state.error || state.isAvailable === false
  };
} 