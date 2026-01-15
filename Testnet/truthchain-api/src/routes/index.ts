import express from 'express';
import { RegistrationController } from '../controllers/RegistrationController';
import { VerificationController } from '../controllers/VerificationController';
import { AuthController } from '../controllers/AuthController';
import { WalletAuthController } from '../controllers/WalletAuthController';
import { UserController } from '../controllers/UserController';
import { BlockchainService } from '../services/BlockchainService';

const router = express.Router();

// Initialize blockchain service
const blockchainConfig = {
  contractAddress: process.env.CONTRACT_ADDRESS || 'SP1S7KX8TVSAWJ8CVJZQSFERBQ8BNCDXYFHXT21Z9',
  contractName: process.env.CONTRACT_NAME || 'truthchain_v1',
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
router.post('/register', registrationController.registerTweet.bind(registrationController));
router.post('/check-registration', registrationController.checkRegistration.bind(registrationController));
router.get('/registration/:txId', registrationController.getRegistrationByTxId.bind(registrationController));

// Secure Registration Routes (Frontend Integration - no senderKey)
router.post('/secure/register', registrationController.secureRegisterTweet.bind(registrationController));
router.post('/secure/confirm-registration', registrationController.confirmRegistration.bind(registrationController));

// IPFS Content Retrieval
router.get('/content/:contentHash', registrationController.retrieveOriginalContent.bind(registrationController));

// Verification Routes
router.post('/verify', verificationController.verifyTweet.bind(verificationController));
router.get('/verify/:hash', verificationController.quickVerify.bind(verificationController));
router.post('/verify/batch', verificationController.batchVerify.bind(verificationController));

// Wallet Authentication Routes (Primary auth method for TruthChain)
router.get('/auth/wallet/challenge', walletAuthController.getChallenge.bind(walletAuthController));
router.post('/auth/login/wallet', walletAuthController.loginWithWallet.bind(walletAuthController));
router.get('/auth/session/:sessionId', walletAuthController.validateSession.bind(walletAuthController));
router.delete('/auth/session/:sessionId', walletAuthController.logout.bind(walletAuthController));
router.get('/auth/wallet/health', walletAuthController.health.bind(walletAuthController));

// Legacy Authentication/Session Routes (Extension compatibility)
router.post('/auth/session', authController.createSession.bind(authController));
router.get('/auth/sessions/wallet/:walletAddress', authController.getWalletSessions.bind(authController));
router.get('/auth/health', authController.health.bind(authController));

// User & Dashboard Routes
router.get('/users/:walletAddress/stats', userController.getUserStats.bind(userController));
router.get('/users/:walletAddress/profile', userController.getUserProfile.bind(userController));
router.put('/users/:walletAddress/profile', userController.updateUserProfile.bind(userController));
router.get('/registrations/wallet/:walletAddress', userController.getUserRegistrations.bind(userController));
router.get('/registrations/search', userController.searchRegistrations.bind(userController));
router.get('/stats/global', userController.getGlobalStats.bind(userController));

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