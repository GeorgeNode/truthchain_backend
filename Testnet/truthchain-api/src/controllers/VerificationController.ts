import { Request, Response } from 'express';
import { HashService } from '../services/HashService';
import { BlockchainService } from '../services/BlockchainService';
import { Registration } from '../../shared/models/Registration';
import { VerificationCache } from '../../shared/models/VerificationCache';

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
        console.log('✅ Verification served from cache');

        // Update analytics if registration exists
        if (cached.result.isRegistered) {
          await Registration.findOneAndUpdate(
            { contentHash: hashHex },
            {
              $inc: { 'analytics.verifications': 1 },
              $set: { 'analytics.lastVerified': new Date() }
            }
          );
        }

        return res.json({
          success: true,
          verified: cached.result.isRegistered,
          message: cached.result.isRegistered ? 'Content verified (cached)' : 'Content not found (cached)',
          data: cached.result.isRegistered ? {
            hash: hashHex,
            author: cached.result.authorWallet,
            registeredAt: cached.result.registrationDate?.toISOString(),
            blockHeight: cached.result.blockHeight,
            txId: cached.result.txId
          } : undefined
        });
      }

      // Step 2: Check MongoDB registration (MEDIUM - ~50ms)
      const registration = await Registration.findOne({
        contentHash: hashHex,
        'blockchain.status': 'confirmed'
      });

      if (registration) {
        console.log('✅ Verification found in database');

        // Update cache
        await VerificationCache.findOneAndUpdate(
          { contentHash: hashHex },
          {
            $set: {
              result: {
                isRegistered: true,
                authorWallet: registration.authorWallet,
                blockHeight: registration.blockchain.blockHeight!,
                registrationDate: registration.blockchain.timestamp,
                txId: registration.blockchain.txId
              },
              expiresAt: new Date(Date.now() + 3600000) // 1 hour cache
            }
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
            registeredAt: registration.blockchain.timestamp?.toISOString(),
            blockHeight: registration.blockchain.blockHeight!,
            registrationId: registration.blockchain.registrationId!,
            txId: registration.blockchain.txId,
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
        // Cache negative result
        await VerificationCache.findOneAndUpdate(
          { contentHash: hashHex },
          {
            $set: {
              exists: false,
              cachedAt: new Date(),
              expiresAt: new Date(Date.now() + 3600000) // 1 hour
            }
          },
          { upsert: true }
        );

        return res.json({
          success: true,
          verified: false,
          message: 'Content not found on blockchain'
        });
      }

      // Cache positive result
      await VerificationCache.create({
        contentHash: hashHex,
        exists: true,
        data: {
          authorWallet: verification.author,
          blockHeight: verification.blockHeight,
          registrationId: verification.registrationId,
          timestamp: new Date(verification.timestamp > 1000000000000 ? verification.timestamp : verification.timestamp * 1000)
        },
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      });

      return res.json({
        success: true,
        verified: true,
        message: 'Content verified successfully',
        data: {
          hash: hashHex,
          author: verification.author,
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
  
}