import mongoose, { Document, Schema } from 'mongoose';

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
  registrationId?: string;
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
  bnsName?: string;  // Full BNS name (e.g., "henryno.btc")
  
  // BNS Validation (Hybrid Approach)
  lastBnsValidation?: Date;  // Last time we validated BNS ownership
  bnsStatus?: 'valid' | 'transferred' | 'no-longer-owned';  // Current BNS status
  currentBnsOwner?: string;  // Current wallet owning the BNS (if transferred)
  bnsTransferredAt?: Date;  // When transfer was detected
  
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

const ContentDataSchema = new Schema<IContentData>({
  type: {
    type: String,
    enum: ['tweet', 'article', 'image', 'video', 'document', 'other'],
    required: true
  },
  text: { type: String },
  preview: { type: String, maxlength: 500 },
  url: { type: String },
  twitterHandle: { type: String },
  imageUrl: { type: String },
  videoUrl: { type: String },
  title: { type: String },
  author: { type: String }
}, { _id: false });

const BlockchainDataSchema = new Schema<IBlockchainData>({
  txId: { type: String, index: true, sparse: true },
  registrationId: { type: String, index: true, sparse: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
    required: true
  },
  blockHeight: { type: Number },
  confirmations: { type: Number, default: 0 },
  timestamp: { type: Date },
  error: { type: String }
}, { _id: false });

const IPFSDataSchema = new Schema<IIPFSData>({
  cid: { type: String, index: true, sparse: true },
  gateway: { type: String },
  pinned: { type: Boolean, default: false },
  size: { type: Number },
  uploadedAt: { type: Date }
}, { _id: false });

const AnalyticsSchema = new Schema<IAnalytics>({
  views: { type: Number, default: 0 },
  verifications: { type: Number, default: 0 },
  lastViewed: { type: Date },
  lastVerified: { type: Date }
}, { _id: false });

const RegistrationSchema = new Schema<IRegistration>({
  contentHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true
  },
  authorWallet: {
    type: String,
    required: true,
    index: true,
    uppercase: true
  },
  bnsName: {
    type: String,
    index: true,
    sparse: true
  },
  // BNS Validation Fields
  lastBnsValidation: {
    type: Date,
    index: true
  },
  bnsStatus: {
    type: String,
    enum: ['valid', 'transferred', 'no-longer-owned'],
    default: 'valid'
  },
  currentBnsOwner: {
    type: String,
    uppercase: true
  },
  bnsTransferredAt: {
    type: Date
  },
  content: {
    type: ContentDataSchema,
    required: true
  },
  blockchain: {
    type: BlockchainDataSchema,
    required: true,
    default: () => ({ status: 'pending', confirmations: 0 })
  },
  ipfs: {
    type: IPFSDataSchema,
    default: () => ({ pinned: false })
  },
  analytics: {
    type: AnalyticsSchema,
    default: () => ({ views: 0, verifications: 0 })
  },
  metadata: {
    userAgent: { type: String },
    ipAddress: { type: String },
    source: {
      type: String,
      enum: ['extension', 'web', 'mobile', 'api'],
      required: true
    },
    platform: { type: String }
  }
}, {
  timestamps: true,
  collection: 'registrations'
});

// Compound indexes for common queries
RegistrationSchema.index({ authorWallet: 1, createdAt: -1 });
RegistrationSchema.index({ 'blockchain.status': 1, createdAt: -1 });
RegistrationSchema.index({ 'blockchain.txId': 1 }, { sparse: true });
RegistrationSchema.index({ 'content.type': 1, createdAt: -1 });
RegistrationSchema.index({ createdAt: -1 });

// Methods
RegistrationSchema.methods.updateBlockchainStatus = function(
  status: 'pending' | 'confirmed' | 'failed',
  data?: Partial<IBlockchainData>
) {
  this.blockchain.status = status;
  if (data) {
    Object.assign(this.blockchain, data);
  }
  return this.save();
};

RegistrationSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  this.analytics.lastViewed = new Date();
  return this.save();
};

RegistrationSchema.methods.incrementVerifications = function() {
  this.analytics.verifications += 1;
  this.analytics.lastVerified = new Date();
  return this.save();
};

RegistrationSchema.methods.setIPFSData = function(ipfsData: Partial<IIPFSData>) {
  Object.assign(this.ipfs, ipfsData);
  this.ipfs.uploadedAt = new Date();
  return this.save();
};

// Statics
RegistrationSchema.statics.findByWallet = function(walletAddress: string) {
  return this.find({ authorWallet: walletAddress.toUpperCase() })
    .sort({ createdAt: -1 });
};

RegistrationSchema.statics.findByHash = function(contentHash: string) {
  return this.findOne({ contentHash: contentHash.toLowerCase() });
};

RegistrationSchema.statics.findByTxId = function(txId: string) {
  return this.findOne({ 'blockchain.txId': txId });
};

RegistrationSchema.statics.getPendingRegistrations = function() {
  return this.find({ 'blockchain.status': 'pending' })
    .sort({ createdAt: 1 });
};

export const Registration = (mongoose.models.Registration || mongoose.model<IRegistration>('Registration', RegistrationSchema)) as mongoose.Model<IRegistration>;
