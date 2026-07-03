const Wishlist = require('../models/Wishlist');
const asyncHandler = require('../utils/asyncHandler');

const getOrCreateWishlist = async (userId, populate) => {
    let query = Wishlist.findOne({ user: userId });
    if (populate) query = query.populate(populate);
    return (await query) || Wishlist.create({ user: userId, products: [] });
};

const getWishlist = asyncHandler(async (req, res) => {
    const wishlist = await getOrCreateWishlist(req.user._id, {
        path: 'products',
        populate: { path: 'seller', select: 'name email' }
    });

    res.status(200).json({ success: true, data: wishlist.products });
});

const addToWishlist = asyncHandler(async (req, res) => {
    const productId = req.params.productId;
    const wishlist = await getOrCreateWishlist(req.user._id);

    if (wishlist.products.includes(productId)) {
        return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    res.status(200).json({ success: true, message: 'Added to wishlist successfully!' });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
    const productId = req.params.productId;
    const wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
        return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.products = wishlist.products.filter((id) => id.toString() !== productId);
    await wishlist.save();

    res.status(200).json({ success: true, message: 'Removed from wishlist successfully' });
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
