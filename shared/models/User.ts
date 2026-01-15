import mongoose, { Document, Schema } from 'mongoose';

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
  twitterHandle?: string;
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

  // Methods
  addSession(session: Partial<ISession>): Promise<IUser>;
  invalidateSession(sessionId: string): Promise<IUser>;
  cleanExpiredSessions(): Promise<IUser>;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, required: true, index: true },
  source: { type: String, enum: ['extension', 'web', 'mobile'], required: true },
  walletType: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  lastActivity: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

const UserStatsSchema = new Schema<IUserStats>({
  totalRegistrations: { type: Number, default: 0 },
  confirmedRegistrations: { type: Number, default: 0 },
  pendingRegistrations: { type: Number, default: 0 },
  failedRegistrations: { type: Number, default: 0 },
  totalVerifications: { type: Number, default: 0 },
  lastRegistration: { type: Date },
  lastVerification: { type: Date }
}, { _id: false });

const UserSchema = new Schema<IUser>({
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
  twitterHandle: {
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
UserSchema.methods.addSession = function(session: Partial<ISession>) {
  this.sessions.push({
    sessionId: session.sessionId!,
    source: session.source!,
    walletType: session.walletType,
    createdAt: new Date(),
    expiresAt: session.expiresAt!,
    lastActivity: new Date(),
    active: true
  });
  this.metadata.lastSeen = new Date();
  return this.save();
};

UserSchema.methods.invalidateSession = function(sessionId: string) {
  const session = this.sessions.find((s: ISession) => s.sessionId === sessionId);
  if (session) {
    session.active = false;
  }
  return this.save();
};

UserSchema.methods.cleanExpiredSessions = function() {
  const now = new Date();
  this.sessions = this.sessions.filter((s: ISession) => s.expiresAt > now);
  return this.save();
};

export const User = (mongoose.models.User || mongoose.model<IUser>('User', UserSchema)) as mongoose.Model<IUser>;
