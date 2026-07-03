const mongoose = require('mongoose');

const ProductImageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    thumbUrl: { type: String },
    cloudinaryId: { type: String, required: true }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    condition: { type: String, enum: ['New', 'Used'], default: 'Used' },
    location: { type: String, required: true },
    desc: { type: String, required: true },
   
    images: {
        type: [ProductImageSchema],
        required: true,
        validate: {
            validator: (v) => Array.isArray(v) && v.length > 0,
            message: 'At least one product image is required'
        }
    },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    availability: { type: String, enum: ['In Stock', 'Sold'], default: 'In Stock' }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });


ProductSchema.virtual('imageUrl').get(function () {
    return this.images && this.images.length ? this.images[0].url : '';
});
ProductSchema.virtual('thumbUrl').get(function () {
    return this.images && this.images.length ? (this.images[0].thumbUrl || this.images[0].url) : '';
});

module.exports = mongoose.model('Product', ProductSchema);