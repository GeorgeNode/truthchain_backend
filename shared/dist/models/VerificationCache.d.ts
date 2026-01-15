import mongoose, { Document } from 'mongoose';
export interface IVerificationResult {
    isRegistered: boolean;
    registrationDate?: Date;
    authorWallet?: string;
    txId?: string;
    blockHeight?: number;
    ipfsCid?: string;
}
export interface IVerificationCache extends Document {
    contentHash: string;
    result: IVerificationResult;
    expiresAt: Date;
    hits: number;
    lastAccessed: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const VerificationCache: mongoose.Model<IVerificationCache, {}, {}, {}, mongoose.Document<unknown, {}, IVerificationCache, {}, {}> & IVerificationCache & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=VerificationCache.d.ts.map