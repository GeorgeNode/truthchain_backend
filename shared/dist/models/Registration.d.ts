import mongoose, { Document } from 'mongoose';
export interface IContentData {
    type: 'tweet' | 'article' | 'image' | 'video' | 'document' | 'other';
    text?: string;
    preview?: string;
    url?: string;
    twitterHandle?: string;
    imageUrl?: string;
    videoUrl?: string;
    title?: string;
    author?: string;
}
export interface IBlockchainData {
    txId?: string;
    status: 'pending' | 'confirmed' | 'failed';
    blockHeight?: number;
    confirmations?: number;
    timestamp?: Date;
    error?: string;
}
export interface IIPFSData {
    cid?: string;
    gateway?: string;
    pinned: boolean;
    size?: number;
    uploadedAt?: Date;
}
export interface IAnalytics {
    views: number;
    verifications: number;
    lastViewed?: Date;
    lastVerified?: Date;
}
export interface IRegistration extends Document {
    contentHash: string;
    authorWallet: string;
    content: IContentData;
    blockchain: IBlockchainData;
    ipfs: IIPFSData;
    analytics: IAnalytics;
    metadata: {
        userAgent?: string;
        ipAddress?: string;
        source: 'extension' | 'web' | 'mobile' | 'api';
        platform?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const Registration: mongoose.Model<IRegistration, {}, {}, {}, mongoose.Document<unknown, {}, IRegistration, {}, {}> & IRegistration & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Registration.d.ts.map