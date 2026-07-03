document.addEventListener("DOMContentLoaded", () => {
    Auth.requireAuth();
    const userNameElement = $("userName");
    const userEmailElement = $("userEmail");
    const userMetaElement = $("userMeta");
    const userHostelElement = $("userHostel");
    const userPhoneElement = $("userPhone");
    const userBioElement = $("userBio");
    const avatarLarge = $("avatarLarge");
    const myListingsGrid = $("myListingsGrid");
    const wishlistGrid = $("wishlistGrid");
    const CATEGORY_OPTIONS = [
        { value: "notebooks", label: "📚 Notebooks & Books" },
        { value: "electronics", label: "⚡ Electronics & Calculators" },
        { value: "clothes", label: "👕 Apparel & Uniforms" },
        { value: "others", label: "📦 Other Essentials" }
    ];
    const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "PG / MTech", "PhD"];
    let profileUser = null;

    function renderUserCard() {
        if (!profileUser) return;
        userNameElement.textContent = profileUser.name;
        userEmailElement.textContent = `📧 ${profileUser.email}`;
        const metaParts = [profileUser.branch, profileUser.year].filter(Boolean);
        if (metaParts.length > 0) {
            userMetaElement.textContent = `🎓 ${metaParts.join(" | ")}`;
            userMetaElement.classList.remove("meta-incomplete");
            userMetaElement.onclick = null;
        } else {
            userMetaElement.textContent = "🎓 Complete your profile";
            userMetaElement.classList.add("meta-incomplete");
            userMetaElement.onclick = () => openEditProfileModal();
        }
        userHostelElement.textContent = profileUser.hostel ? `🏠 ${profileUser.hostel}` : "";
        userPhoneElement.textContent = profileUser.phone ? `📱 ${profileUser.phone}` : "";
        userBioElement.textContent = profileUser.bio || "";
        avatarLarge.innerHTML = profileUser.avatar
            ? `<img src="${profileUser.avatar}" alt="${profileUser.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent='${initialsAvatar(profileUser.name)}'">`
            : initialsAvatar(profileUser.name);
    }

    async function loadProfile() {
        try {
            const res = await apiFetch("/users/profile");
            profileUser = res.data;
            Auth.updateUser(profileUser);
            renderUserCard();
        } catch (err) {
            userNameElement.textContent = "Session expired";
            userEmailElement.textContent = err.message;
        }
    }

    async function loadStats() {
        try {
            const res = await apiFetch("/users/stats");
            $("statListed").textContent = res.data.listed;
            $("statSold").textContent = res.data.sold;
            $("statWishlist").textContent = res.data.wishlist;
            $("statMessages").textContent = res.data.messages;
        } catch (err) {}
    }

    function listingMedia(item) {
        const src = item.thumbUrl || item.imageUrl;
        return src
            ? `<img src="${src}" alt="${item.title}" loading="lazy" onerror="csImgFallback(this)">`
            : `<div class="img-placeholder"><span class="ph-icon">📦</span></div>`;
    }

    function listingCard(item) {
        const media = listingMedia(item);
        const isSold = item.availability === "Sold";
        const soldTag = isSold
            ? `<span style="color:#e53e3e; font-size:0.75rem; font-weight:700;">SOLD</span>`
            : `<span style="color:#38a169; font-size:0.75rem; font-weight:700;">AVAILABLE</span>`;
        const card = document.createElement("div");
        card.classList.add("my-product-card");
        card.innerHTML = `
            <div class="my-prod-visual">${media}</div>
            <div class="my-prod-body">
                <h4>${item.title}</h4>
                <div class="my-prod-price">₹${item.price} &nbsp; ${soldTag}</div>
                <div class="card-actions-row">
                    <button class="btn-card-edit" data-action="edit">✏️ Edit</button>
                    <button class="btn-card-del" data-action="delete">🗑️ Delete</button>
                    <button class="btn-card-edit btn-toggle-sold ${isSold ? "is-sold" : ""}" data-action="toggle">
                        ${isSold ? "↩ Mark as Available" : "✔ Mark as Sold"}
                    </button>
                </div>
            </div>
        `;
        card.querySelector('[data-action="edit"]').addEventListener("click", () => openEditListingModal(item));
        card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteListing(item));
        card.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleSold(item));
        return card;
    }

    async function loadMyListings() {
        try {
            const res = await apiFetch("/products?seller=me");
            myListingsGrid.innerHTML = "";
            if (res.data.length === 0) {
                myListingsGrid.innerHTML = "<p style='color:#718096;'>You haven't listed any items for sale yet.</p>";
                return;
            }
            res.data.forEach(item => myListingsGrid.appendChild(listingCard(item)));
        } catch (err) {
            myListingsGrid.innerHTML = `<p style='color:#c53030;'>${err.message}</p>`;
        }
    }

    async function toggleSold(item) {
        const newStatus = item.availability === "Sold" ? "In Stock" : "Sold";
        try {
            await apiFetch(`/products/${item._id}`, { method: "PUT", body: { availability: newStatus } });
            csToast(newStatus === "Sold" ? "Marked as sold." : "Marked as available again.", "success");
            loadMyListings();
            loadStats();
        } catch (err) {
            csToast(err.message, "error");
        }
    }

    async function deleteListing(item) {
        const confirmed = await csConfirm(
            `Are you sure you want to delete <strong>"${item.title}"</strong>? This cannot be undone.`,
            { title: "Delete Listing", confirmLabel: "Delete", danger: true }
        );
        if (!confirmed) return;
        try {
            await apiFetch(`/products/${item._id}`, { method: "DELETE" });
            csToast("Listing deleted.", "success");
            loadMyListings();
            loadStats();
        } catch (err) {
            csToast(err.message, "error");
        }
    }

    function categoryOptionsHtml(selected) {
        return CATEGORY_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === selected ? "selected" : ""}>${opt.label}</option>`
        ).join("");
    }

    function openEditListingModal(item) {
        const overlay = csOpenModal(`
            <div class="cs-modal-header">
                <h3>Edit Listing</h3>
                <button class="cs-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="cs-modal-body">
                <form id="editListingForm">
                    <div class="form-group">
                        <label>Product Images <span id="editImgCount" style="font-weight:400; color:#718096;"></span></label>
                        <div class="cs-multi-image-grid" id="editImgGrid">
                            <label class="cs-multi-image-add" id="editImgAddTile">
                                <span class="cs-multi-image-add-icon">📷</span>
                                <span class="cs-multi-image-add-text">Add photos</span>
                                <input type="file" id="editItemImage" accept="image/*" multiple>
                            </label>
                        </div>
                        <small class="cs-field-hint">Up to 6 photos. The first photo is the main image shown on the marketplace.</small>
                    </div>
                    <div class="form-group">
                        <label for="editItemName">Product Name</label>
                        <input type="text" id="editItemName" value="${escapeAttr(item.title)}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editItemPrice">Price (₹)</label>
                            <input type="number" id="editItemPrice" value="${item.price}" required>
                        </div>
                        <div class="form-group">
                            <label for="editItemCategory">Category</label>
                            <select id="editItemCategory">${categoryOptionsHtml(item.category)}</select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editItemCondition">Condition</label>
                            <select id="editItemCondition">
                                <option value="New" ${item.condition === "New" ? "selected" : ""}>New</option>
                                <option value="Used" ${item.condition === "Used" ? "selected" : ""}>Used</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editItemAvailability">Availability</label>
                            <select id="editItemAvailability">
                                <option value="In Stock" ${item.availability !== "Sold" ? "selected" : ""}>In Stock</option>
                                <option value="Sold" ${item.availability === "Sold" ? "selected" : ""}>Sold</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editItemLocation">Location</label>
                        <input type="text" id="editItemLocation" value="${escapeAttr(item.location)}" required>
                    </div>
                    <div class="form-group">
                        <label for="editItemDesc">Description</label>
                        <textarea id="editItemDesc" rows="4" required>${item.desc || ""}</textarea>
                    </div>
                    <p class="cs-field-error" id="editListingError"></p>
                    <div class="cs-progress-wrap hidden" id="editProgressWrap"><div class="cs-progress-bar" id="editProgressBar"></div></div>
                </form>
            </div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-secondary cs-modal-close">Cancel</button>
                <button class="cs-btn cs-btn-primary" id="saveListingBtn">Save Changes</button>
            </div>
        `);

        const MAX_LISTING_IMAGES = 6;
        const imagePicker = createImagePicker({
            gridEl: overlay.querySelector("#editImgGrid"),
            addTileEl: overlay.querySelector("#editImgAddTile"),
            inputEl: overlay.querySelector("#editItemImage"),
            maxImages: MAX_LISTING_IMAGES,
            existingImages: (item.images && item.images.length)
                ? item.images
                : (item.imageUrl ? [{ url: item.imageUrl, cloudinaryId: item.cloudinaryId }] : []),
            onChange: ({ total }) => {
                overlay.querySelector("#editImgCount").textContent = total > 0 ? `(${total}/${MAX_LISTING_IMAGES})` : "";
            }
        });

        overlay.querySelector("#saveListingBtn").addEventListener("click", async () => {
            const errorEl = overlay.querySelector("#editListingError");
            errorEl.textContent = "";
            const title = overlay.querySelector("#editItemName").value.trim();
            const price = overlay.querySelector("#editItemPrice").value.trim();
            const location = overlay.querySelector("#editItemLocation").value.trim();
            const desc = overlay.querySelector("#editItemDesc").value.trim();
            if (!title || !price || !location || !desc) {
                errorEl.textContent = "Please fill in all required fields.";
                return;
            }
            const newImageFiles = imagePicker.getNewFiles();
            const removedIds = imagePicker.getRemovedIds();
            if (imagePicker.totalCount() === 0) {
                errorEl.textContent = "A listing needs at least one photo.";
                return;
            }
            const saveBtn = overlay.querySelector("#saveListingBtn");
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
            try {
                if (newImageFiles.length || removedIds.length) {
                    const compressed = await Promise.all(newImageFiles.map(f => compressImageFile(f, { maxDimension: 1600, quality: 0.82 })));
                    const formData = new FormData();
                    formData.append("title", title);
                    formData.append("price", price);
                    formData.append("category", overlay.querySelector("#editItemCategory").value);
                    formData.append("condition", overlay.querySelector("#editItemCondition").value);
                    formData.append("availability", overlay.querySelector("#editItemAvailability").value);
                    formData.append("location", location);
                    formData.append("desc", desc);
                    if (removedIds.length) formData.append("removeImages", JSON.stringify(removedIds));
                    compressed.forEach(file => formData.append("images", file));
                    const progressWrap = overlay.querySelector("#editProgressWrap");
                    const progressBar = overlay.querySelector("#editProgressBar");
                    progressWrap.classList.remove("hidden");
                    await apiUploadPut(`/products/${item._id}`, formData, {
                        onProgress: (p) => { progressBar.style.width = `${p}%`; }
                    });
                } else {
                    await apiFetch(`/products/${item._id}`, {
                        method: "PUT",
                        body: {
                            title, price: Number(price), location, desc,
                            category: overlay.querySelector("#editItemCategory").value,
                            condition: overlay.querySelector("#editItemCondition").value,
                            availability: overlay.querySelector("#editItemAvailability").value
                        }
                    });
                }
                csCloseModal(overlay);
                csToast("Listing updated successfully!", "success");
                loadMyListings();
                loadStats();
            } catch (err) {
                errorEl.textContent = err.message;
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Changes";
            }
        });
    }

    function wishlistCard(item) {
        const src = item.thumbUrl || item.imageUrl;
        const media = src
            ? `<img src="${src}" loading="lazy" alt="${item.title}" onerror="csImgFallback(this)">`
            : `<div class="img-placeholder"><span class="ph-icon">📦</span></div>`;
        const card = document.createElement("div");
        card.classList.add("item-card-mini");
        card.style.cursor = "pointer";
        card.innerHTML = `
            <div class="item-icon-box">${media}</div>
            <div class="item-info-box">
                <h4>${item.title}</h4>
                <p>Price: ₹${item.price}</p>
            </div>
        `;
        card.addEventListener("click", () => window.location.href = `product.html?id=${item._id}`);
        return card;
    }

    async function loadWishlist() {
        try {
            const res = await apiFetch("/wishlist");
            wishlistGrid.innerHTML = "";
            if (res.data.length === 0) {
                wishlistGrid.innerHTML = "<p style='color:#718096;'>Your wishlist is empty. Browse the marketplace to save items you like.</p>";
                return;
            }
            res.data.forEach(item => wishlistGrid.appendChild(wishlistCard(item)));
        } catch (err) {
            wishlistGrid.innerHTML = `<p style='color:#c53030;'>${err.message}</p>`;
        }
    }

    function yearOptionsHtml(selected) {
        return `<option value="" ${!selected ? "selected" : ""}>Select year</option>` +
            YEAR_OPTIONS.map(y => `<option value="${y}" ${y === selected ? "selected" : ""}>${y}</option>`).join("");
    }

    function openEditProfileModal() {
        if (!profileUser) return;
        const overlay = csOpenModal(`
            <div class="cs-modal-header">
                <h3>Edit Profile</h3>
                <button class="cs-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="cs-modal-body">
                <form id="editProfileForm">
                    <div class="cs-avatar-upload">
                        <div class="cs-avatar-preview" id="editAvatarPreview">
                            ${profileUser.avatar ? `<img src="${profileUser.avatar}" onerror="this.parentElement.textContent='${initialsAvatar(profileUser.name)}'">` : initialsAvatar(profileUser.name)}
                        </div>
                        <div>
                            <input type="file" id="editAvatarInput" accept="image/*">
                            <small class="cs-field-hint">JPG or PNG, square photos look best.</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editFullName">Full Name</label>
                        <input type="text" id="editFullName" value="${escapeAttr(profileUser.name)}" required>
                    </div>
                    <div class="form-group">
                        <label for="editEmailRO">Email</label>
                        <input type="email" id="editEmailRO" value="${escapeAttr(profileUser.email)}" disabled>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editPhone">Phone Number</label>
                            <input type="tel" id="editPhone" value="${escapeAttr(profileUser.phone || "")}" placeholder="10-digit number">
                        </div>
                        <div class="form-group">
                            <label for="editHostel">Hostel / Campus Location</label>
                            <input type="text" id="editHostel" value="${escapeAttr(profileUser.hostel || "")}" placeholder="e.g., Hostel 7">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editBranch">Department / Branch</label>
                            <input type="text" id="editBranch" value="${escapeAttr(profileUser.branch || "")}" placeholder="e.g., CSE">
                        </div>
                        <div class="form-group">
                            <label for="editYear">Year of Study</label>
                            <select id="editYear">${yearOptionsHtml(profileUser.year)}</select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editBio">Bio (optional)</label>
                        <textarea id="editBio" rows="3" placeholder="A short line about yourself...">${profileUser.bio || ""}</textarea>
                    </div>
                    <p class="cs-field-error" id="editProfileError"></p>
                </form>
            </div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-secondary cs-modal-close">Cancel</button>
                <button class="cs-btn cs-btn-primary" id="saveProfileBtn">Save Changes</button>
            </div>
        `);

        const avatarInput = overlay.querySelector("#editAvatarInput");
        const avatarPreview = overlay.querySelector("#editAvatarPreview");
        avatarInput.addEventListener("change", () => {
            const file = avatarInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => { avatarPreview.innerHTML = `<img src="${e.target.result}">`; };
            reader.readAsDataURL(file);
        });

        overlay.querySelector("#saveProfileBtn").addEventListener("click", async () => {
            const errorEl = overlay.querySelector("#editProfileError");
            errorEl.textContent = "";
            const name = overlay.querySelector("#editFullName").value.trim();
            if (!name) {
                errorEl.textContent = "Full name is required.";
                return;
            }
            const saveBtn = overlay.querySelector("#saveProfileBtn");
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
            try {
                const formData = new FormData();
                formData.append("name", name);
                formData.append("phone", overlay.querySelector("#editPhone").value.trim());
                formData.append("hostel", overlay.querySelector("#editHostel").value.trim());
                formData.append("branch", overlay.querySelector("#editBranch").value.trim());
                formData.append("year", overlay.querySelector("#editYear").value);
                formData.append("bio", overlay.querySelector("#editBio").value.trim());
                const avatarFile = avatarInput.files[0];
                if (avatarFile) {
                    const compressed = await compressImageFile(avatarFile, { maxDimension: 800, quality: 0.85 });
                    formData.append("avatar", compressed);
                }
                const res = await apiUploadPut("/users/profile", formData, {});
                profileUser = { ...profileUser, ...res.data };
                Auth.updateUser(res.data);
                renderUserCard();
                csCloseModal(overlay);
                csToast("Profile updated successfully!", "success");
            } catch (err) {
                errorEl.textContent = err.message;
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Changes";
            }
        });
    }
    $("btnEditProfile").addEventListener("click", openEditProfileModal);

    function openChangePasswordModal() {
        const overlay = csOpenModal(`
            <div class="cs-modal-header">
                <h3>Change Password</h3>
                <button class="cs-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="cs-modal-body">
                <form id="changePasswordForm">
                    <div class="form-group">
                        <label for="curPassword">Current Password</label>
                        <input type="password" id="curPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">New Password</label>
                        <input type="password" id="newPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="confirmNewPassword">Confirm New Password</label>
                        <input type="password" id="confirmNewPassword" required>
                    </div>
                    <p class="cs-field-error" id="changePasswordError"></p>
                    <button type="button" class="cs-link-btn" id="forgotPasswordLink">Forgot Password?</button>
                </form>
            </div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-secondary cs-modal-close">Cancel</button>
                <button class="cs-btn cs-btn-primary" id="updatePasswordBtn">Update Password</button>
            </div>
        `, { small: true });

        overlay.querySelector("#updatePasswordBtn").addEventListener("click", async () => {
            const errorEl = overlay.querySelector("#changePasswordError");
            errorEl.textContent = "";
            const oldPassword = overlay.querySelector("#curPassword").value;
            const newPassword = overlay.querySelector("#newPassword").value;
            const confirmNewPassword = overlay.querySelector("#confirmNewPassword").value;
            if (!oldPassword || !newPassword || !confirmNewPassword) {
                errorEl.textContent = "Please fill in all fields.";
                return;
            }
            if (newPassword.length < 6) {
                errorEl.textContent = "New password must be at least 6 characters.";
                return;
            }
            if (newPassword !== confirmNewPassword) {
                errorEl.textContent = "New passwords do not match.";
                return;
            }
            const btn = overlay.querySelector("#updatePasswordBtn");
            btn.disabled = true;
            btn.textContent = "Updating...";
            try {
                await apiFetch("/users/change-password", { method: "PUT", body: { oldPassword, newPassword } });
                csCloseModal(overlay);
                csToast("Password changed successfully!", "success");
            } catch (err) {
                errorEl.textContent = err.message;
                btn.disabled = false;
                btn.textContent = "Update Password";
            }
        });

        overlay.querySelector("#forgotPasswordLink").addEventListener("click", async () => {
            const link = overlay.querySelector("#forgotPasswordLink");
            if (!profileUser?.email) return;
            link.disabled = true;
            link.textContent = "Sending...";
            try {
                await apiFetch("/auth/forgot-password", { method: "POST", body: { email: profileUser.email } });
                csToast(`A password reset link has been sent to ${profileUser.email}.`, "success", 5000);
                link.textContent = "Reset link sent ✓";
            } catch (err) {
                csToast(err.message, "error");
                link.disabled = false;
                link.textContent = "Forgot Password?";
            }
        });
    }
    $("btnChangePassword").addEventListener("click", openChangePasswordModal);

    $("btnLogout").addEventListener("click", async () => {
        const confirmed = await csConfirm("Confirm logging out from your campus instance?", { title: "Log Out", confirmLabel: "Logout", danger: false });
        if (confirmed) Auth.logout();
    });

    function escapeAttr(str = "") {
        return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    loadProfile();
    loadStats();
    loadMyListings();
    loadWishlist();
});
