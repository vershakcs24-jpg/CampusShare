document.addEventListener("DOMContentLoaded", () => {
    Auth.requireAuth();
    const addProductForm = $("addProductForm");
    if (!addProductForm) return;
    const submitBtn = $("submitListingBtn");
    const imageInput = $("itemImage");
    const imagePreviewGrid = $("itemImagePreviewGrid");
    const imageAddTile = $("itemImageAddTile");
    const imageCountLabel = $("itemImageCount");
    const progressWrap = $("uploadProgressWrap");
    const progressBar = $("uploadProgressBar");
    const progressLabel = $("uploadProgressLabel");
    const MAX_IMAGES = 6;

    const imagePicker = createImagePicker({
        gridEl: imagePreviewGrid,
        addTileEl: imageAddTile,
        inputEl: imageInput,
        maxImages: MAX_IMAGES,
        onChange: ({ total }) => {
            imageCountLabel.textContent = total > 0 ? `(${total}/${MAX_IMAGES})` : "";
        }
    });

    function setProgress(percent, label) {
        progressWrap.classList.remove("hidden");
        progressLabel.classList.remove("hidden");
        progressBar.style.width = `${percent}%`;
        if (label) progressLabel.textContent = label;
    }
    function resetProgress() {
        progressWrap.classList.add("hidden");
        progressLabel.classList.add("hidden");
        progressBar.style.width = "0%";
    }

    addProductForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const itemName = $("itemName").value.trim();
        const itemPrice = $("itemPrice").value.trim();
        const itemCategory = $("itemCategory").value;
        const itemConditionEl = document.querySelector('input[name="itemCondition"]:checked');
        const itemLocation = $("itemLocation").value.trim();
        const itemDesc = $("itemDesc").value.trim();
        const rawImageFiles = imagePicker.getNewFiles();
        if (!rawImageFiles.length) {
            csToast("Please upload at least one product image.", "error");
            return;
        }
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        try {
            // compress client-side so uploads stay fast on big camera/phone images
            submitBtn.textContent = "Optimizing images...";
            setProgress(5, `Compressing ${rawImageFiles.length} image${rawImageFiles.length > 1 ? "s" : ""}...`);
            const imageFiles = await Promise.all(rawImageFiles.map(f => compressImageFile(f, { maxDimension: 1600, quality: 0.82 })));
            const formData = new FormData();
            formData.append("title", itemName);
            formData.append("price", itemPrice);
            formData.append("category", itemCategory);
            formData.append("condition", itemConditionEl ? itemConditionEl.value : "Used");
            formData.append("location", itemLocation);
            formData.append("desc", itemDesc);
            imageFiles.forEach(file => formData.append("images", file));
            submitBtn.textContent = "Uploading...";
            const res = await apiUpload("/products", formData, {
                onProgress: (percent) => setProgress(Math.max(percent, 10), `Uploading... ${percent}%`)
            });
            setProgress(100, "Done!");
            csToast(`"${res.data.title}" is now live on the marketplace!`, "success");
            setTimeout(() => { window.location.href = "marketplace.html"; }, 700);
        } catch (err) {
            csToast(err.message, "error");
            resetProgress();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
});
