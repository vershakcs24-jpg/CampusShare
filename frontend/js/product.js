document.addEventListener("DOMContentLoaded", async () => {
    Auth.requireAuth();
    const currentUser = Auth.getUser();
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");
    if (!productId) {
        $("prodName").textContent = "Product Not Found";
        return;
    }

    let currentProduct = null;
    let inWishlist = false;
    let galleryImages = [];
    let activeImageIndex = 0;
    const btnChat = $("btnChat");
    const btnWishlist = $("btnWishlist");

    async function loadProduct() {
        try {
            const res = await apiFetch(`/products/${productId}`);
            currentProduct = res.data;
            renderProduct();
            checkWishlistState();
            loadSimilarProducts();
        } catch (err) {
            $("prodName").textContent = "Product Not Found";
            $("prodDesc").textContent = err.message;
        }
    }

    function renderProduct() {
        const p = currentProduct;
        $("prodName").textContent = p.title;
        $("prodPrice").textContent = `₹${p.price}`;
        $("prodCategory").textContent = p.category;
        $("prodCondition").textContent = p.condition;
        $("prodDesc").innerHTML = (p.desc || "").replace(/\n/g, "<br>");
        document.querySelector(".info-box").innerHTML = `
            <p>📅 <strong>Date Posted:</strong> ${timeAgo(p.createdAt)}</p>
            <p>📍 <strong>Campus Location:</strong> ${p.location}</p>
            <p>${p.availability === "Sold" ? "🔴" : "🟢"} <strong>Item Availability:</strong> ${p.availability}</p>
        `;
        galleryImages = (p.images && p.images.length) ? p.images.map(img => img.url) : (p.imageUrl ? [p.imageUrl] : []);
        activeImageIndex = 0;
        renderMainImage();
        renderThumbnails();
        $("sellerName").textContent = p.seller?.name || "Campus Student";
        const sellerMeta = p.seller ? [p.seller.branch, p.seller.year].filter(Boolean).join(" | ") : "";
        $("sellerDept").textContent = sellerMeta || "NITJian";
        renderAvatarInto($("sellerAvatar"), p.seller || {}, { fallbackEmoji: "👤" });
        const isOwner = currentUser && p.seller && (p.seller._id === currentUser._id);
        if (isOwner) {
            btnChat.style.display = "none";
            btnWishlist.style.display = "none";
        }
        btnChat.disabled = false;
        btnChat.textContent = "💬 Chat with Seller";
    }

    function renderMainImage() {
        const mainImageBox = $("mainImageBox");
        if (galleryImages.length) {
            mainImageBox.innerHTML = `
                <img src="${galleryImages[activeImageIndex]}" alt="${currentProduct.title}" onerror="csImgFallback(this)">
                <span class="main-image-zoom-hint" aria-hidden="true">🔍 Click to zoom</span>
            `;
            mainImageBox.classList.add("clickable");
            mainImageBox.onclick = () => openLightbox(activeImageIndex);
        } else {
            mainImageBox.innerHTML = `<div class="img-placeholder"><span class="ph-icon">📦</span><span class="ph-text">No Image</span></div>`;
            mainImageBox.classList.remove("clickable");
            mainImageBox.onclick = null;
        }
    }

    function renderThumbnails() {
        const row = $("thumbnailsRow");
        if (galleryImages.length <= 1) {
            row.innerHTML = "";
            row.style.display = "none";
            return;
        }
        row.style.display = "flex";
        row.innerHTML = galleryImages.map((url, idx) => `
            <div class="thumb ${idx === activeImageIndex ? "active" : ""}" data-idx="${idx}">
                <img src="${url}" alt="${currentProduct.title} photo ${idx + 1}" loading="lazy" onerror="csImgFallback(this)">
            </div>
        `).join("");
        row.querySelectorAll(".thumb").forEach(el => {
            el.addEventListener("click", () => {
                activeImageIndex = Number(el.dataset.idx);
                renderMainImage();
                renderThumbnails();
            });
        });
    }

    // full-screen lightbox with zoom + navigation
    function openLightbox(startIndex) {
        activeImageIndex = startIndex;
        const overlay = document.createElement("div");
        overlay.className = "cs-lightbox-overlay";
        overlay.innerHTML = `
            <button class="cs-lightbox-close" aria-label="Close">&times;</button>
            ${galleryImages.length > 1 ? '<button class="cs-lightbox-nav cs-lightbox-prev" aria-label="Previous image">&#8249;</button>' : ""}
            <div class="cs-lightbox-stage">
                <img class="cs-lightbox-img" src="${galleryImages[activeImageIndex]}" alt="${currentProduct.title}">
            </div>
            ${galleryImages.length > 1 ? '<button class="cs-lightbox-nav cs-lightbox-next" aria-label="Next image">&#8250;</button>' : ""}
            <div class="cs-lightbox-hint">${galleryImages.length > 1 ? "Click image to zoom · Use arrows to browse" : "Click image to zoom"}</div>
            ${galleryImages.length > 1 ? `<div class="cs-lightbox-counter" id="lightboxCounter">${activeImageIndex + 1} / ${galleryImages.length}</div>` : ""}
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";
        const imgEl = overlay.querySelector(".cs-lightbox-img");
        imgEl.addEventListener("click", (e) => { e.stopPropagation(); imgEl.classList.toggle("zoomed"); });

        function updateImage() {
            imgEl.classList.remove("zoomed");
            imgEl.src = galleryImages[activeImageIndex];
            const counter = overlay.querySelector("#lightboxCounter");
            if (counter) counter.textContent = `${activeImageIndex + 1} / ${galleryImages.length}`;
        }
        function showPrev(e) {
            e.stopPropagation();
            activeImageIndex = (activeImageIndex - 1 + galleryImages.length) % galleryImages.length;
            updateImage();
        }
        function showNext(e) {
            e.stopPropagation();
            activeImageIndex = (activeImageIndex + 1) % galleryImages.length;
            updateImage();
        }
        const prevBtn = overlay.querySelector(".cs-lightbox-prev");
        const nextBtn = overlay.querySelector(".cs-lightbox-next");
        if (prevBtn) prevBtn.addEventListener("click", showPrev);
        if (nextBtn) nextBtn.addEventListener("click", showNext);

        function close() {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", keyHandler);
            overlay.remove();
            renderMainImage();
            renderThumbnails();
        }
        function keyHandler(e) {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowLeft" && galleryImages.length > 1) showPrev(e);
            else if (e.key === "ArrowRight" && galleryImages.length > 1) showNext(e);
        }
        document.addEventListener("keydown", keyHandler);
        overlay.querySelector(".cs-lightbox-close").addEventListener("click", close);
        overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    }

    async function checkWishlistState() {
        try {
            const res = await apiFetch("/wishlist");
            inWishlist = res.data.some(item => item._id === productId);
            updateWishlistButton();
        } catch (err) {}
    }

    function updateWishlistButton() {
        btnWishlist.textContent = inWishlist ? "💔 Remove from Wishlist" : "❤️ Add to Wishlist";
    }

    async function loadSimilarProducts() {
        try {
            const res = await apiFetch(`/products?category=${encodeURIComponent(currentProduct.category)}`);
            const similar = res.data.filter(p => p._id !== productId).slice(0, 3);
            if (similar.length === 0) return;
            const grid = $("similarGrid");
            grid.innerHTML = similar.map(p => `
                <div class="sim-card" onclick="window.location.href='product.html?id=${p._id}'" style="cursor:pointer;">
                    <div class="sim-icon">${(p.thumbUrl || p.imageUrl) ? `<img src="${p.thumbUrl || p.imageUrl}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="csImgFallback(this)">` : `<div class="img-placeholder"><span class="ph-icon">📦</span></div>`}</div>
                    <h4>${p.title}</h4>
                </div>
            `).join("");
            $("similarSection").style.display = "block";
        } catch (err) {}
    }

    btnChat.addEventListener("click", () => {
        if (!currentProduct || !currentProduct.seller) return;
        const params = new URLSearchParams({
            sellerId: currentProduct.seller._id,
            sellerName: currentProduct.seller.name,
            listingId: currentProduct._id,
            listingTitle: currentProduct.title
        });
        window.location.href = `chat.html?${params.toString()}`;
    });

    btnWishlist.addEventListener("click", async () => {
        btnWishlist.disabled = true;
        try {
            if (inWishlist) {
                await apiFetch(`/wishlist/${productId}`, { method: "DELETE" });
                inWishlist = false;
            } else {
                await apiFetch(`/wishlist/${productId}`, { method: "POST" });
                inWishlist = true;
            }
            updateWishlistButton();
        } catch (err) {
            alert(err.message);
        } finally {
            btnWishlist.disabled = false;
        }
    });

    $("btnShare").addEventListener("click", () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Product link copied to clipboard!");
    });

    loadProduct();
});
