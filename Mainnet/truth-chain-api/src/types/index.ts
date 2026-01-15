import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from '../routes/index';


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for extension

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
      register: 'POST /api/register',
      verify: 'POST /api/verify',
      quickVerify: 'GET /api/verify/:hash',
      batchVerify: 'POST /api/verify/batch',
      checkRegistration: 'POST /api/check-registration'
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
app.use('/*', (_req: express.Request, res: express.Response) => {
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

// Start server
app.listen(PORT, () => {
  console.log(`TruthChain API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/`);
});

export default app;