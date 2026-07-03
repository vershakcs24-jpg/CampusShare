const API_BASE = `${window.location.origin}/api`;
const $ = (id) => document.getElementById(id);

const Auth = {
    getToken() {
        return localStorage.getItem("csToken");
    },
    getUser() {
        try {
            return JSON.parse(localStorage.getItem("csUser"));
        } catch (e) {
            return null;
        }
    },
    setSession(userData) {
        const { token, ...user } = userData;
        localStorage.setItem("csToken", token);
        localStorage.setItem("csUser", JSON.stringify(user));
    },
    updateUser(partialUser) {
        const current = Auth.getUser() || {};
        localStorage.setItem("csUser", JSON.stringify({ ...current, ...partialUser }));
    },
    isLoggedIn() {
        return !!Auth.getToken();
    },
    logout() {
        localStorage.removeItem("csToken");
        localStorage.removeItem("csUser");
        window.location.href = "auth.html";
    },
    requireAuth() {
        if (!Auth.isLoggedIn()) window.location.href = "auth.html";
    }
};

async function apiFetch(path, { method = "GET", body, isFormData = false, headers = {} } = {}) {
    const finalHeaders = { ...headers };
    const token = Auth.getToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
    let finalBody = body;
    if (body && !isFormData) {
        finalHeaders["Content-Type"] = "application/json";
        finalBody = JSON.stringify(body);
    }
    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, { method, headers: finalHeaders, body: finalBody });
    } catch (networkErr) {
        throw new Error("Could not reach the CampusShare server. Is the backend running?");
    }
    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = { success: false, message: "Unexpected server response" };
    }
    if (!response.ok || data.success === false) throw new Error(data.message || "Something went wrong");
    return data;
}

function initialsAvatar(name = "?") {
    const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    return initials || "?";
}

function renderAvatarInto(el, { avatar, name } = {}, { fallbackEmoji = "👤", size } = {}) {
    if (!el) return;
    if (size) { el.style.width = size; el.style.height = size; }
    if (avatar) {
        el.innerHTML = `<img src="${avatar}" alt="${name || "Profile"}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.parentElement.textContent='${name ? initialsAvatar(name) : fallbackEmoji}'">`;
    } else if (name) {
        el.textContent = initialsAvatar(name);
    } else {
        el.textContent = fallbackEmoji;
    }
}

async function refreshNavAvatar() {
    const el = $("navProfileIcon");
    if (!el) return;
    const cached = Auth.getUser();
    if (cached) renderAvatarInto(el, cached);
    try {
        const res = await apiFetch("/users/profile");
        Auth.updateUser(res.data);
        renderAvatarInto(el, res.data);
    } catch (err) {}
}

function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    const intervals = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [label, secs] of intervals) {
        const count = Math.floor(seconds / secs);
        if (count >= 1) return `${count} ${label}${count > 1 ? "s" : ""} ago`;
    }
    return "just now";
}

function csToast(message, type = "info", duration = 3500) {
    let stack = $("cs-toast-stack");
    if (!stack) {
        stack = document.createElement("div");
        stack.id = "cs-toast-stack";
        document.body.appendChild(stack);
    }
    const toast = document.createElement("div");
    toast.className = `cs-toast cs-toast-${type}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function csOpenModal(innerHtml, { small = false } = {}) {
    const overlay = document.createElement("div");
    overlay.className = "cs-modal-overlay";
    overlay.innerHTML = `<div class="cs-modal ${small ? "cs-modal-sm" : ""}">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    const close = () => csCloseModal(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll(".cs-modal-close").forEach(btn => btn.addEventListener("click", close));
    const escHandler = (e) => {
        if (e.key === "Escape") {
            close();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
    return overlay;
}

function csCloseModal(overlay) {
    if (overlay && overlay.parentNode) overlay.remove();
}

function csConfirm(message, { title = "Please Confirm", confirmLabel = "Confirm", danger = true } = {}) {
    return new Promise((resolve) => {
        const overlay = csOpenModal(`
            <div class="cs-modal-header">
                <h3>${title}</h3>
                <button class="cs-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="cs-modal-body"><p style="color:#4a5568; font-size:0.95rem;">${message}</p></div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-secondary" id="csConfirmCancel">Cancel</button>
                <button class="cs-btn ${danger ? "cs-btn-danger" : "cs-btn-primary"}" id="csConfirmOk">${confirmLabel}</button>
            </div>
        `, { small: true });
        let resolved = false;
        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            resolve(result);
            csCloseModal(overlay);
        };
        overlay.querySelector("#csConfirmCancel").addEventListener("click", () => finish(false));
        overlay.querySelector("#csConfirmOk").addEventListener("click", () => finish(true));
        overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(false); });
    });
}

