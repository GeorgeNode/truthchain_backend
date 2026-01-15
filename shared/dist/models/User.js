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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SessionSchema = new mongoose_1.Schema({
    sessionId: { type: String, required: true, index: true },
    source: { type: String, enum: ['extension', 'web', 'mobile'], required: true },
    walletType: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    lastActivity: { type: Date, default: Date.now },
    active: { type: Boolean, default: true }
});
const UserStatsSchema = new mongoose_1.Schema({
    totalRegistrations: { type: Number, default: 0 },
    confirmedRegistrations: { type: Number, default: 0 },
    pendingRegistrations: { type: Number, default: 0 },
    failedRegistrations: { type: Number, default: 0 },
    totalVerifications: { type: Number, default: 0 },
    lastRegistration: { type: Date },
    lastVerification: { type: Date }
}, { _id: false });
const UserSchema = new mongoose_1.Schema({
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        trim: true
    },
    walletType: {
        type: String,
        enum: ['xverse', 'leather', 'hiro', 'other']
    },
    bnsName: {
        type: String,
        sparse: true,
        index: true
    },
    email: {
        type: String,
        sparse: true,
        lowercase: true,
        trim: true
    },
    sessions: [SessionSchema],
    stats: {
        type: UserStatsSchema,
        default: () => ({
            totalRegistrations: 0,
            confirmedRegistrations: 0,
            pendingRegistrations: 0,
            failedRegistrations: 0,
            totalVerifications: 0
        })
    },
    preferences: {
        notifications: { type: Boolean, default: true },
        publicProfile: { type: Boolean, default: false },
        autoStoreIPFS: { type: Boolean, default: false }
    },
    metadata: {
        firstSeen: { type: Date, default: Date.now },
        lastSeen: { type: Date, default: Date.now },
        userAgent: { type: String },
        platform: { type: String }
    }
}, {
    timestamps: true,
    collection: 'users'
});
// Indexes for performance
UserSchema.index({ 'sessions.sessionId': 1 });
UserSchema.index({ 'metadata.lastSeen': -1 });
UserSchema.index({ createdAt: -1 });
// Methods
UserSchema.methods.addSession = function (session) {
    this.sessions.push({
        sessionId: session.sessionId,
        source: session.source,
        walletType: session.walletType,
        createdAt: new Date(),
        expiresAt: session.expiresAt,
        lastActivity: new Date(),
        active: true
    });
    this.metadata.lastSeen = new Date();
    return this.save();
};
UserSchema.methods.invalidateSession = function (sessionId) {
    const session = this.sessions.find((s) => s.sessionId === sessionId);
    if (session) {
        session.active = false;
    }
    return this.save();
};
UserSchema.methods.cleanExpiredSessions = function () {
    const now = new Date();
    this.sessions = this.sessions.filter((s) => s.expiresAt > now);
    return this.save();
};
exports.User = mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=User.js.map