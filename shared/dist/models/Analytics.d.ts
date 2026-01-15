import mongoose, { Document } from 'mongoose';
export interface IDailyStats {
    registrations: number;
    verifications: number;
    uniqueUsers: number;
    ipfsUploads: number;
    failedTransactions: number;
}
export interface IAnalyticsEntryMethods {
}
export interface IAnalyticsEntryModel extends mongoose.Model<IAnalyticsEntry, {}, IAnalyticsEntryMethods> {
    getOrCreateToday(): Promise<IAnalyticsEntry>;
    incrementRegistrations(): Promise<IAnalyticsEntry>;
    incrementVerifications(): Promise<IAnalyticsEntry>;
    incrementIPFSUploads(): Promise<IAnalyticsEntry>;
}
export interface IAnalyticsEntry extends Document {
    date: Date;
    stats: IDailyStats;
    topContentTypes: Array<{
        type: string;
        count: number;
    }>;
    topWallets: Array<{
        wallet: string;
        count: number;
    }>;
    averageConfirmationTime?: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Analytics: IAnalyticsEntryModel;
//# sourceMappingURL=Analytics.d.ts.map