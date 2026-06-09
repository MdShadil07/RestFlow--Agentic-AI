import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize database connection
import './config/database';

// Initialize multi-agent system
import { initializeAllAgents } from './lib/agent-registry';

// Import routes
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sessionRoutes from './routes/session.routes';
import roadmapRoutes from './routes/roadmap.routes';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Rate limiting to prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/signup attempts per 15 minutes
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// API Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/v1/auth', limiter, authLimiter, authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/roadmaps', roadmapRoutes);

// API Root endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TaskScheduler API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      dashboard: '/api/v1/dashboard',
      health: '/api/health'
    }
  });
});

// 404 handler for API routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.AUTH_PORT || 5001;
app.listen(PORT, async () => {
  console.log(`=================================`);
  console.log(`TaskScheduler Auth API Server`);
  console.log(`=================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  console.log(`=================================`);

  // Initialize multi-agent system
  try {
    await initializeAllAgents();
    console.log('[AuthServer] Multi-agent system ready');
  } catch (error) {
    console.error('[AuthServer] Failed to initialize agents:', error);
  }
});
