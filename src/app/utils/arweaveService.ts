import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';

interface ArweaveUploadResult {
  transactionId: string;
  permanentUrl: string;
}

export class ArweaveService {
  private arweave: Arweave;
  private wallet: JWKInterface | null = null; // Properly typed Arweave wallet key

  constructor() {
    // Initialize Arweave for mainnet (you can change to testnet for development)
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https'
    });
  }

  // Generate or load Arweave wallet
  async initializeWallet(): Promise<void> {
    try {
      // Try to load existing wallet from localStorage
      const storedWallet = localStorage.getItem('arweave_wallet');
      
      if (storedWallet) {
        this.wallet = JSON.parse(storedWallet);
        console.log('📝 Loaded existing Arweave wallet');
      } else {
        // Generate new wallet for first-time users
        this.wallet = await this.arweave.wallets.generate();
        localStorage.setItem('arweave_wallet', JSON.stringify(this.wallet));
        console.log('🔑 Generated new Arweave wallet');
        
        const address = await this.arweave.wallets.jwkToAddress(this.wallet);
        console.log('💳 Arweave wallet address:', address);
        console.log('💰 Fund this wallet by purchasing AR tokens from exchanges or using the Arweave ecosystem');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Arweave wallet:', error);
      throw error;
    }
  }

  // Upload image file to Arweave (adapted from cookbook)
  async uploadImage(file: File): Promise<ArweaveUploadResult> {
    if (!this.wallet) {
      await this.initializeWallet();
    }

    if (!this.wallet) {
      throw new Error('Failed to initialize Arweave wallet');
    }

    try {
      console.log('📤 Uploading image to Arweave:', file.name);

      // Convert File to ArrayBuffer (browser adaptation)
      const imageData = await file.arrayBuffer();

      // Create data transaction (from cookbook)
      const transaction = await this.arweave.createTransaction({
        data: imageData
      }, this.wallet);

      // Add tags for proper browser serving (from cookbook)
      transaction.addTag('Content-Type', file.type);
      transaction.addTag('App-Name', 'Solcials');
      transaction.addTag('App-Version', '1.0');
      transaction.addTag('File-Name', file.name);
      transaction.addTag('File-Size', file.size.toString());
      transaction.addTag('Upload-Timestamp', Date.now().toString());

      // Sign the transaction (from cookbook)
      await this.arweave.transactions.sign(transaction, this.wallet);

      // Create uploader and upload chunks (from cookbook)
      const uploader = await this.arweave.transactions.getUploader(transaction);

      // Upload with progress tracking
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
        const progress = Math.round((uploader.uploadedChunks / uploader.totalChunks) * 100);
        console.log(`📊 Upload progress: ${progress}%`);
      }

      const transactionId = transaction.id;
      const permanentUrl = `https://arweave.net/${transactionId}`;

      console.log('✅ Image uploaded to Arweave!');
      console.log('🔗 Transaction ID:', transactionId);
      console.log('🌐 Permanent URL:', permanentUrl);

      return {
        transactionId,
        permanentUrl
      };

    } catch (error) {
      console.error('❌ Failed to upload image to Arweave:', error);
      throw new Error(`Arweave upload failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Get wallet balance
  async getBalance(): Promise<string> {
    if (!this.wallet) {
      await this.initializeWallet();
    }

    if (!this.wallet) {
      throw new Error('Failed to initialize Arweave wallet');
    }

    try {
      const address = await this.arweave.wallets.jwkToAddress(this.wallet);
      const balance = await this.arweave.wallets.getBalance(address);
      const arBalance = this.arweave.ar.winstonToAr(balance);
      return arBalance;
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return '0';
    }
  }

  // Get wallet address
  async getWalletAddress(): Promise<string> {
    if (!this.wallet) {
      await this.initializeWallet();
    }

    if (!this.wallet) {
      throw new Error('Failed to initialize Arweave wallet');
    }
    
    return await this.arweave.wallets.jwkToAddress(this.wallet);
  }

  // Check if image exists on Arweave
  async checkImageExists(transactionId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://arweave.net/${transactionId}`, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get current upload cost
  async getUploadCost(file: File): Promise<{ cost: string; costAR: string }> {
    try {
      const imageData = await file.arrayBuffer();
      const cost = await this.arweave.transactions.getPrice(imageData.byteLength);
      const costAR = this.arweave.ar.winstonToAr(cost);
      
      return {
        cost: cost,
        costAR: costAR
      };
    } catch (error) {
      console.error('Failed to get upload cost:', error);
      return { cost: '0', costAR: '0' };
    }
  }

  // Check if user has sufficient balance for upload
  async hasSpufficientBalance(file: File): Promise<{ sufficient: boolean; required: string; current: string }> {
    try {
      const [balance, cost] = await Promise.all([
        this.getBalance(),
        this.getUploadCost(file)
      ]);

      const balanceNum = parseFloat(balance);
      const costNum = parseFloat(cost.costAR);
      
      return {
        sufficient: balanceNum >= costNum,
        required: cost.costAR,
        current: balance
      };
    } catch (error) {
      console.error('Failed to check balance:', error);
      return { sufficient: false, required: '0', current: '0' };
    }
  }
}

// Singleton instance
let arweaveService: ArweaveService | null = null;

export function getArweaveService(): ArweaveService {
  if (!arweaveService) {
    arweaveService = new ArweaveService();
  }
  return arweaveService;
} 