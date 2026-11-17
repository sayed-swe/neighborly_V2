import mongoose from 'mongoose';

/**
 * One document per issued refresh token. Tokens rotate on every refresh; rotated
 * tokens stay (revoked) so that re-use of an old token can be detected, at which
 * point the whole family (that device's login) is revoked.
 */
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: { type: String, enum: ['rotated', 'logout', 'logout-all', 'reuse', 'password', 'admin', 'deleted'] },
    userAgent: { type: String, maxlength: 300 },
    ip: String,
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup

export const Session = mongoose.model('Session', sessionSchema);
