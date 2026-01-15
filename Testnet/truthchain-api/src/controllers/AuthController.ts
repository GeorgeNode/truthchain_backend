import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../../shared/models/User';

export interface CreateSessionRequest {
  walletAddress: string;
  bnsName?: string;
  source: 'extension' | 'web' | 'mobile';
  walletType?: string;
  metadata?: {
    userAgent?: string;
    platform?: string;
    timestamp?: number;
  };
}

export interface Session {
  sessionId: string;
  walletAddress: string;
  source: 'extension' | 'web' | 'mobile';
  walletType?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  active: boolean;
}

export interface SessionResponse {
  success: boolean;
  message: string;
  data?: {
    sessionId: string;
    walletAddress: string;
    expiresAt: string;
    user?: any;
  };
  error?: string;
}

export interface ValidationResponse {
  success: boolean;
  valid: boolean;
  data?: {
    sessionId: string;
    walletAddress: string;
    source: string;
    user?: any;
  };
  message?: string;
}

export class AuthController {
  // In-memory session storage (replace with MongoDB in production)
  private static sessions: Map<string, Session> = new Map();

  // Session expiration time (4 hours)
  private static SESSION_EXPIRATION_MS = 4 * 60 * 60 * 1000;

  /**
   * Create a new session for a wallet
   * POST /api/auth/session
   */
  async createSession(req: Request, res: Response): Promise<Response<SessionResponse>> {
    try {
      const { walletAddress, bnsName, source, walletType, metadata }: CreateSessionRequest = req.body;

      // Validation
      if (!walletAddress || !source) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address and source are required',
          error: 'Missing required fields'
        });
      }

      if (!['extension', 'web', 'mobile'].includes(source)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid source. Must be extension, web, or mobile',
          error: 'Invalid source'
        });
      }

      // Normalize wallet address
      const normalizedAddress = walletAddress.toUpperCase();

      // Generate session ID
      const sessionId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + AuthController.SESSION_EXPIRATION_MS);

      // Create session object (in-memory fallback)
      const session: Session = {
        sessionId,
        walletAddress: normalizedAddress,
        source,
        walletType,
        createdAt: now,
        expiresAt,
        lastActivity: now,
        active: true
      };

      // Store session in memory
      AuthController.sessions.set(sessionId, session);

      // Clean up expired sessions
      this.cleanupExpiredSessions();

      // ✨ NEW: Create or update user in MongoDB
      let userData: any = null;
      try {
        const userAgent = metadata?.userAgent || req.headers['user-agent'];
        const platform = metadata?.platform || this.detectPlatform(userAgent);

        // Find or create user
        let user = await User.findOne({ walletAddress: normalizedAddress });

        if (!user) {
          // Create new user
          console.log(`✅ Creating new user in MongoDB: ${normalizedAddress.substring(0, 12)}...`);
          user = new User({
            walletAddress: normalizedAddress,
            walletType: walletType || 'other',
            bnsName: bnsName || undefined,
            sessions: [],
            stats: {
              totalRegistrations: 0,
              confirmedRegistrations: 0,
              pendingRegistrations: 0,
              failedRegistrations: 0,
              totalVerifications: 0
            },
            preferences: {
              notifications: true,
              publicProfile: false,
              autoStoreIPFS: false
            },
            metadata: {
              firstSeen: now,
              lastSeen: now,
              userAgent,
              platform
            }
          });
        } else {
          // Update existing user
          console.log(`✅ Updating existing user in MongoDB: ${normalizedAddress.substring(0, 12)}...`);
          if (walletType) user.walletType = walletType as any;
          if (bnsName) user.bnsName = bnsName;
          user.metadata.lastSeen = now;
          if (userAgent) user.metadata.userAgent = userAgent;
          if (platform) user.metadata.platform = platform;
        }

        // Add session to user's sessions array
        await user.addSession({
          sessionId,
          source,
          walletType: walletType || 'other',
          expiresAt
        });

        userData = {
          walletAddress: user.walletAddress,
          bnsName: user.bnsName,
          walletType: user.walletType
        };

        console.log(`✅ User saved to MongoDB with session: ${sessionId}`);
      } catch (dbError) {
        console.error('⚠️ Error saving user to MongoDB:', dbError);
        // Continue with session creation even if DB save fails
      }

      console.log(`✅ Session created: ${sessionId} for wallet ${normalizedAddress.substring(0, 12)}... from ${source}`);

      return res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: {
          sessionId,
          walletAddress: normalizedAddress,
          expiresAt: expiresAt.toISOString(),
          user: userData
        }
      });

    } catch (error) {
      console.error('Error creating session:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to create session',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Detect platform from user agent
   */
  private detectPlatform(userAgent?: string): string {
    if (!userAgent) return 'unknown';

    if (userAgent.includes('Chrome')) return 'chrome';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (userAgent.includes('Safari')) return 'safari';
    if (userAgent.includes('Edge')) return 'edge';

    return 'other';
  }

  /**
   * Validate an existing session
   * GET /api/auth/session/:sessionId
   */
  async validateSession(req: Request, res: Response): Promise<Response<ValidationResponse>> {
    try {
      const { sessionId } = req.params;
      const { walletAddress } = req.query;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Session ID is required'
        });
      }

      // Retrieve session
      const session = AuthController.sessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          valid: false,
          message: 'Session not found'
        });
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        AuthController.sessions.delete(sessionId);
        return res.status(401).json({
          success: false,
          valid: false,
          message: 'Session has expired'
        });
      }

      // Check if session is active
      if (!session.active) {
        return res.status(401).json({
          success: false,
          valid: false,
          message: 'Session is no longer active'
        });
      }

      // Optional: Validate wallet address matches
      if (walletAddress && session.walletAddress !== walletAddress) {
        return res.status(403).json({
          success: false,
          valid: false,
          message: 'Wallet address does not match session'
        });
      }

      // Update last activity
      session.lastActivity = new Date();
      AuthController.sessions.set(sessionId, session);

      console.log(`Session validated: ${sessionId} for wallet ${session.walletAddress.substring(0, 12)}...`);

      return res.json({
        success: true,
        valid: true,
        data: {
          sessionId: session.sessionId,
          walletAddress: session.walletAddress,
          source: session.source
        }
      });

    } catch (error) {
      console.error('Error validating session:', error);

      return res.status(500).json({
        success: false,
        valid: false,
        message: 'Error validating session'
      });
    }
  }

  /**
   * Logout and invalidate session
   * DELETE /api/auth/session/:sessionId
   */
  async logout(req: Request, res: Response): Promise<Response> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      const session = AuthController.sessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Mark session as inactive
      session.active = false;
      AuthController.sessions.set(sessionId, session);

      // Delete session after marking inactive
      setTimeout(() => {
        AuthController.sessions.delete(sessionId);
      }, 1000);

      console.log(`Session logged out: ${sessionId}`);

      return res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Error logging out:', error);

      return res.status(500).json({
        success: false,
        message: 'Error logging out'
      });
    }
  }

  /**
   * Get all active sessions for a wallet (admin/debug)
   * GET /api/auth/sessions/wallet/:walletAddress
   */
  async getWalletSessions(req: Request, res: Response): Promise<Response> {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const walletSessions = Array.from(AuthController.sessions.values())
        .filter(session =>
          session.walletAddress === walletAddress &&
          session.active &&
          new Date() <= session.expiresAt
        )
        .map(session => ({
          sessionId: session.sessionId,
          source: session.source,
          walletType: session.walletType,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastActivity: session.lastActivity
        }));

      return res.json({
        success: true,
        data: {
          walletAddress,
          activeSessions: walletSessions.length,
          sessions: walletSessions
        }
      });

    } catch (error) {
      console.error('Error getting wallet sessions:', error);

      return res.status(500).json({
        success: false,
        message: 'Error retrieving sessions'
      });
    }
  }

  /**
   * Clean up expired sessions (internal maintenance)
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of AuthController.sessions.entries()) {
      if (now > session.expiresAt) {
        AuthController.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Health check for session storage
   * GET /api/auth/health
   */
  async health(req: Request, res: Response): Promise<Response> {
    const activeSessions = Array.from(AuthController.sessions.values())
      .filter(session => session.active && new Date() <= session.expiresAt);

    return res.json({
      success: true,
      data: {
        totalSessions: AuthController.sessions.size,
        activeSessions: activeSessions.length,
        storageType: 'in-memory',
        timestamp: new Date().toISOString()
      }
    });
  }
}