function compressImageFile(file, { maxDimension = 1600, quality = 0.82 } = {}) {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith("image/") || file.type === "image/gif") {
            resolve(file);
            return;
        }
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = () => resolve(file);
        img.onload = () => {
            let { width, height } = img;
            if (width <= maxDimension && height <= maxDimension) {
                resolve(file);
                return;
            }
            const scale = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (!blob) { resolve(file); return; }
                resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            }, "image/jpeg", quality);
        };
        img.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

function apiXhr(method, path, formData, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, `${API_BASE}${path}`, true);
        const token = Auth.getToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.onload = () => {
            let data;
            try { data = JSON.parse(xhr.responseText); }
            catch (e) { data = { success: false, message: "Unexpected server response" }; }
            if (xhr.status >= 200 && xhr.status < 300 && data.success !== false) resolve(data);
            else reject(new Error(data.message || "Something went wrong"));
        };
        xhr.onerror = () => reject(new Error("Could not reach the CampusShare server. Is the backend running?"));
        xhr.send(formData);
    });
}

const apiUpload = (path, formData, opts) => apiXhr("POST", path, formData, opts);
const apiUploadPut = (path, formData, opts) => apiXhr("PUT", path, formData, opts);

// gridEl/addTileEl/inputEl come from the DOM, existingImages preload previously saved photos
function createImagePicker({ gridEl, addTileEl, inputEl, maxImages = 6, existingImages = [], onChange }) {
    const existing = existingImages.map(img => ({ ...img, _removed: false }));
    let newFiles = [];
    function totalCount() {
        return existing.filter(e => !e._removed).length + newFiles.length;
    }
    function updateCounter() {
        if (onChange) onChange({ total: totalCount() });
    }
    function makeRemoveBtn(onRemove) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cs-multi-image-remove";
        btn.setAttribute("aria-label", "Remove photo");
        btn.innerHTML = "&times;";
        btn.addEventListener("click", onRemove);
        return btn;
    }
    function render() {
        gridEl.querySelectorAll(".cs-multi-image-tile").forEach(el => el.remove());
        let isFirst = true;
        existing.forEach((img) => {
            if (img._removed) return;
            const tile = document.createElement("div");
            tile.className = "cs-multi-image-tile";
            tile.innerHTML = `<img src="${img.url}" alt="Product photo">`;
            if (isFirst) {
                const tag = document.createElement("span");
                tag.className = "cs-multi-image-main-tag";
                tag.textContent = "MAIN";
                tile.appendChild(tag);
                isFirst = false;
            }
            tile.appendChild(makeRemoveBtn(() => { img._removed = true; render(); updateCounter(); }));
            gridEl.insertBefore(tile, addTileEl);
        });
        newFiles.forEach((file, idx) => {
            const tile = document.createElement("div");
            tile.className = "cs-multi-image-tile";
            const imgEl = document.createElement("img");
            imgEl.alt = "Product photo";
            const reader = new FileReader();
            reader.onload = (e) => { imgEl.src = e.target.result; };
            reader.readAsDataURL(file);
            tile.appendChild(imgEl);
            if (isFirst) {
                const tag = document.createElement("span");
                tag.className = "cs-multi-image-main-tag";
                tag.textContent = "MAIN";
                tile.appendChild(tag);
                isFirst = false;
            }
            tile.appendChild(makeRemoveBtn(() => { newFiles.splice(idx, 1); render(); updateCounter(); }));
            gridEl.insertBefore(tile, addTileEl);
        });
        addTileEl.style.display = totalCount() >= maxImages ? "none" : "";
        updateCounter();
    }
    inputEl.addEventListener("change", () => {
        const picked = Array.from(inputEl.files || []);
        const room = Math.max(maxImages - totalCount(), 0);
        newFiles = newFiles.concat(picked.slice(0, room));
        inputEl.value = "";
        render();
    });
    render();
    return {
        getNewFiles: () => newFiles,
        getRemovedIds: () => existing.filter(e => e._removed).map(e => e.cloudinaryId),
        totalCount
    };
}

function csImgFallback(imgEl, icon = "📦", label = "Image unavailable") {
    if (!imgEl || !imgEl.parentElement) return;
    imgEl.parentElement.innerHTML = `<div class="img-placeholder"><span class="ph-icon">${icon}</span><span class="ph-text">${label}</span></div>`;
}
