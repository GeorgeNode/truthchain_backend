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
exports.Analytics = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DailyStatsSchema = new mongoose_1.Schema({
    registrations: { type: Number, default: 0 },
    verifications: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    ipfsUploads: { type: Number, default: 0 },
    failedTransactions: { type: Number, default: 0 }
}, { _id: false });
const AnalyticsSchema = new mongoose_1.Schema({
    date: {
        type: Date,
        required: true,
        unique: true,
        index: true
    },
    stats: {
        type: DailyStatsSchema,
        required: true,
        default: () => ({
            registrations: 0,
            verifications: 0,
            uniqueUsers: 0,
            ipfsUploads: 0,
            failedTransactions: 0
        })
    },
    topContentTypes: [{
            type: { type: String, required: true },
            count: { type: Number, required: true }
        }],
    topWallets: [{
            wallet: { type: String, required: true },
            count: { type: Number, required: true }
        }],
    averageConfirmationTime: { type: Number }
}, {
    timestamps: true,
    collection: 'analytics'
});
// Indexes
AnalyticsSchema.index({ date: -1 });
// Statics
AnalyticsSchema.statics.getOrCreateToday = async function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let entry = await this.findOne({ date: today });
    if (!entry) {
        entry = await this.create({
            date: today,
            stats: {
                registrations: 0,
                verifications: 0,
                uniqueUsers: 0,
                ipfsUploads: 0,
                failedTransactions: 0
            },
            topContentTypes: [],
            topWallets: []
        });
    }
    return entry;
};
AnalyticsSchema.statics.incrementRegistrations = async function () {
    const entry = await this.getOrCreateToday();
    entry.stats.registrations += 1;
    return entry.save();
};
AnalyticsSchema.statics.incrementVerifications = async function () {
    const entry = await this.getOrCreateToday();
    entry.stats.verifications += 1;
    return entry.save();
};
AnalyticsSchema.statics.incrementIPFSUploads = async function () {
    const entry = await this.getOrCreateToday();
    entry.stats.ipfsUploads += 1;
    return entry.save();
};
AnalyticsSchema.statics.getDateRange = function (startDate, endDate) {
    return this.find({
        date: {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ date: 1 });
};
exports.Analytics = mongoose_1.default.model('Analytics', AnalyticsSchema);
//# sourceMappingURL=Analytics.js.map