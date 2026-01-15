import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import apiRoutes from './routes/index';

// Load environment variables
dotenv.config();

// Import shared services (using relative path to shared directory)
// import { DatabaseService } from '../../shared/services/DatabaseService';
// import { IPFSService } from '../../shared/services/IPFSService';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet()); // Security headers

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true
}));

app.use(morgan('combined')); // Request logging
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (_req: express.Request, res: express.Response) => {
  res.json({
    name: 'TruthChain API',
    version: '1.0.0',
    description: 'Decentralized content verification system for Twitter',
    endpoints: {
      health: '/api/health',
      // Development/Testing Endpoints (with senderKey)
      register: 'POST /api/register',
      checkRegistration: 'POST /api/check-registration',
      // Secure Frontend Endpoints (no senderKey)
      secureRegister: 'POST /api/secure/register',
      confirmRegistration: 'POST /api/secure/confirm-registration',
      // Verification Endpoints
      verify: 'POST /api/verify',
      quickVerify: 'GET /api/verify/:hash',
      batchVerify: 'POST /api/verify/batch'
    },
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'POST /api/register',
      'POST /api/verify',
      'GET /api/verify/:hash'
    ]
  });
});

// Initialize services and start server
async function startServer() {
  try {
    console.log('🚀 Starting TruthChain Testnet API...\n');

    // Initialize MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/truthchain_testnet';
    // const dbService = DatabaseService.getInstance({ uri: mongoUri });

    console.log('📦 Connecting to MongoDB (Testnet)...');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // Initialize IPFS via Pinata (optional - can run without it)
    // let ipfsService: IPFSService | null = null;
    const hasPinataJWT = process.env.PINATA_JWT;
    const hasPinataKeys = process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET;

    if (hasPinataJWT || hasPinataKeys) {
      console.log('ℹ️  IPFS service initialization skipped (service not available)');
      // try {
      //   console.log('🌐 Initializing IPFS service (Pinata)...');
      //   ipfsService = new IPFSService({
      //     apiKey: process.env.PINATA_API_KEY || '',
      //     apiSecret: process.env.PINATA_API_SECRET || '',
      //     jwt: process.env.PINATA_JWT,
      //     gateway: process.env.IPFS_GATEWAY
      //   });

      //   // Test authentication
      //   const isAuthenticated = await ipfsService.testAuthentication();
      //   if (isAuthenticated) {
      //     console.log('✅ IPFS service initialized (Pinata authenticated)');
      //   } else {
      //     console.warn('⚠️  Pinata authentication failed - check your credentials');
      //     ipfsService = null;
      //   }
      // } catch (error) {
      //   console.warn('⚠️  IPFS initialization failed (will continue without IPFS):',
      //     error instanceof Error ? error.message : 'Unknown error');
      // }
    } else {
      console.log('ℹ️  IPFS disabled - no Pinata credentials provided');
      console.log('ℹ️  Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET to enable IPFS storage');
    }

    // Make services available globally (optional - for easy access in controllers)
    // (global as any).dbService = dbService;
    // (global as any).ipfsService = ipfsService;

    // Start Express server
    app.listen(PORT, () => {
      console.log('\n✅ TruthChain Testnet API started successfully!\n');
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Network: ${process.env.NETWORK || 'testnet'} 🧪`);
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
      console.log(`📖 Docs: http://localhost:${PORT}/`);
      console.log(`\n💾 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
      console.log(`📦 IPFS: Disabled`);
      console.log(`\n🧪 Testnet mode: Debug endpoints enabled\n`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      try {
        await mongoose.disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('\n❌ Failed to start server:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;



// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import apiRoutes from '../routes/index';


// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(helmet()); // Security headers
// app.use(cors()); // Enable CORS for extension

// app.use(morgan('combined')); // Request logging
// app.use(express.json({ limit: '1mb' })); // Parse JSON bodies
// app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// // API Routes
// app.use('/api', apiRoutes);

// // Root endpoint
// app.get('/', (_req: express.Request, res: express.Response) => {
//   res.json({
//     name: 'TruthChain API',
//     version: '1.0.0',
//     description: 'Decentralized content verification system for Twitter',
//     endpoints: {
//       health: '/api/health',
//       register: 'POST /api/register',
//       verify: 'POST /api/verify',
//       quickVerify: 'GET /api/verify/:hash',
//       batchVerify: 'POST /api/verify/batch',
//       checkRegistration: 'POST /api/check-registration'
//     },
//   });
// });

// // Error handling middleware
// app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
//   console.error('Unhandled error:', err);
  
//   res.status(500).json({
//     success: false,
//     message: 'Internal server error',
//     error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
//   });
// });

// // 404 handler
// app.use('/*', (_req: express.Request, res: express.Response) => {
//   res.status(404).json({
//     success: false,
//     message: 'Endpoint not found',
//     availableEndpoints: [
//       'GET /',
//       'GET /api/health',
//       'POST /api/register',
//       'POST /api/verify',
//       'GET /api/verify/:hash'
//     ]
//   });
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`TruthChain API server running on port ${PORT}`);
//   console.log(`Health check: http://localhost:${PORT}/api/health`);
//   console.log(`📖 API docs: http://localhost:${PORT}/`);
// });

// export default app;