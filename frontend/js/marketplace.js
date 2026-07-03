document.addEventListener("DOMContentLoaded", () => {
    Auth.requireAuth();
    refreshNavAvatar();
    const productsGrid = $("productsGrid");
    const categoryItems = document.querySelectorAll(".category-item");
    const searchBar = $("searchBar");
    let activeCategory = "all";
    let searchTimeout = null;
    const NEW_LISTING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

    function isNewListing(createdAt) {
        if (!createdAt) return false;
        return (Date.now() - new Date(createdAt).getTime()) < NEW_LISTING_WINDOW_MS;
    }

    function productMedia(product) {
        const src = product.thumbUrl || product.imageUrl;
        return src
            ? `<img src="${src}" alt="${product.title}" loading="lazy" onerror="csImgFallback(this)">`
            : `<div class="img-placeholder"><span class="ph-icon">📦</span><span class="ph-text">No Image</span></div>`;
    }

    function renderProducts(items) {
        productsGrid.innerHTML = "";
        if (items.length === 0) {
            productsGrid.innerHTML = "<p style='color:#718096; grid-column: 1/-1; text-align: center; margin-top: 20px;'>No items found matching your request.</p>";
            return;
        }
        const sorted = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sorted.forEach(product => {
            const card = document.createElement("div");
            card.classList.add("product-card");
            card.onclick = () => window.location.href = `product.html?id=${product._id}`;
            const soldBadge = product.availability === "Sold"
                ? `<span class="product-tag" style="background:#fed7d7; color:#c53030; margin-left:6px;">SOLD</span>`
                : "";
            const newBadge = isNewListing(product.createdAt) ? `<span class="new-badge">NEW</span>` : "";
            card.innerHTML = `
                <div class="product-img">${productMedia(product)}${newBadge}</div>
                <div class="product-info">
                    <div class="product-price">₹${product.price}</div>
                    <div class="product-title">${product.title}</div>
                    <span class="product-tag">${product.category.toUpperCase()}</span>${soldBadge}
                </div>
            `;
            productsGrid.appendChild(card);
        });
    }

    async function fetchProducts() {
        productsGrid.innerHTML = "<p style='color:#718096; grid-column: 1/-1; text-align:center; margin-top:20px;'>Loading listings...</p>";
        try {
            const params = new URLSearchParams();
            if (activeCategory !== "all") params.set("category", activeCategory);
            const searchText = searchBar.value.trim();
            if (searchText) params.set("search", searchText);
            const res = await apiFetch(`/products?${params.toString()}`);
            renderProducts(res.data);
        } catch (err) {
            productsGrid.innerHTML = `<p style='color:#c53030; grid-column: 1/-1; text-align:center; margin-top:20px;'>${err.message}</p>`;
        }
    }
    fetchProducts();

    if (searchBar) {
        searchBar.addEventListener("input", () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(fetchProducts, 300);
        });
    }

    categoryItems.forEach(item => {
        item.addEventListener("click", () => {
            categoryItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            activeCategory = item.getAttribute("data-category");
            fetchProducts();
        });
    });

    async function refreshUnreadBadge() {
        const badge = $("unreadBadge");
        if (!badge) return;
        try {
            const res = await apiFetch("/messages");
            const total = res.data.reduce((sum, c) => sum + c.unreadCount, 0);
            if (total > 0) {
                badge.textContent = total > 9 ? "9+" : total;
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }
        } catch (err) {}
    }
    refreshUnreadBadge();
});
