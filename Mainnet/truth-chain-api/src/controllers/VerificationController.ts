import { Request, Response } from 'express';
import { HashService } from '../services/HashService';
import { BlockchainService } from '../services/BlockchainService';
import { Registration } from '../../shared/models/Registration';
import { VerificationCache } from '../../shared/models/VerificationCache';
import { bnsValidationService } from '../services/BNSValidationService';

export interface VerifyTweetRequest {
  tweetContent?: string;
  hash?: string;
}

export interface VerifyTweetResponse {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    hash: string;
    author: string;
    registeredAt: string;
    blockHeight: number;
    registrationId: number;
    txId?: string;
    // Rich metadata from database (when implemented)
    tweetUrl?: string;
    twitterHandle?: string;
    fullText?: string;
  };
  error?: string;
}

export class VerificationController {
  private blockchainService: BlockchainService;

  constructor(blockchainService: BlockchainService) {
    this.blockchainService = blockchainService;
  }

  /**
   * Verify tweet content or hash (with MongoDB cache)
   * POST /api/verify
   */
  async verifyTweet(req: Request, res: Response): Promise<Response<VerifyTweetResponse>> {
    try {
      const { tweetContent, hash }: VerifyTweetRequest = req.body;

      // Must provide either content or hash
      if (!tweetContent && !hash) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: 'Either tweet content or hash is required',
          error: 'Missing required fields'
        });
      }

      let hashHex: string;

      if (tweetContent) {
        // Generate hash from content
        hashHex = HashService.generateContentHashHex(tweetContent);
      } else {
        // Use provided hash
        hashHex = hash!;
      }

      // Step 1: Check cache first (FAST - <10ms)
      const cached = await VerificationCache.findOne({
        contentHash: hashHex,
        expiresAt: { $gt: new Date() }
      });

      if (cached) {
        // Validate cache structure to prevent undefined access errors
        if (!cached.result || typeof cached.result.isRegistered !== 'boolean') {
          console.warn('⚠️  Corrupted cache entry detected, clearing:', hashHex);
          await VerificationCache.deleteOne({ contentHash: hashHex });
          // Fall through to database/blockchain check
        } else if (cached.result.isRegistered) {
          // Only use cache for POSITIVE results (registered content)
          // Negative results should re-check blockchain in case it was registered directly
          console.log('✅ Verification served from cache (positive result)');

          // Update analytics if registration exists
          await Registration.findOneAndUpdate(
            { contentHash: hashHex },
            {
              $inc: { 'analytics.verifications': 1 },
              $set: { 'analytics.lastVerified': new Date() }
            }
          );

          return res.json({
            success: true,
            verified: true,
            message: 'Content verified (cached)',
            data: {
              hash: hashHex,
              author: cached.result.authorWallet,
              bnsName: cached.result.bnsName,  // Include BNS name from cache
              bnsStatus: cached.result.bnsStatus || 'valid',  // Include BNS status
              registeredAt: cached.result.registrationDate?.toISOString(),
              blockHeight: cached.result.blockHeight,
              txId: cached.result.txId
            }
          });
        } else {
          // Negative cache result - skip cache and check database/blockchain
          // This handles cases where content was registered on-chain but not in MongoDB
          console.log('ℹ️  Cached negative result - re-checking database and blockchain');
          await VerificationCache.deleteOne({ contentHash: hashHex });
          // Fall through to database/blockchain check
        }
      }

      // Step 2: Check MongoDB registration (MEDIUM - ~50ms)
      // Include BOTH confirmed AND pending registrations for badge display
      const registration = await Registration.findOne({
        contentHash: hashHex,
        'blockchain.status': { $in: ['confirmed', 'pending'] }  // Show badge for pending too
      });

      if (registration) {
        console.log('✅ Verification found in database');

        // Update cache with proper schema structure
        await VerificationCache.findOneAndUpdate(
          { contentHash: hashHex },
          {
            $set: {
              result: {
                isRegistered: true,
                authorWallet: registration.authorWallet,
                bnsName: registration.bnsName,  // Include BNS name in cache
                bnsStatus: registration.bnsStatus || 'valid',  // Include BNS status
                blockHeight: registration.blockchain.blockHeight || 0,
                registrationDate: registration.blockchain.timestamp || new Date(),
                txId: registration.blockchain.txId || ''
              },
              expiresAt: new Date(Date.now() + 3600000), // 1 hour cache
              lastAccessed: new Date()
            },
            $inc: { hits: 1 }
          },
          { upsert: true }
        );

        // Update analytics
        await Registration.findByIdAndUpdate(registration._id, {
          $inc: { 'analytics.verifications': 1 },
          $set: { 'analytics.lastVerified': new Date() }
        });

        return res.json({
          success: true,
          verified: true,
          message: 'Content verified successfully',
          data: {
            hash: hashHex,
            author: registration.authorWallet,
            bnsName: registration.bnsName,  // Full BNS name (e.g., "henryno.btc")
            bnsStatus: registration.bnsStatus || 'valid',  // BNS validation status
            lastBnsValidation: registration.lastBnsValidation,
            registeredAt: (registration.blockchain.timestamp || registration.createdAt).toISOString(),
            blockHeight: registration.blockchain.blockHeight || 0,
            registrationId: registration.blockchain.registrationId || 0,
            txId: registration.blockchain.txId || '',
            tweetUrl: registration.content.url,
            twitterHandle: registration.content.twitterHandle
          }
        });
      }

      // Step 3: Fallback to blockchain (SLOW - ~10s)
      console.log('⚠️  Cache miss - querying blockchain');
      const contentHash = tweetContent
        ? HashService.generateContentHash(tweetContent)
        : HashService.hexToBuffer(hash!);

      const verification = await this.blockchainService.verifyTweet(contentHash);

      if (!verification) {
        // Cache negative result with proper schema structure
        await VerificationCache.findOneAndUpdate(
          { contentHash: hashHex },
          {
            $set: {
              result: {
                isRegistered: false
              },
              expiresAt: new Date(Date.now() + 3600000), // 1 hour
              lastAccessed: new Date()
            },
            $inc: { hits: 1 }
          },
          { upsert: true }
        );

        return res.json({
          success: true,
          verified: false,
          message: 'Content not found on blockchain'
        });
      }

      // Cache positive result with proper schema structure
      await VerificationCache.findOneAndUpdate(
        { contentHash: hashHex },
        {
          $set: {
            result: {
              isRegistered: true,
              authorWallet: verification.author,
              bnsName: verification.bnsName,  // Include BNS from blockchain
              bnsStatus: 'valid',  // New registrations always valid
              blockHeight: verification.blockHeight,
              registrationDate: new Date(verification.timestamp > 1000000000000 ? verification.timestamp : verification.timestamp * 1000)
            },
            expiresAt: new Date(Date.now() + 3600000), // 1 hour
            lastAccessed: new Date()
          },
          $inc: { hits: 1 }
        },
        { upsert: true }
      );

      return res.json({
        success: true,
        verified: true,
        message: 'Content verified successfully',
        data: {
          hash: hashHex,
          author: verification.author,
          bnsName: verification.bnsName,  // Include BNS from blockchain
          bnsStatus: 'valid',  // New registrations always valid
          registeredAt: new Date(verification.timestamp > 1000000000000 ? verification.timestamp : verification.timestamp * 1000).toISOString(),
          blockHeight: verification.blockHeight,
          registrationId: verification.registrationId
        }
      });

    } catch (error) {
      console.error('Error verifying tweet:', error);

      return res.status(500).json({
        success: false,
        verified: false,
        message: 'Error during verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

    /**
   * Quick hash existence check
   * GET /api/verify/:hash
   */
  async quickVerify(req: Request, res: Response): Promise<Response> {
    try {
      const { hash } = req.params;

      if (!hash) {
        return res.status(400).json({
          success: false,
          verified: false,
          message: 'Hash parameter is required'
        });
      }

      const contentHash = HashService.hexToBuffer(hash);
      const exists = await this.blockchainService.hashExists(contentHash);

      return res.json({
        success: true,
        verified: exists,
        message: exists ? 'Content verified' : 'Content not found',
        data: {
          hash: hash,
          exists: exists
        }
      });

    } catch (error) {
      console.error('Error in quick verify:', error);
      
      return res.status(500).json({
        success: false,
        verified: false,
        message: 'Error during quick verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }





  /**
   * Batch verify multiple hashes or contents
   * POST /api/verify/batch
   */
  async batchVerify(req: Request, res: Response): Promise<Response> {
    try {
      const { items }: { items: Array<{ content?: string; hash?: string }> } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items array is required for batch verification'
        });
      }

      if (items.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 items allowed per batch request'
        });
      }

      // Process each item
      const results = [];
      for (const item of items) {
        let contentHash: Buffer;
        let hashHex: string;

        if (item.content) {
          contentHash = HashService.generateContentHash(item.content);
          hashHex = HashService.generateContentHashHex(item.content);
        } else if (item.hash) {
          hashHex = item.hash;
          contentHash = HashService.hexToBuffer(item.hash);
        } else {
          results.push({
            success: false,
            verified: false,
            error: 'Either content or hash required'
          });
          continue;
        }

        try {
          const verification = await this.blockchainService.verifyTweet(contentHash);
          
          results.push({
            success: true,
            verified: !!verification,
            hash: hashHex,
            data: verification ? {
              author: verification.author,
              registeredAt: new Date(verification.timestamp * 1000).toISOString(),
              blockHeight: verification.blockHeight,
              registrationId: verification.registrationId,
            } : null
          });
        } catch (error) {
          results.push({
            success: false,
            verified: false,
            hash: hashHex,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return res.json({
        success: true,
        message: `Batch verification completed for ${items.length} items`,
        results: results
      });

    } catch (error) {
      console.error('Error in batch verify:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error during batch verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * CHECKPOINT 5: Manual BNS Validation Endpoint
   * Validates BNS ownership for a specific wallet address
   */
  async validateBNS(req: Request, res: Response): Promise<Response> {
    try {
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      console.log(`🔍 Validating BNS for wallet: ${walletAddress}`);

      // Find all registrations for this wallet
      const registrations = await Registration.find({
        authorWallet: walletAddress.toUpperCase(),
        bnsName: { $exists: true, $ne: null }
      });

      if (registrations.length === 0) {
        return res.json({
          success: true,
          message: 'No registrations with BNS names found for this wallet',
          validated: 0
        });
      }

      // Validate each registration
      let validatedCount = 0;
      let transferredCount = 0;
      let noLongerOwnedCount = 0;

      for (const registration of registrations) {
        const result = await bnsValidationService.validateRegistration(
          registration.bnsName || '',
          registration.authorWallet
        );
        
        if (result.status === 'valid') {
          validatedCount++;
        } else if (result.status === 'transferred') {
          transferredCount++;
        } else if (result.status === 'no-longer-owned') {
          noLongerOwnedCount++;
        }
      }

      return res.json({
        success: true,
        message: 'BNS validation completed',
        validated: validatedCount,
        transferred: transferredCount,
        noLongerOwned: noLongerOwnedCount,
        total: registrations.length
      });

    } catch (error) {
      console.error('❌ Error validating BNS:', error);
      return res.status(500).json({
        success: false,
        message: 'Error validating BNS ownership',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * CHECKPOINT 5: Get BNS Validation Status
   * Returns the validation status for all registrations of a wallet
   */
  async getBNSValidationStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const registrations = await Registration.find({
        authorWallet: walletAddress.toUpperCase(),
        bnsName: { $exists: true, $ne: null }
      }).select('bnsName bnsStatus lastBnsValidation currentBnsOwner bnsTransferredAt contentHash');

      return res.json({
        success: true,
        registrations: registrations.map(reg => ({
          contentHash: reg.contentHash,
          bnsName: reg.bnsName,
          status: reg.bnsStatus || 'valid',
          lastValidation: reg.lastBnsValidation,
          currentOwner: reg.currentBnsOwner,
          transferredAt: reg.bnsTransferredAt
        }))
      });

    } catch (error) {
      console.error('❌ Error getting BNS validation status:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving BNS validation status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
}