import mongoose from 'mongoose';
import { User, Registration, VerificationCache, Analytics } from '../models';

export interface DatabaseConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private isConnected: boolean = false;
  private connectionString: string;

  private constructor(config: DatabaseConfig) {
    this.connectionString = config.uri;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config: DatabaseConfig): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }

  /**
   * Connect to MongoDB
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Already connected to MongoDB');
      return;
    }

    try {
      await mongoose.connect(this.connectionString, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<any> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database not connected');
      }

      const stats = await db.stats();
      const collections = await db.listCollections().toArray();

      return {
        connected: this.isConnected,
        database: db.databaseName,
        collections: collections.map(c => c.name),
        stats: {
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexes: stats.indexes,
          objects: stats.objects
        }
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      if (!this.isConnected) {
        return { healthy: false, message: 'Not connected to database' };
      }

      // Perform a simple query to check connection
      await mongoose.connection.db?.admin().ping();

      return { healthy: true, message: 'Database connection is healthy' };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clean up expired data
   */
  public async cleanup(): Promise<void> {
    try {
      // Clean expired sessions
      const users = await User.find({});
      for (const user of users) {
        if (typeof (user as any).cleanExpiredSessions === 'function') {
          await (user as any).cleanExpiredSessions();
        }
      }

      // Clean expired verification cache (MongoDB TTL will handle this automatically)
      if (typeof (VerificationCache as any).cleanExpired === 'function') {
        await (VerificationCache as any).cleanExpired();
      }

      console.log('Database cleanup completed');
    } catch (error) {
      console.error('Error during database cleanup:', error);
    }
  }

  /**
   * Get models (for easy access)
   */
  public getModels() {
    return {
      User,
      Registration,
      VerificationCache,
      Analytics
    };
  }
}
