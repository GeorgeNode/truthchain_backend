/**
 * BNS Validation Service
 * Validates BNS ownership and detects transfers
 */

import { Registration } from '../../../shared/models/Registration';

export interface BNSValidationResult {
  isValid: boolean;
  currentNames: string[];  // Current BNS names owned by wallet
  hasOriginalBNS: boolean;  // Does wallet still own the original BNS?
  status: 'valid' | 'transferred' | 'no-longer-owned';
  newOwner?: string;  // If transferred, who owns it now?
}

export class BNSValidationService {
  private readonly hiroApiUrl: string;
  private readonly apiKey?: string;
  
  constructor(hiroApiUrl: string = 'https://api.mainnet.hiro.so', apiKey?: string) {
    this.hiroApiUrl = hiroApiUrl;
    this.apiKey = apiKey;
  }

  /**
   * Fetch BNS names owned by a wallet address
   */
  async fetchWalletBNSNames(walletAddress: string): Promise<string[]> {
    try {
      const url = `${this.hiroApiUrl}/v1/addresses/stacks/${walletAddress}/names`;
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        console.warn(`⚠️ BNS API returned ${response.status} for ${walletAddress}`);
        return [];
      }
      
      const data = await response.json() as { names?: string[] };
      
      // Response format: { names: ["alice.btc", "bob.btc"] }
      return data.names || [];
    } catch (error) {
      console.error('❌ Failed to fetch BNS names:', error);
      return [];
    }
  }

  /**
   * Validate a single registration's BNS ownership
   */
  async validateRegistration(
    originalBNS: string,
    walletAddress: string
  ): Promise<BNSValidationResult> {
    const currentNames = await this.fetchWalletBNSNames(walletAddress);
    const hasOriginalBNS = currentNames.includes(originalBNS);
    
    if (hasOriginalBNS) {
      return {
        isValid: true,
        currentNames,
        hasOriginalBNS: true,
        status: 'valid'
      };
    }
    
    // BNS not owned anymore
    // TODO: Could query who owns it now (more API calls)
    if (currentNames.length > 0) {
      return {
        isValid: false,
        currentNames,
        hasOriginalBNS: false,
        status: 'transferred'
      };
    }
    
    return {
      isValid: false,
      currentNames: [],
      hasOriginalBNS: false,
      status: 'no-longer-owned'
    };
  }

  /**
   * Validate all registrations that need checking
   * Returns count of validated registrations
   */
  async validateStaleRegistrations(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    
    // Find registrations that haven't been validated recently
    const staleRegistrations = await Registration.find({
      bnsName: { $exists: true, $ne: null },
      $or: [
        { lastBnsValidation: { $lt: cutoffDate } },
        { lastBnsValidation: { $exists: false } }
      ]
    }).limit(100); // Process in batches
    
    let validatedCount = 0;
    
    for (const registration of staleRegistrations) {
      try {
        const result = await this.validateRegistration(
          registration.bnsName!,
          registration.authorWallet
        );
        
        await Registration.findByIdAndUpdate(registration._id, {
          $set: {
            lastBnsValidation: new Date(),
            bnsStatus: result.status,
            ...(result.status === 'transferred' && {
              bnsTransferredAt: new Date(),
              currentBnsOwner: result.currentNames[0] || null
            })
          }
        });
        
        validatedCount++;
        
        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to validate registration ${registration._id}:`, error);
      }
    }
    
    console.log(`✅ Validated ${validatedCount} registrations`);
    return validatedCount;
  }

  /**
   * Get validation status for a specific content hash
   */
  async getValidationStatus(contentHash: string): Promise<{
    originalBNS: string;
    status: string;
    lastChecked?: Date;
  } | null> {
    const registration = await Registration.findOne({ contentHash });
    
    if (!registration || !registration.bnsName) {
      return null;
    }
    
    return {
      originalBNS: registration.bnsName,
      status: registration.bnsStatus || 'unknown',
      lastChecked: registration.lastBnsValidation
    };
  }
}

// Export singleton instance
export const bnsValidationService = new BNSValidationService(
  process.env.HIRO_API_URL || 'https://api.mainnet.hiro.so',
  process.env.HIRO_API_KEY
);
