import mongoose, { Document, Schema } from 'mongoose';

export interface IVerificationResult {
  isRegistered: boolean;
  registrationDate?: Date;
  authorWallet?: string;
  bnsName?: string;  // Added: BNS name from registration
  bnsStatus?: 'valid' | 'transferred' | 'no-longer-owned';  // Added: BNS validation status
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

const VerificationResultSchema = new Schema<IVerificationResult>({
  isRegistered: { type: Boolean, required: true },
  registrationDate: { type: Date },
  authorWallet: { type: String, uppercase: true },
  bnsName: { type: String },  // Added: BNS name from registration
  bnsStatus: { 
    type: String, 
    enum: ['valid', 'transferred', 'no-longer-owned'],
    default: 'valid'
  },
  txId: { type: String },
  blockHeight: { type: Number },
  ipfsCid: { type: String }
}, { _id: false });

const VerificationCacheSchema = new Schema<IVerificationCache>({
  contentHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true
  },
  result: {
    type: VerificationResultSchema,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  hits: {
    type: Number,
    default: 1
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'verification_cache'
});

// TTL index to automatically delete expired cache entries
VerificationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
VerificationCacheSchema.methods.incrementHits = function() {
  this.hits += 1;
  this.lastAccessed = new Date();
  return this.save();
};

// Statics
VerificationCacheSchema.statics.findByHash = function(contentHash: string) {
  return this.findOne({
    contentHash: contentHash.toLowerCase(),
    expiresAt: { $gt: new Date() }
  });
};

VerificationCacheSchema.statics.cleanExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

export const VerificationCache = (mongoose.models.VerificationCache || mongoose.model<IVerificationCache>(
  'VerificationCache',
  VerificationCacheSchema
)) as mongoose.Model<IVerificationCache>;
