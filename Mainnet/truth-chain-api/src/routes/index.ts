import express from 'express';
import { RegistrationController } from '../controllers/RegistrationController';
import { VerificationController } from '../controllers/VerificationController';
import { AuthController } from '../controllers/AuthController';
import { WalletAuthController } from '../controllers/WalletAuthController';
import { UserController } from '../controllers/UserController';
import { BlockchainService } from '../services/BlockchainService';
import { 
  authLimiter, 
  registrationLimiter, 
  verificationLimiter,
  strictLimiter 
} from '../middleware/rateLimiter';

const router = express.Router();

// Initialize blockchain service
const blockchainConfig = {
  contractAddress: process.env.CONTRACT_ADDRESS || 'SPVQ61FEWR6M4HVAT3BNE07D4BNW6A1C2ACCNQ6F',  // v3 address
  contractName: process.env.CONTRACT_NAME || 'truthchain_v3',  // v3: All features + BNS
  network: (process.env.NETWORK as 'mainnet' | 'mainnet') || 'mainnet'
};

const blockchainService = new BlockchainService(blockchainConfig);

// Initialize controllers
const registrationController = new RegistrationController(blockchainService);
const verificationController = new VerificationController(blockchainService);
const authController = new AuthController();
const walletAuthController = new WalletAuthController();
const userController = new UserController();

// Registration Routes (Development/Testing with senderKey)
// Apply registration limiter to prevent spam
router.post('/register', registrationLimiter, registrationController.registerTweet.bind(registrationController));
router.post('/check-registration', verificationLimiter, registrationController.checkRegistration.bind(registrationController));
router.get('/registration/:txId', verificationLimiter, registrationController.getRegistrationByTxId.bind(registrationController));

// Secure Registration Routes (Frontend Integration - no senderKey)
// Apply stricter rate limiting for production endpoints
router.post('/secure/register', registrationLimiter, registrationController.secureRegisterTweet.bind(registrationController));
router.post('/secure/confirm-registration', registrationLimiter, registrationController.confirmRegistration.bind(registrationController));

// IPFS Content Retrieval
router.get('/content/:contentHash', verificationLimiter, registrationController.retrieveOriginalContent.bind(registrationController));

// Verification Routes
// More generous limits for read-only operations
router.post('/verify', verificationLimiter, verificationController.verifyTweet.bind(verificationController));
router.get('/verify/:hash', verificationLimiter, verificationController.quickVerify.bind(verificationController));
router.post('/verify/batch', verificationLimiter, verificationController.batchVerify.bind(verificationController));

// BNS Validation Routes (Hybrid Approach)
router.post('/validate-bns', strictLimiter, verificationController.validateBNS.bind(verificationController));
router.get('/validate-bns/:walletAddress', verificationLimiter, verificationController.getBNSValidationStatus.bind(verificationController));

// Wallet Authentication Routes (Primary auth method for TruthChain)
// Strict limits on authentication to prevent brute force
router.get('/auth/wallet/challenge', authLimiter, walletAuthController.getChallenge.bind(walletAuthController));
router.post('/auth/login/wallet', authLimiter, walletAuthController.loginWithWallet.bind(walletAuthController));
router.get('/auth/wallet/health', walletAuthController.health.bind(walletAuthController));

// Legacy Authentication/Session Routes (Extension compatibility)
// These use AuthController which stores sessions in MongoDB
router.post('/auth/session', authLimiter, authController.createSession.bind(authController));
router.get('/auth/session/:sessionId', authLimiter, authController.validateSession.bind(authController));
router.get('/auth/sessions/wallet/:walletAddress', authLimiter, authController.getWalletSessions.bind(authController));
router.get('/auth/health', authController.health.bind(authController));

// User & Dashboard Routes
// Apply verification limiter for read operations
router.get('/users/:walletAddress/stats', verificationLimiter, userController.getUserStats.bind(userController));
router.get('/users/:walletAddress/profile', verificationLimiter, userController.getUserProfile.bind(userController));
router.put('/users/:walletAddress/profile', strictLimiter, userController.updateUserProfile.bind(userController));
router.get('/users/by-wallet-hash/:hash', verificationLimiter, userController.getUserByWalletHash.bind(userController));
router.get('/registrations/wallet/:walletAddress', verificationLimiter, userController.getUserRegistrations.bind(userController));
router.get('/registrations/search', verificationLimiter, userController.searchRegistrations.bind(userController));
router.get('/stats/global', verificationLimiter, userController.getGlobalStats.bind(userController));

// Health check
router.get('/health', async (req, res) => {
  try {
    const stats = await blockchainService.getContractStats();
    res.json({
      success: true,
      message: 'TruthChain API is running',
      blockchain: {
        connected: !!stats,
        network: blockchainConfig.network,
        contract: `${blockchainConfig.contractAddress}.${blockchainConfig.contractName}`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'API running but blockchain connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;