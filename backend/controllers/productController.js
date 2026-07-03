const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_PRODUCT_IMAGES } = require('../middleware/uploadMiddleware');

const SELLER_FIELDS = 'name email branch year avatar';

const uploadProductImage = async (file) => {
    const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const uploadResponse = await cloudinary.uploader.upload(fileBase64, {
        folder: 'campusshare_products',
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }],
        eager: [{ width: 600, height: 600, crop: 'fill', gravity: 'auto', quality: 'auto:good', fetch_format: 'auto' }]
    });

    const thumbUrl = uploadResponse.eager?.[0]?.secure_url || uploadResponse.secure_url;
    return { url: uploadResponse.secure_url, thumbUrl, cloudinaryId: uploadResponse.public_id };
};

const createProduct = asyncHandler(async (req, res) => {
    const { title, price, category, condition, location, desc } = req.body;
    const files = req.files || [];

    if (!files.length) {
        return res.status(400).json({ success: false, message: 'Please upload at least one product image' });
    }
    if (files.length > MAX_PRODUCT_IMAGES) {
        return res.status(400).json({ success: false, message: `You can upload up to ${MAX_PRODUCT_IMAGES} images` });
    }

    const images = await Promise.all(files.map(uploadProductImage));
    const product = await Product.create({ title, price, category, condition, location, desc, images, seller: req.user._id });
    const populated = await product.populate('seller', SELLER_FIELDS);

    res.status(201).json({ success: true, message: 'Product listed successfully!', data: populated });
});

const getAllProducts = asyncHandler(async (req, res) => {
    const { search, category, seller } = req.query;
    const query = {};

    if (search) query.title = { $regex: search, $options: 'i' };
    if (category && category !== 'all') query.category = category;

    if (seller === 'me') {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        query.seller = req.user._id;
    } else if (seller) {
        query.seller = seller;
    }

    const products = await Product.find(query).populate('seller', SELLER_FIELDS).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: products.length, data: products });
});

const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate('seller', SELLER_FIELDS);

    if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
});

const requireOwnedProduct = async (req, res, action) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return null;
    }
    if (product.seller.toString() !== req.user._id.toString()) {
        res.status(401).json({ success: false, message: `User not authorized to ${action} this listing` });
        return null;
    }
    return product;
};

const updateProduct = asyncHandler(async (req, res) => {
    const product = await requireOwnedProduct(req, res, 'edit');
    if (!product) return;

    const fields = ['title', 'price', 'category', 'condition', 'location', 'desc', 'availability'];
    fields.forEach((field) => {
        if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    if (req.body.removeImages !== undefined) {
        let removeIds = [];
        try { removeIds = JSON.parse(req.body.removeImages); } catch (e) { removeIds = []; }

        if (Array.isArray(removeIds) && removeIds.length) {
            const toRemove = product.images.filter((img) => removeIds.includes(img.cloudinaryId));
            product.images = product.images.filter((img) => !removeIds.includes(img.cloudinaryId));
            toRemove.forEach((img) => cloudinary.uploader.destroy(img.cloudinaryId).catch(() => {}));
        }
    }

    const files = req.files || [];
    if (files.length) {
        if (product.images.length + files.length > MAX_PRODUCT_IMAGES) {
            return res.status(400).json({ success: false, message: `A listing can have at most ${MAX_PRODUCT_IMAGES} images` });
        }
        product.images = [...product.images, ...(await Promise.all(files.map(uploadProductImage)))];
    }

    if (!product.images.length) {
        return res.status(400).json({ success: false, message: 'A listing must have at least one image' });
    }

    const updated = await product.save();
    const populated = await updated.populate('seller', SELLER_FIELDS);
    res.status(200).json({ success: true, message: 'Listing updated successfully', data: populated });
});

const deleteProduct = asyncHandler(async (req, res) => {
    const product = await requireOwnedProduct(req, res, 'delete');
    if (!product) return;

    await product.deleteOne();
    product.images?.forEach((img) => cloudinary.uploader.destroy(img.cloudinaryId).catch(() => {}));

    res.status(200).json({ success: true, message: 'Product listing removed successfully' });
});

module.exports = { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct };
