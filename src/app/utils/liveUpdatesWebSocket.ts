import { SocialPost } from '../types/social';
import { PublicKey } from '@solana/web3.js';
import { getWebSocketEndpoint, getNetworkConfig, getProgramId } from './networkConfig';

export interface WebSocketLiveUpdateOptions {
  onNewPosts: (newPosts: SocialPost[]) => void;
  onError: (error: Error) => void;
  enabled: boolean;
}

interface LogNotificationParams {
  result: {
    value: {
      logs: string[];
      signature: string;
    };
  };
}

interface TransactionInstruction {
  programId: string;
  parsed?: string;
}

interface TransactionData {
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string }>;
      instructions: TransactionInstruction[];
    };
    signatures: string[];
  };
  blockTime?: number;
}

// Program IDs
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export class WebSocketLiveUpdateService {
  private ws: WebSocket | null = null;
  private onNewPosts: (newPosts: SocialPost[]) => void;
  private onError: (error: Error) => void;
  private enabled: boolean = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPostTimestamp: number = 0;
  private subscriptionId: string | null = null;
  private isConnecting = false;

  constructor(options: WebSocketLiveUpdateOptions) {
    this.onNewPosts = options.onNewPosts;
    this.onError = options.onError;
    this.enabled = options.enabled;
    this.lastPostTimestamp = Date.now();
  }

  start() {
    if (!this.enabled || this.ws || this.isConnecting) {
      console.log('🔄 WebSocket start skipped:', { 
        enabled: this.enabled, 
        hasConnection: !!this.ws, 
        isConnecting: this.isConnecting 
      });
      return;
    }

    const wsEndpoint = getWebSocketEndpoint();
    if (!wsEndpoint) {
      console.warn('⚠️ WebSocket endpoint not available, cannot start live updates');
      return;
    }

    const networkConfig = getNetworkConfig();
    console.log(`🚀 Starting WebSocket live updates on ${networkConfig.displayName}...`);
    console.log(`🔗 WebSocket endpoint: ${wsEndpoint.replace(/api-key=[^&]+/, 'api-key=***')}`);
    
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(wsEndpoint);
      
      this.ws.onopen = () => {
        console.log(`✅ WebSocket connected to ${networkConfig.displayName}`);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
        this.subscribeToSolcialsPrograms();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('📴 WebSocket disconnected:', { 
          code: event.code, 
          reason: event.reason, 
          wasClean: event.wasClean,
          enabled: this.enabled,
          reconnectAttempts: this.reconnectAttempts 
        });
        this.isConnecting = false;
        this.ws = null;
        this.subscriptionId = null;
        
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        // Only reconnect if we're still enabled and not intentionally closing
        if (this.enabled && event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error occurred:', {
          error,
          readyState: this.ws?.readyState,
          url: wsEndpoint.replace(/api-key=[^&]+/, 'api-key=***'),
          isConnecting: this.isConnecting,
          enabled: this.enabled
        });
        this.isConnecting = false;
        
        // Call the onError callback if provided
        if (this.onError) {
          this.onError(new Error('WebSocket connection failed'));
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error('WebSocket creation failed'));
      }
    }
  }

  stop() {
    console.log('⏹️ Stopping WebSocket live updates...', {
      enabled: this.enabled,
      hasConnection: !!this.ws,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts
    });
    
    this.enabled = false;
    this.isConnecting = false;
    
    // Clear any pending reconnection attempts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      console.log('🧹 Cleared reconnect timeout');
    }
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.log('🧹 Cleared ping interval');
    }

    // Close WebSocket connection cleanly
    if (this.ws) {
      const currentState = this.ws.readyState;
      console.log('🔌 Closing WebSocket connection, state:', {
        readyState: currentState,
        CONNECTING: WebSocket.CONNECTING,
        OPEN: WebSocket.OPEN,
        CLOSING: WebSocket.CLOSING,
        CLOSED: WebSocket.CLOSED
      });
      
      try {
        // Only close if not already closed/closing
        if (currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'Service stopped');
          console.log('✅ WebSocket close() called');
        } else {
          console.log('ℹ️ WebSocket already closing/closed, skipping close()');
        }
      } catch (error) {
        console.warn('⚠️ Error closing WebSocket:', error);
      }
      
      this.ws = null;
    }

    this.subscriptionId = null;
    this.reconnectAttempts = 0;
    console.log('🧹 WebSocket service cleanup completed');
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.enabled) {
        this.start();
      }
    }, delay);
  }

  private startPing() {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a ping request
        const pingRequest = {
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 1000000),
          method: "getHealth"
        };
        this.ws.send(JSON.stringify(pingRequest));
      }
    }, 30000);
  }

  private subscribeToSolcialsPrograms() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const programId = getProgramId();
    
    try {
      const subscribeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'programSubscribe',
        params: [
          programId,
          {
            encoding: 'jsonParsed',
            filters: [],
            commitment: 'confirmed'
          }
        ]
      };

      console.log(`📡 Subscribing to Solcials program: ${programId}`);
      this.ws.send(JSON.stringify(subscribeMessage));
      
    } catch (error) {
      console.error('Failed to subscribe to program:', error);
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);

      // Handle subscription confirmation
      if (message.result && typeof message.result === 'number') {
        this.subscriptionId = message.result.toString();
        console.log(`✅ Subscribed to logs with ID: ${this.subscriptionId}`);
        return;
      }

      // Handle log notifications
      if (message.method === 'logsNotification' && message.params) {
        this.handleLogNotification(message.params as LogNotificationParams);
      }

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private async handleLogNotification(params: LogNotificationParams) {
    try {
      const { result } = params;
      const { logs, signature } = result.value;
      
      // Check if this is a Solcials post by looking for our app identifier in logs
      const isSolcialsPost = logs.some((log: string) => 
        log.includes('Solcials:') || 
        log.includes('"app":"solcials"') ||
        log.includes('solcials') ||
        log.includes('Text post created') ||         // Your custom program logs
        log.includes('Image post created') ||        // Your custom program logs
        log.includes('Instruction: CreateTextPost') || // Your custom program logs
        log.includes('Instruction: CreateImagePost')   // Your custom program logs
      );

      if (!isSolcialsPost) {
        return; // Not our app's transaction
      }

      // Get the transaction details to extract the post content
      const transactionDetails = await this.getTransactionDetails(signature);
      
      if (transactionDetails) {
        const post = this.parseTransactionToPost(transactionDetails);
        
        if (post && post.timestamp > this.lastPostTimestamp) {
          console.log('📢 New post detected via WebSocket!', post);
          this.lastPostTimestamp = post.timestamp;
          this.onNewPosts([post]);
          
          // Show browser notification
          this.showBrowserNotification(1);
        }
      }

    } catch (error) {
      console.warn('Error handling log notification:', error);
    }
  }

  private async getTransactionDetails(signature: string): Promise<TransactionData | null> {
    try {
      const networkConfig = getNetworkConfig();
      
      const response = await fetch(networkConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            signature,
            {
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0
            }
          ]
        })
      });

      const data = await response.json();
      return data.result as TransactionData;
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return null;
    }
  }

  private parseTransactionToPost(transaction: TransactionData): SocialPost | null {
    try {
      // Extract instruction data - could be from memo program or custom program
      const instructions = transaction.transaction.message.instructions;
      
      // First, try to find memo instruction (current implementation)
      const memoInstruction = instructions.find((ix: TransactionInstruction) => 
        ix.programId === MEMO_PROGRAM_ID
      );

      // Then, try to find custom Solcials program instruction (future implementation)
      const solcialsInstruction = instructions.find((ix: TransactionInstruction) => 
        ix.programId === getProgramId()
      );

      let postData: { app?: string; content?: string; imageHash?: string; imageUrl?: string; imageSize?: number };

      if (solcialsInstruction) {
        // TODO: Parse custom program instruction data
        // This would involve deserializing the account data from your Post struct
        console.log('🎯 Custom Solcials program instruction detected - implement parsing');
        return null; // For now, until we implement custom program parsing
      } else if (memoInstruction && memoInstruction.parsed) {
        // Parse memo instruction (current implementation)
        const memoData = memoInstruction.parsed;

        try {
          postData = JSON.parse(memoData);
        } catch {
          // If not JSON, treat as plain text
          postData = { content: memoData };
        }

        // Verify it's a Solcials post
        if (!postData.app || postData.app !== 'solcials') {
          return null;
        }
      } else {
        return null;
      }

      // Extract author from transaction
      const authorPubkey = transaction.transaction.message.accountKeys[0].pubkey;

      const post: SocialPost = {
        id: `${authorPubkey}_${transaction.blockTime || Date.now()}`,
        author: new PublicKey(authorPubkey),
        content: postData.content || '',
        timestamp: (transaction.blockTime || Date.now()) * 1000,
        signature: transaction.transaction.signatures[0],
        // Handle image data if present
        ...(postData.imageHash && {
          imageHash: postData.imageHash,
          imageUrl: postData.imageUrl,
          imageSize: postData.imageSize
        })
      };

      return post;
    } catch (error) {
      console.error('Error parsing transaction to post:', error);
      return null;
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

// Utility function to create a WebSocket live update service
export function createWebSocketLiveUpdateService(
  onNewPosts: (posts: SocialPost[]) => void
): WebSocketLiveUpdateService {
  return new WebSocketLiveUpdateService({
    onNewPosts,
    onError: (error) => {
      console.error('WebSocket live update error:', error);
    },
    enabled: true
  });
} 