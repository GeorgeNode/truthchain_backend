import { Request, Response } from 'express';
import { HashService } from '../services/HashService';
import { BlockchainService } from '../services/BlockchainService';
import { User } from '../../shared/models/User';
import { Registration } from '../../shared/models/Registration';

// For development/testing with Postman (includes senderKey)
export interface RegisterTweetRequest {
  tweetContent: string;
  tweetUrl?: string;
  twitterHandle?: string;
  senderKey: string; // Private key for blockchain transaction
}

// For secure frontend integration (no senderKey)
export interface SecureRegisterRequest {
  tweetContent: string;
  tweetUrl?: string;
  twitterHandle?: string;
  walletAddress: string; // Required for database tracking
  bnsName?: string; // BNS name at time of registration (preserves identity)
  txId?: string; // Optional transaction ID if already submitted
  storeOnIPFS?: boolean; // Optional: User opt-in for IPFS storage
  source?: 'extension' | 'webapp' | 'api'; // Source of registration
}

export interface RegisterTweetResponse {
  success: boolean;
  message: string;
  data?: {
    hash: string;
    txId?: string;
    registrationId?: number;
    tweetUrl?: string;
    twitterHandle?: string;
  };
  error?: string;
}

export class RegistrationController {
  private blockchainService: BlockchainService;

  constructor(blockchainService: BlockchainService) {
    this.blockchainService = blockchainService;
  }

  /**
   * Register a new tweet on the blockchain (Development/Testing)
   * POST /api/register
   */
  async registerTweet(req: Request, res: Response): Promise<Response<RegisterTweetResponse>> {
    try {
      const { tweetContent, tweetUrl, twitterHandle, senderKey }: RegisterTweetRequest = req.body;

      // Validation
      if (!tweetContent || !senderKey) {
        return res.status(400).json({
          success: false,
          message: 'Tweet content and sender key are required',
          error: 'Missing required fields'
        });
      }

      if (tweetContent.length > 280) {
        return res.status(400).json({
          success: false,
          message: 'Tweet content exceeds 280 characters',
          error: 'Content too long'
        });
      }

      // Generate content hash
      const contentHash = HashService.generateContentHash(tweetContent);
      const hashHex = HashService.generateContentHashHex(tweetContent);

      // Check if content already exists
      const exists = await this.blockchainService.hashExists(contentHash);
      if (exists) {
        return res.status(409).json({
          success: false,
          message: 'This content has already been registered',
          error: 'Duplicate content',
          data: {
            hash: hashHex,
            tweetUrl,
            twitterHandle
          }
        });
      }

      // Register on blockchain
      const registrationResult = await this.blockchainService.registerTweet(
        contentHash,
        senderKey
      );

      if (!registrationResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to register tweet on blockchain',
          error: registrationResult.error
        });
      }


