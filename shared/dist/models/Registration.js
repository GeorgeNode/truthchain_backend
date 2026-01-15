"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Registration = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ContentDataSchema = new mongoose_1.Schema({
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
const BlockchainDataSchema = new mongoose_1.Schema({
    txId: { type: String, index: true, sparse: true },
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
const IPFSDataSchema = new mongoose_1.Schema({
    cid: { type: String, index: true, sparse: true },
    gateway: { type: String },
    pinned: { type: Boolean, default: false },
    size: { type: Number },
    uploadedAt: { type: Date }
}, { _id: false });
const AnalyticsSchema = new mongoose_1.Schema({
    views: { type: Number, default: 0 },
    verifications: { type: Number, default: 0 },
    lastViewed: { type: Date },
    lastVerified: { type: Date }
}, { _id: false });
const RegistrationSchema = new mongoose_1.Schema({
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
RegistrationSchema.methods.updateBlockchainStatus = function (status, data) {
    this.blockchain.status = status;
    if (data) {
        Object.assign(this.blockchain, data);
    }
    return this.save();
};
RegistrationSchema.methods.incrementViews = function () {
    this.analytics.views += 1;
    this.analytics.lastViewed = new Date();
    return this.save();
};
RegistrationSchema.methods.incrementVerifications = function () {
    this.analytics.verifications += 1;
    this.analytics.lastVerified = new Date();
    return this.save();
};
RegistrationSchema.methods.setIPFSData = function (ipfsData) {
    Object.assign(this.ipfs, ipfsData);
    this.ipfs.uploadedAt = new Date();
    return this.save();
};
// Statics
RegistrationSchema.statics.findByWallet = function (walletAddress) {
    return this.find({ authorWallet: walletAddress.toUpperCase() })
        .sort({ createdAt: -1 });
};
RegistrationSchema.statics.findByHash = function (contentHash) {
    return this.findOne({ contentHash: contentHash.toLowerCase() });
};
RegistrationSchema.statics.findByTxId = function (txId) {
    return this.findOne({ 'blockchain.txId': txId });
};
RegistrationSchema.statics.getPendingRegistrations = function () {
    return this.find({ 'blockchain.status': 'pending' })
        .sort({ createdAt: 1 });
};
exports.Registration = mongoose_1.default.model('Registration', RegistrationSchema);
//# sourceMappingURL=Registration.js.map