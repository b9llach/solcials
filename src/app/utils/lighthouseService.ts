interface LighthouseUploadResult {
  Name: string;
  Hash: string; // IPFS CID
  Size: string;
}

interface LighthouseUploadResponse {
  data: LighthouseUploadResult;
}

interface FileInfo {
  cid: string;
  fileName: string;
  mimeType?: string;
  txHash?: string;
}

interface UploadedFile {
  publicKey: string;
  fileName: string;
  mimeType: string;
  txHash: string;
  status: string;
}

interface FilecoinDeal {
  dealId: string;
  storageProvider: string;
  status: string;
}

export class LighthouseService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY || '';
    
    // Better debugging for environment variables
    console.log('🔍 Lighthouse Service Initialization:');
    console.log('  - Environment:', process.env.NODE_ENV);
    console.log('  - API Key present:', !!this.apiKey);
    console.log('  - API Key length:', this.apiKey.length);
    
    if (!this.apiKey) {
      console.warn('⚠️ Lighthouse API key not found. Image uploads will fail.');
      console.warn('  Please ensure NEXT_PUBLIC_LIGHTHOUSE_API_KEY is set in your environment variables.');
    }
  }

  // Upload image to Lighthouse (IPFS + Filecoin)
  async uploadImage(file: File): Promise<{ cid: string; ipfsUrl: string; gatewayUrl: string }> {
    if (!this.apiKey) {
      throw new Error('Lighthouse API key not configured. Please add NEXT_PUBLIC_LIGHTHOUSE_API_KEY to your .env.local file.');
    }

    try {
      console.log('📤 Uploading image to Lighthouse Storage:', file.name);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://node.lighthouse.storage/api/v0/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lighthouse API Error:', errorText);
        throw new Error(`Lighthouse upload failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const result = await response.json();
      console.log('📊 Raw Lighthouse response:', result);

      // Handle different possible response formats
      let cid: string;
      
      if (result.data && result.data.Hash) {
        // Expected format: { data: { Hash: "...", Name: "...", Size: "..." } }
        cid = result.data.Hash;
      } else if (result.Hash) {
        // Alternative format: { Hash: "...", Name: "...", Size: "..." }
        cid = result.Hash;
      } else if (result.cid) {
        // Another possible format: { cid: "..." }
        cid = result.cid;
      } else if (typeof result === 'string') {
        // Plain string response
        cid = result;
      } else {
        console.error('Unexpected Lighthouse response format:', result);
        throw new Error(`Unexpected response format from Lighthouse: ${JSON.stringify(result)}`);
      }

      if (!cid) {
        throw new Error('No CID received from Lighthouse');
      }

      console.log('✅ Image uploaded to Lighthouse!');
      console.log('🔗 CID:', cid);
      console.log('📁 File:', file.name);
      console.log('💾 Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

      return {
        cid,
        ipfsUrl: `ipfs://${cid}`,
        gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${cid}`
      };

    } catch (error) {
      console.error('❌ Failed to upload image to Lighthouse:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error('Invalid Lighthouse API key. Please check your NEXT_PUBLIC_LIGHTHOUSE_API_KEY in .env.local');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          throw new Error('Lighthouse API key doesn\'t have upload permissions. Please check your API key.');
        } else if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
      }
      
      throw new Error(`Lighthouse upload failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Upload with progress tracking (for larger files)
  async uploadImageWithProgress(
    file: File, 
    onProgress?: (percentComplete: number) => void
  ): Promise<{ cid: string; ipfsUrl: string; gatewayUrl: string }> {
    if (!this.apiKey) {
      throw new Error('Lighthouse API key not configured');
    }

    try {
      console.log('📤 Uploading image with progress tracking:', file.name);

      // For browser uploads with progress, we'll use a basic implementation
      // In a real app, you'd use the Lighthouse SDK for better progress tracking
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result: LighthouseUploadResponse = JSON.parse(xhr.responseText);
            const cid = result.data.Hash;

            console.log('✅ Image uploaded to Lighthouse with progress!');
            console.log('🔗 CID:', cid);

            resolve({
              cid,
              ipfsUrl: `ipfs://${cid}`,
              gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${cid}`
            });
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', 'https://node.lighthouse.storage/api/v0/add');
        xhr.setRequestHeader('Authorization', `Bearer ${this.apiKey}`);
        xhr.send(formData);
      });

    } catch (error) {
      console.error('❌ Failed to upload image to Lighthouse:', error);
      throw new Error(`Lighthouse upload failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Get file info from Lighthouse
  async getFileInfo(cid: string): Promise<FileInfo | null> {
    try {
      const response = await fetch(`https://api.lighthouse.storage/api/lighthouse/file_info?cid=${cid}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }

      return await response.json() as FileInfo;
    } catch (error) {
      console.error('Failed to get file info:', error);
      return null;
    }
  }

  // Check if image exists on IPFS
  async checkImageExists(cid: string): Promise<boolean> {
    try {
      const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${cid}`, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get user's Lighthouse storage balance
  async getBalance(): Promise<{ dataLimit: string; dataUsed: string }> {
    try {
      const response = await fetch('https://api.lighthouse.storage/api/user/get_balance', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get balance: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        dataLimit: result.dataLimit || '0',
        dataUsed: result.dataUsed || '0'
      };
    } catch (error) {
      console.error('Failed to get Lighthouse balance:', error);
      return { dataLimit: '0', dataUsed: '0' };
    }
  }

  // List user's uploaded files
  async listFiles(page: number = 1): Promise<UploadedFile[]> {
    try {
      const response = await fetch(`https://api.lighthouse.storage/api/user/get_uploads?pageNo=${page}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const result = await response.json();
      return result.uploads || [];
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  // Check Filecoin deal status for permanent storage
  async checkFilecoinDeals(cid: string): Promise<FilecoinDeal[] | null> {
    try {
      const response = await fetch(`https://api.lighthouse.storage/api/lighthouse/get_deals?cid=${cid}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get deals: ${response.statusText}`);
      }

      return await response.json() as FilecoinDeal[];
    } catch (error) {
      console.error('Failed to get Filecoin deals:', error);
      return null;
    }
  }

  // Get upload cost estimate (for display purposes)
  getUploadCostEstimate(fileSizeBytes: number): { estimatedCost: string; description: string } {
    // Lighthouse pricing is very competitive
    // This is just for display - actual cost depends on their pricing tiers
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    
    if (fileSizeMB < 1) {
      return {
        estimatedCost: 'Free',
        description: 'Small files under 1MB are typically free'
      };
    } else if (fileSizeMB < 100) {
      return {
        estimatedCost: '~$0.01',
        description: 'Medium files are very affordable'
      };
    } else {
      return {
        estimatedCost: '~$0.10',
        description: 'Large files with permanent Filecoin storage'
      };
    }
  }

  // Test API key and connection
  async testConnection(): Promise<{ isValid: boolean; message: string }> {
    if (!this.apiKey) {
      return {
        isValid: false,
        message: 'No API key configured. Please add NEXT_PUBLIC_LIGHTHOUSE_API_KEY to your .env.local file.'
      };
    }

    try {
      // Test with a simple API call
      const response = await fetch('https://api.lighthouse.storage/api/user/get_balance', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        return {
          isValid: true,
          message: `✅ Lighthouse API key is valid. Data limit: ${result.dataLimit || 'Unknown'}`
        };
      } else if (response.status === 401) {
        return {
          isValid: false,
          message: '❌ Invalid API key. Please check your NEXT_PUBLIC_LIGHTHOUSE_API_KEY.'
        };
      } else {
        return {
          isValid: false,
          message: `❌ API error: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        isValid: false,
        message: `❌ Connection failed: ${error instanceof Error ? error.message : error}`
      };
    }
  }
}

// Singleton instance
let lighthouseService: LighthouseService | null = null;

export function getLighthouseService(): LighthouseService {
  if (!lighthouseService) {
    lighthouseService = new LighthouseService();
  }
  return lighthouseService;
} 