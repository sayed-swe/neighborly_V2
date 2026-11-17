import mongoose from 'mongoose';

export const ROLES = ['resident', 'provider', 'moderator', 'admin'];
export const SELF_SIGNUP_ROLES = ['resident', 'provider'];
export const SERVICE_CATEGORIES = [
  'electrician', 'plumber', 'cleaning', 'tutoring', 'carpentry', 'painting',
  'appliance-repair', 'beauty', 'catering', 'moving', 'it-support', 'other',
];

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
        message: 'Invalid coordinates',
      },
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'resident', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    bio: { type: String, trim: true, maxlength: 280, default: '' },
    avatarUrl: { type: String, maxlength: 500 },

    // Sign-in methods. Google-created accounts have no password until they set one via reset.
    googleId: { type: String, unique: true, sparse: true, select: false },
    hasPassword: { type: Boolean, default: true },

    provider: {
      businessName: { type: String, trim: true, maxlength: 80 },
      category: { type: String, enum: SERVICE_CATEGORIES },
      description: { type: String, trim: true, maxlength: 500 },
    },

    location: {
      home: { type: pointSchema, select: false }, // exact; never leaves the server
      approx: { type: pointSchema }, // snapped ~500 m grid; safe to show
      areaName: { type: String, trim: true, maxlength: 120 },
      radiusKm: { type: Number, min: 1, max: 10, default: 3 },
    },
    onboardingComplete: { type: Boolean, default: false },

    // Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },

    // Password reset
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: Date,

    // Brute-force protection
    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },

    // Incremented to invalidate every outstanding access token immediately
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.emailVerifyTokenHash;
        delete ret.emailVerifyExpires;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.failedLoginCount;
        delete ret.lockUntil;
        delete ret.tokenVersion;
        delete ret.googleId;
        if (ret.location) delete ret.location.home;
        return ret;
      },
    },
  },
);

userSchema.index({ 'location.home': '2dsphere' });
userSchema.index({ 'location.approx': '2dsphere' });
userSchema.index({ createdAt: -1 });

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

export const User = mongoose.model('User', userSchema);
