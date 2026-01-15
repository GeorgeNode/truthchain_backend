"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
class DatabaseService {
    constructor(config) {
        this.isConnected = false;
        this.connectionString = config.uri;
    }
    /**
     * Get singleton instance
     */
    static getInstance(config) {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService(config);
        }
        return DatabaseService.instance;
    }
    /**
     * Connect to MongoDB
     */
    async connect() {
        if (this.isConnected) {
            console.log('Already connected to MongoDB');
            return;
        }
        try {
            await mongoose_1.default.connect(this.connectionString, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            this.isConnected = true;
            console.log('✅ MongoDB connected successfully');
            // Handle connection events
            mongoose_1.default.connection.on('error', (error) => {
                console.error('MongoDB connection error:', error);
                this.isConnected = false;
            });
            mongoose_1.default.connection.on('disconnected', () => {
                console.warn('MongoDB disconnected');
                this.isConnected = false;
            });
            mongoose_1.default.connection.on('reconnected', () => {
                console.log('MongoDB reconnected');
                this.isConnected = true;
            });
        }
        catch (error) {
            console.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }
    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        if (!this.isConnected) {
            return;
        }
        try {
            await mongoose_1.default.disconnect();
            this.isConnected = false;
            console.log('MongoDB disconnected');
        }
        catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }
    /**
     * Check if database is connected
     */
    getConnectionStatus() {
        return this.isConnected && mongoose_1.default.connection.readyState === 1;
    }
    /**
     * Get database statistics
     */
    async getStats() {
        try {
            const db = mongoose_1.default.connection.db;
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
        }
        catch (error) {
            console.error('Error getting database stats:', error);
            throw error;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { healthy: false, message: 'Not connected to database' };
            }
            // Perform a simple query to check connection
            await mongoose_1.default.connection.db?.admin().ping();
            return { healthy: true, message: 'Database connection is healthy' };
        }
        catch (error) {
            return {
                healthy: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Clean up expired data
     */
    async cleanup() {
        try {
            // Clean expired sessions
            const users = await models_1.User.find({});
            for (const user of users) {
                if (typeof user.cleanExpiredSessions === 'function') {
                    await user.cleanExpiredSessions();
                }
            }
            // Clean expired verification cache (MongoDB TTL will handle this automatically)
            if (typeof models_1.VerificationCache.cleanExpired === 'function') {
                await models_1.VerificationCache.cleanExpired();
            }
            console.log('Database cleanup completed');
        }
        catch (error) {
            console.error('Error during database cleanup:', error);
        }
    }
    /**
     * Get models (for easy access)
     */
    getModels() {
        return {
            User: models_1.User,
            Registration: models_1.Registration,
            VerificationCache: models_1.VerificationCache,
            Analytics: models_1.Analytics
        };
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=DatabaseService.js.map