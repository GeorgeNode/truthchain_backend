import { Request, Response } from 'express';
import { User } from '../../shared/models/User';
import { Registration } from '../../shared/models/Registration';

export interface GetUserStatsResponse {
  success: boolean;
  message: string;
  data?: {
    walletAddress: string;
    bnsName?: string;
    stats: {
      totalRegistrations: number;
      confirmedRegistrations: number;
      pendingRegistrations: number;
      failedRegistrations: number;
      totalVerifications: number;
      lastRegistration?: string;
    };
    metadata: {
      firstSeen: string;
      lastSeen: string;
    };
  };
  error?: string;
}

export interface GetUserRegistrationsResponse {
  success: boolean;
  message: string;
  data?: {
    walletAddress: string;
    total: number;
    limit: number;
    offset: number;
    registrations: Array<{
      contentHash: string;
      content: {
        type: string;
        preview?: string;
        url?: string;
        twitterHandle?: string;
      };
      blockchain: {
        txId?: string;
        status: string;
        blockHeight?: number;
        registrationId?: number;
      };
      ipfs?: {
        cid?: string;
        gateway?: string;
      };
      analytics: {
        views: number;
        verifications: number;
      };
      createdAt: string;
      confirmedAt?: string;
    }>;
  };
  error?: string;
}

export class UserController {

