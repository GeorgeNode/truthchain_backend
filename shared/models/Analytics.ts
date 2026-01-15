import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyStats {
  registrations: number;
  verifications: number;
  uniqueUsers: number;
  ipfsUploads: number;
  failedTransactions: number;
}

export interface IAnalyticsEntryMethods {}

export interface IAnalyticsEntryModel extends mongoose.Model<IAnalyticsEntry, {}, IAnalyticsEntryMethods> {
  getOrCreateToday(): Promise<IAnalyticsEntry>;
  incrementRegistrations(): Promise<IAnalyticsEntry>;
  incrementVerifications(): Promise<IAnalyticsEntry>;
  incrementIPFSUploads(): Promise<IAnalyticsEntry>;
}

export interface IAnalyticsEntry extends Document {
  date: Date;
  stats: IDailyStats;
  topContentTypes: Array<{ type: string; count: number }>;
  topWallets: Array<{ wallet: string; count: number }>;
  averageConfirmationTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyStatsSchema = new Schema<IDailyStats>({
  registrations: { type: Number, default: 0 },
  verifications: { type: Number, default: 0 },
  uniqueUsers: { type: Number, default: 0 },
  ipfsUploads: { type: Number, default: 0 },
  failedTransactions: { type: Number, default: 0 }
}, { _id: false });

const AnalyticsSchema = new Schema<IAnalyticsEntry, IAnalyticsEntryModel, IAnalyticsEntryMethods>({
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
AnalyticsSchema.statics.getOrCreateToday = async function() {
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

AnalyticsSchema.statics.incrementRegistrations = async function() {
  const entry = await this.getOrCreateToday();
  entry.stats.registrations += 1;
  return entry.save();
};

AnalyticsSchema.statics.incrementVerifications = async function() {
  const entry = await this.getOrCreateToday();
  entry.stats.verifications += 1;
  return entry.save();
};

AnalyticsSchema.statics.incrementIPFSUploads = async function() {
  const entry = await this.getOrCreateToday();
  entry.stats.ipfsUploads += 1;
  return entry.save();
};

AnalyticsSchema.statics.getDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

export const Analytics = (mongoose.models.Analytics || mongoose.model<IAnalyticsEntry, IAnalyticsEntryModel>('Analytics', AnalyticsSchema)) as mongoose.Model<IAnalyticsEntry, IAnalyticsEntryModel>;
