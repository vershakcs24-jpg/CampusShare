const express = require('express');
const router = express.Router();
const { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { MAX_PRODUCT_IMAGES } = upload;


router.get('/', optionalProtect, getAllProducts);
router.get('/:id', getProductById);


router.post('/', protect, upload.array('images', MAX_PRODUCT_IMAGES), createProduct);
router.put('/:id', protect, upload.array('images', MAX_PRODUCT_IMAGES), updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;
