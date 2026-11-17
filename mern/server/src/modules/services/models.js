import mongoose from 'mongoose';
import { SERVICE_CATEGORIES } from '../users/user.model.js';

const { Schema } = mongoose;
const pointSchema = new Schema({ type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } }, { _id: false });

const serviceSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, trim: true, required: true, minlength: 2, maxlength: 100 },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 1500, default: '' },
    priceInfo: { type: String, trim: true, maxlength: 120 },
    hours: { type: String, trim: true, maxlength: 120 },
    location: { type: pointSchema, required: true }, // provider's approximate area
    areaName: { type: String, maxlength: 120 },
    verified: { type: Boolean, default: false }, // set by admins only
    active: { type: Boolean, default: true },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
serviceSchema.index({ location: '2dsphere' });
serviceSchema.index({ name: 'text', description: 'text' });
export const Service = mongoose.model('Service', serviceSchema);

const reviewSchema = new Schema(
  {
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true },
);
reviewSchema.index({ service: 1, author: 1 }, { unique: true }); // one review per member per service
export const Review = mongoose.model('Review', reviewSchema);

export const REQUEST_STATUS = ['pending', 'accepted', 'declined', 'done', 'cancelled'];
const requestSchema = new Schema(
  {
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    details: { type: String, trim: true, required: true, minlength: 5, maxlength: 1000 },
    preferredTime: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: REQUEST_STATUS, default: 'pending', index: true },
    providerNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);
export const ServiceRequest = mongoose.model('ServiceRequest', requestSchema);
