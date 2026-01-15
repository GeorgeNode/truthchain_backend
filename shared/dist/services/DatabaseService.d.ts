import mongoose from 'mongoose';
export interface DatabaseConfig {
    uri: string;
    options?: mongoose.ConnectOptions;
}
export declare class DatabaseService {
    private static instance;
    private isConnected;
    private connectionString;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(config: DatabaseConfig): DatabaseService;
    /**
     * Connect to MongoDB
     */
    connect(): Promise<void>;
    /**
     * Disconnect from MongoDB
     */
    disconnect(): Promise<void>;
    /**
     * Check if database is connected
     */
    getConnectionStatus(): boolean;
    /**
     * Get database statistics
     */
    getStats(): Promise<any>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        message: string;
    }>;
    /**
     * Clean up expired data
     */
    cleanup(): Promise<void>;
    /**
     * Get models (for easy access)
     */
    getModels(): {
        User: mongoose.Model<import("../models").IUser, {}, {}, {}, mongoose.Document<unknown, {}, import("../models").IUser, {}, {}> & import("../models").IUser & Required<{
            _id: unknown;
        }> & {
            __v: number;
        }, any>;
        Registration: mongoose.Model<import("../models").IRegistration, {}, {}, {}, mongoose.Document<unknown, {}, import("../models").IRegistration, {}, {}> & import("../models").IRegistration & Required<{
            _id: unknown;
        }> & {
            __v: number;
        }, any>;
        VerificationCache: mongoose.Model<import("../models").IVerificationCache, {}, {}, {}, mongoose.Document<unknown, {}, import("../models").IVerificationCache, {}, {}> & import("../models").IVerificationCache & Required<{
            _id: unknown;
        }> & {
            __v: number;
        }, any>;
        Analytics: import("../models/Analytics").IAnalyticsEntryModel;
    };
}
//# sourceMappingURL=DatabaseService.d.ts.map