  /**
   * Get user statistics
   * GET /api/users/:walletAddress/stats
   */
  async getUserStats(req: Request, res: Response): Promise<Response<GetUserStatsResponse>> {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required',
          error: 'Missing wallet address'
        });
      }

      // Find user
      const user = await User.findOne({ walletAddress: walletAddress.toUpperCase() });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'No user with this wallet address'
        });
      }

      return res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: {
          walletAddress: user.walletAddress,
          bnsName: user.bnsName,
          stats: {
            totalRegistrations: user.stats.totalRegistrations,
            confirmedRegistrations: user.stats.confirmedRegistrations,
            pendingRegistrations: user.stats.pendingRegistrations,
            failedRegistrations: user.stats.failedRegistrations,
            totalVerifications: user.stats.totalVerifications,
            lastRegistration: user.stats.lastRegistration?.toISOString()
          },
          metadata: {
            firstSeen: user.metadata.firstSeen.toISOString(),
            lastSeen: user.metadata.lastSeen.toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Error getting user stats:', error);

      return res.status(500).json({
        success: false,
        message: 'Error retrieving user statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's registrations
   * GET /api/registrations/wallet/:walletAddress
   * Query params: ?limit=50&offset=0&status=confirmed
   */
  async getUserRegistrations(req: Request, res: Response): Promise<Response<GetUserRegistrationsResponse>> {
    try {
      const { walletAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string; // 'confirmed', 'pending', 'failed'

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required',
          error: 'Missing wallet address'
        });
      }

      // Build query
      const query: any = { authorWallet: walletAddress.toUpperCase() };
      if (status) {
        query['blockchain.status'] = status;
      }

      // Get registrations with pagination
      const [registrations, total] = await Promise.all([
        Registration.find(query)
          .sort({ 'createdAt': -1 })
          .limit(limit)
          .skip(offset)
          .lean(),
        Registration.countDocuments(query)
      ]);

      // Format response
      const formattedRegistrations = registrations.map(reg => ({
        contentHash: reg.contentHash,
        content: {
          type: reg.content.type,
          preview: reg.content.preview,
          url: reg.content.url,
          twitterHandle: reg.content.twitterHandle
        },
        blockchain: {
          txId: reg.blockchain.txId,
          status: reg.blockchain.status,
          blockHeight: reg.blockchain.blockHeight,
          registrationId: reg.blockchain.registrationId
        },
        ipfs: reg.ipfs ? {
          cid: reg.ipfs.cid,
          gateway: reg.ipfs.gateway
        } : undefined,
        analytics: {
          views: reg.analytics.views,
          verifications: reg.analytics.verifications
        },
        createdAt: reg.createdAt.toISOString(),
        confirmedAt: reg.updatedAt?.toISOString()
      }));

      return res.json({
        success: true,
        message: 'User registrations retrieved successfully',
        data: {
          walletAddress: walletAddress.toUpperCase(),
          total,
          limit,
          offset,
          registrations: formattedRegistrations
        }
      });

    } catch (error) {
      console.error('Error getting user registrations:', error);

      return res.status(500).json({
        success: false,
        message: 'Error retrieving user registrations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user profile (combined stats and recent registrations)
   * GET /api/users/:walletAddress/profile
   */
  async getUserProfile(req: Request, res: Response): Promise<Response> {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      // Get user and recent registrations
      const [user, recentRegistrations] = await Promise.all([
        User.findOne({ walletAddress: walletAddress.toUpperCase() }),
        Registration.find({ authorWallet: walletAddress.toUpperCase() })
          .sort({ 'createdAt': -1 })
          .limit(5)
          .lean()
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.json({
        success: true,
        message: 'User profile retrieved successfully',
        data: {
          user: {
            walletAddress: user.walletAddress,
            bnsName: user.bnsName,
            twitterHandle: user.twitterHandle,
            stats: user.stats,
            metadata: {
              firstSeen: user.metadata.firstSeen.toISOString(),
              lastSeen: user.metadata.lastSeen.toISOString()
            }
          },
          recentRegistrations: recentRegistrations.map(reg => ({
            contentHash: reg.contentHash,
            content: {
              type: reg.content.type,
              preview: reg.content.preview,
              url: reg.content.url
            },
            blockchain: {
              status: reg.blockchain.status,
              txId: reg.blockchain.txId
            },
            createdAt: reg.createdAt.toISOString()
          }))
        }
      });

    } catch (error) {
      console.error('Error getting user profile:', error);

      return res.status(500).json({
        success: false,
        message: 'Error retrieving user profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get global platform statistics
   * GET /api/stats/global
   */
  async getGlobalStats(req: Request, res: Response): Promise<Response> {
    try {
      const [
        totalUsers,
        totalRegistrations,
        confirmedRegistrations,
        pendingRegistrations,
        totalIPFSStored
      ] = await Promise.all([
        User.countDocuments(),
        Registration.countDocuments(),
        Registration.countDocuments({ 'blockchain.status': 'confirmed' }),
        Registration.countDocuments({ 'blockchain.status': 'pending' }),
        Registration.countDocuments({ 'ipfs.cid': { $exists: true, $ne: null } })
      ]);

      // Get recent registrations
      const recentRegistrations = await Registration.find({ 'blockchain.status': 'confirmed' })
        .sort({ 'updatedAt': -1 })
        .limit(10)
        .select('contentHash authorWallet content.type content.preview timestamps.confirmed')
        .lean();

      return res.json({
        success: true,
        message: 'Global statistics retrieved successfully',
        data: {
          users: {
            total: totalUsers
          },
          registrations: {
            total: totalRegistrations,
            confirmed: confirmedRegistrations,
            pending: pendingRegistrations,
            failed: totalRegistrations - confirmedRegistrations - pendingRegistrations
          },
          ipfs: {
            totalStored: totalIPFSStored,
            percentage: totalRegistrations > 0
              ? Math.round((totalIPFSStored / totalRegistrations) * 100)
              : 0
          },
          recent: recentRegistrations.map(reg => ({
            contentHash: reg.contentHash,
            author: reg.authorWallet,
            type: reg.content.type,
            preview: reg.content.preview,
            confirmedAt: reg.blockchain.timestamp?.toISOString()
          }))
        }
      });

    } catch (error) {
      console.error('Error getting global stats:', error);

      return res.status(500).json({
        success: false,
        message: 'Error retrieving global statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update user profile
   * PUT /api/users/:walletAddress/profile
   */
  async updateUserProfile(req: Request, res: Response): Promise<Response> {
    try {
      const { walletAddress } = req.params;
      const { bnsName, twitterHandle, email } = req.body;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const user = await User.findOne({ walletAddress: walletAddress.toUpperCase() });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update fields if provided
      if (bnsName !== undefined) {
        user.bnsName = bnsName.trim() || undefined;
      }
      if (twitterHandle !== undefined) {
        user.twitterHandle = twitterHandle.trim() || undefined;
      }
      if (email !== undefined) {
        user.email = email.trim() || undefined;
      }

      await user.save();

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          walletAddress: user.walletAddress,
          bnsName: user.bnsName,
          twitterHandle: user.twitterHandle,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Error updating user profile:', error);

      return res.status(500).json({
        success: false,
        message: 'Error updating user profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Search registrations
   * GET /api/registrations/search?q=searchTerm
   */
  async searchRegistrations(req: Request, res: Response): Promise<Response> {
    try {
      const searchTerm = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!searchTerm || searchTerm.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Search term must be at least 3 characters'
        });
      }

      // Search in multiple fields
      const registrations = await Registration.find({
        $or: [
          { contentHash: { $regex: searchTerm, $options: 'i' } },
          { 'content.preview': { $regex: searchTerm, $options: 'i' } },
          { 'content.twitterHandle': { $regex: searchTerm, $options: 'i' } },
          { 'blockchain.txId': { $regex: searchTerm, $options: 'i' } },
          { authorWallet: { $regex: searchTerm, $options: 'i' } }
        ],
        'blockchain.status': 'confirmed'
      })
        .sort({ 'updatedAt': -1 })
        .limit(limit)
        .lean();

      return res.json({
        success: true,
        message: 'Search completed',
        data: {
          searchTerm,
          results: registrations.length,
          registrations: registrations.map(reg => ({
            contentHash: reg.contentHash,
            content: {
              type: reg.content.type,
              preview: reg.content.preview,
              url: reg.content.url,
              twitterHandle: reg.content.twitterHandle
            },
            blockchain: {
              txId: reg.blockchain.txId,
              status: reg.blockchain.status
            },
            author: reg.authorWallet,
            createdAt: reg.createdAt.toISOString()
          }))
        }
      });

    } catch (error) {
      console.error('Error searching registrations:', error);

      return res.status(500).json({
        success: false,
        message: 'Error searching registrations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user by wallet hash (for username lookup)
   * GET /users/by-wallet-hash/:hash
   */
  async getUserByWalletHash(req: Request, res: Response): Promise<Response> {
    try {
      const { hash } = req.params;

      if (!hash) {
        return res.status(400).json({
          success: false,
          message: 'Wallet hash is required',
          error: 'Missing wallet hash'
        });
      }

      // For now, since we don't store wallet hash in the User model,
      // we'll return a 404 to indicate username system is not yet implemented
      // TODO: Implement proper username storage and lookup
      return res.status(404).json({
        success: false,
        message: 'Username not found',
        error: 'Username system not yet implemented'
      });

    } catch (error) {
      console.error('Error getting user by wallet hash:', error);

      return res.status(500).json({
        success: false,
        message: 'Error retrieving user by wallet hash',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
