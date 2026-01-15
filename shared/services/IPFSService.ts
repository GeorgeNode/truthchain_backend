/**
 * IPFS Service using Pinata Cloud
 * Handles file uploads to IPFS via Pinata API
 * Documentation: https://docs.pinata.cloud/
 */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

export interface IPFSUploadResult {
  cid: string;
  gateway: string;
  size: number;
  url: string;
  pinataUrl?: string;
}

export interface IPFSConfig {
  apiKey: string;
  apiSecret: string;
  jwt?: string; // Pinata JWT (newer auth method)
  gateway?: string;
}

export interface IPFSContent {
  content: string;
  metadata?: {
    originalUrl?: string;
    author?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

export class IPFSService {
  private apiKey: string;
  private apiSecret: string;
  private jwt?: string;
  private gateway: string;
  private pinataApiUrl = 'https://api.pinata.cloud';

  constructor(config: IPFSConfig) {
    if (!config.apiKey && !config.jwt) {
      throw new Error('Pinata API credentials are required (apiKey/apiSecret or JWT)');
    }

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.jwt = config.jwt;
    this.gateway = config.gateway || 'https://gateway.pinata.cloud/ipfs';
  }

  /**
   * Get authorization headers for Pinata API
   */
  private getAuthHeaders(): Record<string, string> {
    if (this.jwt) {
      return {
        'Authorization': `Bearer ${this.jwt}`
      };
    }
    return {
      'pinata_api_key': this.apiKey,
      'pinata_secret_api_key': this.apiSecret
    };
  }

  /**
   * Store content on IPFS via Pinata
   */
  async storeContent(
    content: string | Buffer,
    filename: string = 'content.json'
  ): Promise<IPFSUploadResult> {
    try {
      const formData = new FormData();

      // Convert content to stream
      let stream: Readable;
      if (typeof content === 'string') {
        stream = Readable.from(Buffer.from(content, 'utf-8'));
      } else {
        stream = Readable.from(content);
      }

      // Add file to form data
      formData.append('file', stream, {
        filename,
        contentType: filename.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      });

      // Add metadata
      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          type: 'truthchain-content',
          timestamp: new Date().toISOString()
        }
      });
      formData.append('pinataMetadata', metadata);

      // Add pin options
      const pinataOptions = JSON.stringify({
        cidVersion: 1
      });
      formData.append('pinataOptions', pinataOptions);

      // Upload to Pinata
      const response = await axios.post(
        `${this.pinataApiUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(),
            ...formData.getHeaders()
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      const { IpfsHash, PinSize } = response.data;
      const cid = IpfsHash;
      const size = PinSize || 0;
      const url = `${this.gateway}/${cid}`;
      const pinataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

      console.log(`✅ Content stored on IPFS via Pinata: ${cid}`);

      return {
        cid,
        gateway: this.gateway,
        size,
        url,
        pinataUrl
      };

    } catch (error) {
      console.error('Error storing content on IPFS via Pinata:', error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        throw new Error(`Pinata API error: ${axiosError.response?.data?.error || axiosError.message}`);
      }
      throw new Error(`Failed to store content on IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store JSON data on IPFS
   */
  async storeJSON(data: any, filename: string = 'data.json'): Promise<IPFSUploadResult> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      return await this.storeContent(jsonString, filename);
    } catch (error) {
      console.error('Error storing JSON on IPFS:', error);
      throw error;
    }
  }

  /**
   * Store tweet/content data with metadata on IPFS
   */
  async storeTweetContent(contentData: IPFSContent): Promise<IPFSUploadResult> {
    try {
      const data = {
        content: contentData.content,
        metadata: {
          ...contentData.metadata,
          storedAt: new Date().toISOString(),
          platform: 'truthchain'
        }
      };

      return await this.storeJSON(data, 'content.json');
    } catch (error) {
      console.error('Error storing content on IPFS:', error);
      throw error;
    }
  }

  /**
   * Retrieve content from IPFS
   */
  async retrieveContent(cid: string): Promise<string> {
    try {
      const url = `${this.gateway}/${cid}`;
      const response = await axios.get(url, {
        timeout: 10000 // 10 second timeout
      });

      if (typeof response.data === 'object') {
        return JSON.stringify(response.data);
      }
      return response.data;
    } catch (error) {
      console.error('Error retrieving content from IPFS:', error);
      throw new Error(`Failed to retrieve content from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve JSON data from IPFS
   */
  async retrieveJSON(cid: string): Promise<any> {
    try {
      const content = await this.retrieveContent(cid);
      return JSON.parse(content);
    } catch (error) {
      console.error('Error retrieving JSON from IPFS:', error);
      throw error;
    }
  }

  /**
   * Check if CID is valid
   */
  isValidCID(cid: string): boolean {
    // Basic CID validation (CIDv0 starts with Qm, CIDv1 starts with ba)
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58})/.test(cid);
  }

  /**
   * Get gateway URL for a CID
   */
  getGatewayURL(cid: string): string {
    return `${this.gateway}/${cid}`;
  }

  /**
   * Get multiple gateway URLs for redundancy
   */
  getGatewayURLs(cid: string): string[] {
    const gateways = [
      'https://gateway.pinata.cloud/ipfs',
      'https://ipfs.io/ipfs',
      'https://dweb.link/ipfs',
      'https://cloudflare-ipfs.com/ipfs'
    ];

    return gateways.map(gateway => `${gateway}/${cid}`);
  }

  /**
   * Test Pinata authentication
   */
  async testAuthentication(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.pinataApiUrl}/data/testAuthentication`,
        {
          headers: this.getAuthHeaders()
        }
      );
      return response.data.message === 'Congratulations! You are communicating with the Pinata API!';
    } catch (error) {
      console.error('Pinata authentication test failed:', error);
      return false;
    }
  }

  /**
   * Get pinned files list (for monitoring)
   */
  async getPinnedFiles(limit: number = 10): Promise<any> {
    try {
      const response = await axios.get(
        `${this.pinataApiUrl}/data/pinList`,
        {
          headers: this.getAuthHeaders(),
          params: {
            status: 'pinned',
            pageLimit: limit
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting pinned files:', error);
      throw error;
    }
  }

  /**
   * Unpin a file from Pinata
   */
  async unpinFile(cid: string): Promise<boolean> {
    try {
      await axios.delete(
        `${this.pinataApiUrl}/pinning/unpin/${cid}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      console.log(`✅ Unpinned file: ${cid}`);
      return true;
    } catch (error) {
      console.error('Error unpinning file:', error);
      return false;
    }
  }

  /**
   * Check storage status
   */
  async getStorageStatus(): Promise<any> {
    try {
      const isAuthenticated = await this.testAuthentication();

      return {
        provider: 'Pinata',
        gateway: this.gateway,
        available: isAuthenticated,
        authenticated: isAuthenticated
      };
    } catch (error) {
      console.error('Error getting storage status:', error);
      return {
        provider: 'Pinata',
        gateway: this.gateway,
        available: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