      return res.status(201).json({
        success: true,
        message: 'Tweet registered successfully',
        data: {
          hash: hashHex,
          txId: registrationResult.txId,
          registrationId: registrationResult.registrationId,
          tweetUrl,
          twitterHandle
        }
      });

    } catch (error) {
      console.error('Error registering tweet:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if a tweet can be registered (pre-validation)
   * POST /api/check-registration
   */
  async checkRegistration(req: Request, res: Response): Promise<Response> {
    try {
      const { tweetContent }: { tweetContent: string } = req.body;

      if (!tweetContent) {
        return res.status(400).json({
          success: false,
          message: 'Tweet content is required'
        });
      }

      // Generate hash and check existence
      const contentHash = HashService.generateContentHash(tweetContent);
      const hashHex = HashService.generateContentHashHex(tweetContent);
      const exists = await this.blockchainService.hashExists(contentHash);

      return res.json({
        success: true,
        data: {
          hash: hashHex,
          exists: exists,
          canRegister: !exists,
          message: exists 
            ? 'Content already registered' 
            : 'Content available for registration'
        }
      });

    } catch (error) {
      console.error('Error checking registration:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error checking registration status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }


  /**
   * Get registration by transaction ID
   * GET /api/registration/:txId
   */
  async getRegistrationByTxId(req: Request, res: Response): Promise<Response> {
    try {
      const { txId } = req.params;

      if (!txId) {
        return res.status(400).json({
          success: false,
          message: 'Transaction ID is required'
        });
      }
      return res.json({
        success: true,
        message: 'Registration lookup by transaction ID',
        data: {
          txId,
        }
      });

    } catch (error) {
      console.error('Error getting registration:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error retrieving registration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Secure registration for frontend integration (no senderKey)
   * POST /api/secure/register
   */
  async secureRegisterTweet(req: Request, res: Response): Promise<Response> {
    try {
      const {
        tweetContent,
        tweetUrl,
        twitterHandle,
        walletAddress,
        bnsName,
        storeOnIPFS = false,
        source = 'api'
      }: SecureRegisterRequest = req.body;

      // Validation
      if (!tweetContent || !walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Tweet content and wallet address are required',
          error: 'Missing required fields'
        });
      }

      if (tweetContent.length > 280) {
        return res.status(400).json({
          success: false,
          message: 'Tweet content exceeds 280 characters',
          error: 'Content too long'
        });
      }

      // Generate content hash
      const contentHash = HashService.generateContentHash(tweetContent);
      const hashHex = HashService.generateContentHashHex(tweetContent);

      // Check if already exists in database
      const existingReg = await Registration.findOne({ contentHash: hashHex });
      if (existingReg && existingReg.blockchain.status === 'confirmed') {
        return res.status(409).json({
          success: false,
          message: 'Content already registered',
          data: {
            hash: hashHex,
            txId: existingReg.blockchain.txId,
            registrationId: existingReg.blockchain.registrationId
          }
        });
      }

      // Check blockchain
      const exists = await this.blockchainService.hashExists(contentHash);
      if (exists) {
        return res.status(409).json({
          success: false,
          message: 'This content has already been registered on blockchain',
          error: 'Duplicate content',
          data: {
            hash: hashHex,
            tweetUrl,
            twitterHandle
          }
        });
      }

      // Create or update user
      await User.findOneAndUpdate(
        { walletAddress: walletAddress.toUpperCase() },
        {
          $set: { 'metadata.lastSeen': new Date() },
          $setOnInsert: {
            walletAddress: walletAddress.toUpperCase(),
            'metadata.firstSeen': new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Store on IPFS if requested
      let ipfsCID: string | undefined;
      let ipfsGateway: string | undefined;

      if (storeOnIPFS) {
        try {
          const ipfsService = (global as any).ipfsService;
          if (ipfsService) {
            ipfsCID = await ipfsService.storeContent({
              content: tweetContent,
              metadata: {
                originalUrl: tweetUrl,
                author: twitterHandle,
                timestamp: new Date().toISOString(),
                contentType: 'tweet' as const,
                source: 'truthchain' as const
              }
            });
            ipfsGateway = ipfsService.getGatewayURL(ipfsCID);
            console.log(`✅ Content stored on IPFS: ${ipfsCID}`);
          }
        } catch (ipfsError) {
          console.warn('⚠️  IPFS storage failed:', ipfsError);
          // Continue without IPFS - don't fail the whole request
        }
      }

      // Save to MongoDB
      const registration = new Registration({
        contentHash: hashHex,
        authorWallet: walletAddress.toUpperCase(),
        bnsName: bnsName,
        content: {
          type: 'tweet',
          text: tweetContent.length <= 500 ? tweetContent : undefined,
          preview: tweetContent.substring(0, 100),
          url: tweetUrl,
          twitterHandle,
          hasFullContent: !!ipfsCID
        },
        blockchain: {
          status: 'pending',
          network: process.env.NETWORK || 'mainnet'
        },
        ipfs: ipfsCID ? {
          cid: ipfsCID,
          gateway: ipfsGateway,
          pinned: true,
          uploadedAt: new Date()
        } : undefined,
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          source: source
        }
      });

      const savedRegistration = await registration.save();
      
      if (!savedRegistration || !savedRegistration._id) {
        console.error('❌ Registration.save() returned but document not saved!');
        console.error('Saved registration:', savedRegistration);
        throw new Error('Failed to save registration to database');
      }
      
      console.log(`✅ Registration saved to database with _id: ${savedRegistration._id}, hash: ${hashHex}`);

      // Update user stats
      await User.findOneAndUpdate(
        { walletAddress: walletAddress.toUpperCase() },
        {
          $inc: {
            'stats.totalRegistrations': 1,
            'stats.pendingRegistrations': 1
          },
          $set: { 'stats.lastRegistration': new Date() }
        }
      );

      // Return hash and metadata for frontend to handle blockchain transaction
      return res.status(200).json({
        success: true,
        message: 'Content ready for blockchain registration',
        data: {
          hash: hashHex,
          ipfs: ipfsCID ? {
            cid: ipfsCID,
            gateway: ipfsGateway,
            stored: true
          } : {
            stored: false,
            reason: storeOnIPFS ? 'IPFS storage failed' : 'User opted out'
          },
          tweetUrl,
          twitterHandle,
          instructions: 'Use this hash with your wallet to register on-chain'
        }
      });

    } catch (error) {
      console.error('Error in secure registration:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Confirm registration after blockchain transaction
   * POST /api/secure/confirm-registration
   */
  async confirmRegistration(req: Request, res: Response): Promise<Response> {
    try {
      const { tweetContent, txId }: { tweetContent: string; txId: string } = req.body;

      if (!tweetContent || !txId) {
        return res.status(400).json({
          success: false,
          message: 'Tweet content and transaction ID are required'
        });
      }

      // Generate hash and verify it exists on blockchain
      const contentHash = HashService.generateContentHash(tweetContent);
      const hashHex = HashService.generateContentHashHex(tweetContent);

      // Wait a moment for transaction to be confirmed
      await new Promise(resolve => setTimeout(resolve, 2000));

      const verification = await this.blockchainService.verifyTweet(contentHash);

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found on blockchain. Transaction may still be pending.',
          data: {
            hash: hashHex,
            txId
          }
        });
      }

      // Update MongoDB with blockchain confirmation
      const updatedRegistration = await Registration.findOneAndUpdate(
        { contentHash: hashHex },
        {
          $set: {
            'blockchain.txId': txId,
            'blockchain.blockHeight': verification.blockHeight,
            'blockchain.registrationId': verification.registrationId,
            'blockchain.status': 'confirmed',
            'blockchain.timestamp': new Date()
          }
        },
        { new: true }
      );

      if (updatedRegistration) {
        // Update user stats
        await User.findOneAndUpdate(
          { walletAddress: updatedRegistration.authorWallet },
          {
            $inc: {
              'stats.confirmedRegistrations': 1,
              'stats.pendingRegistrations': -1
            }
          }
        );

        console.log(`✅ Registration confirmed in database: ${hashHex}`);
      }

      return res.json({
        success: true,
        message: 'Registration confirmed on blockchain',
        data: {
          hash: hashHex,
          txId,
          author: verification.author,
          registeredAt: new Date(verification.timestamp > 1000000000000 ? verification.timestamp : verification.timestamp * 1000).toISOString(),
          blockHeight: verification.blockHeight,
          registrationId: verification.registrationId,
        }
      });

    } catch (error) {
      console.error('Error confirming registration:', error);

      return res.status(500).json({
        success: false,
        message: 'Error confirming registration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Retrieve original content from IPFS
   * GET /api/content/:contentHash
   */
  async retrieveOriginalContent(req: Request, res: Response): Promise<Response> {
    try {
      const { contentHash } = req.params;

      // Get registration from MongoDB
      const registration = await Registration.findOne({ contentHash });

      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }

      if (!registration.ipfs?.cid) {
        return res.status(404).json({
          success: false,
          message: 'Content not stored on IPFS',
          data: {
            preview: registration.content.preview,
            url: registration.content.url
          }
        });
      }

      // Retrieve from IPFS
      const ipfsService = (global as any).ipfsService;
      if (!ipfsService) {
        return res.status(503).json({
          success: false,
          message: 'IPFS service not available'
        });
      }

      const ipfsContent = await ipfsService.retrieveContent(registration.ipfs.cid);

      // Update analytics
      await Registration.findByIdAndUpdate(registration._id, {
        $inc: { 'analytics.views': 1 },
        $set: { 'analytics.lastViewed': new Date() }
      });

      return res.json({
        success: true,
        data: {
          content: ipfsContent.content,
          metadata: ipfsContent.metadata,
          ipfs: {
            cid: registration.ipfs.cid,
            gateway: registration.ipfs.gateway,
            gateways: ipfsService.getGatewayURLs(registration.ipfs.cid)
          },
          blockchain: {
            hash: registration.contentHash,
            txId: registration.blockchain.txId,
            status: registration.blockchain.status,
            blockHeight: registration.blockchain.blockHeight
          }
        }
      });

    } catch (error) {
      console.error('Content retrieval error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve content',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

}