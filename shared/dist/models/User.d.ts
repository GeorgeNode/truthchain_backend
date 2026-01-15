import mongoose, { Document } from 'mongoose';
export interface ISession {
    sessionId: string;
    source: 'extension' | 'web' | 'mobile';
    walletType?: string;
    createdAt: Date;
    expiresAt: Date;
    lastActivity: Date;
    active: boolean;
}
export interface IUserStats {
    totalRegistrations: number;
    confirmedRegistrations: number;
    pendingRegistrations: number;
    failedRegistrations: number;
    totalVerifications: number;
    lastRegistration?: Date;
    lastVerification?: Date;
}
export interface IUser extends Document {
    walletAddress: string;
    walletType?: 'xverse' | 'leather' | 'hiro' | 'other';
    bnsName?: string;
    email?: string;
    sessions: ISession[];
    stats: IUserStats;
    preferences: {
        notifications: boolean;
        publicProfile: boolean;
        autoStoreIPFS: boolean;
    };
    metadata: {
        firstSeen: Date;
        lastSeen: Date;
        userAgent?: string;
        platform?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map