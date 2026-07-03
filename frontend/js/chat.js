document.addEventListener("DOMContentLoaded", () => {
    Auth.requireAuth();
    const currentUser = Auth.getUser();
    const conversationsList = $("conversationsList");
    const chatMessageStream = $("chatMessageStream");
    const chatInputForm = $("chatInputForm");
    const typeMsgBox = $("typeMsgBox");
    const chatWindowHeader = $("chatWindowHeader");
    const activeChatterHeaderName = $("activeChatterHeaderName");
    const activeChatterListing = $("activeChatterListing");
    const onlineDot = $("onlineDot");
    const conversationSearch = $("conversationSearch");

    let conversations = [];
    let activeConversation = null;
    let activeListingId = null;
    let activeListingTitle = null;
    let onlineUserIds = new Set();
    const pendingBubbles = new Map();
    const socket = io(window.location.origin);

    socket.on("connect", () => socket.emit("register_user", currentUser._id));
    socket.on("get_online_users", (userIds) => {
        onlineUserIds = new Set(userIds);
        renderConversations();
        updateOnlineDot();
    });
    socket.on("receive_private_message", (msg) => {
        const partnerId = msg.sender?._id || msg.senderId;
        const otherPartyId = partnerId === currentUser._id ? msg.receiver : partnerId;
        const isOwnMessage = partnerId === currentUser._id;
        if (isOwnMessage && msg.tempId && pendingBubbles.has(msg.tempId)) {
            reconcileBubble(msg.tempId, msg);
        } else if (activeConversation && (activeConversation._id === partnerId || activeConversation._id === otherPartyId)) {
            appendBubble(msg);
        }
        upsertConversationPreview(msg, partnerId, otherPartyId, isOwnMessage);
    });
    socket.on("message_error", (err) => {
        console.error("Message send failed:", err && err.message);
        if (typeof csToast === "function") csToast((err && err.message) || "Message failed to send. Please try again.", "error");
    });

    async function loadConversations(showLoading = true) {
        if (showLoading) conversationsList.innerHTML = "<p style='padding:15px 20px; color:#718096; font-size:0.9rem;'>Loading conversations...</p>";
        try {
            const res = await apiFetch("/messages");
            conversations = res.data;
            await ensureUrlParamConversation();
            renderConversations();
        } catch (err) {
            conversationsList.innerHTML = `<p style='padding:15px 20px; color:#c53030; font-size:0.9rem;'>${err.message}</p>`;
        }
    }

    function upsertConversationPreview(msg, partnerId, otherPartyId, isOwnMessage) {
        const convoPartnerId = isOwnMessage ? otherPartyId : partnerId;
        let convo = conversations.find(c => c.user._id === convoPartnerId);
        if (!convo) {
            loadConversations(false);
            return;
        }
        convo.lastMessage = msg.text;
        convo.lastMessageAt = msg.createdAt || new Date().toISOString();
        if (!isOwnMessage && !(activeConversation && activeConversation._id === partnerId)) {
            convo.unreadCount = (convo.unreadCount || 0) + 1;
        }
        conversations = [convo, ...conversations.filter(c => c !== convo)];
        renderConversations();
    }

    async function ensureUrlParamConversation() {
        const params = new URLSearchParams(window.location.search);
        const sellerId = params.get("sellerId");
        const sellerName = params.get("sellerName");
        const listingId = params.get("listingId");
        const listingTitle = params.get("listingTitle");
        if (!sellerId || sellerId === currentUser._id) return;
        let existing = conversations.find(c => c.user._id === sellerId);
        if (!existing) {
            existing = {
                user: { _id: sellerId, name: sellerName || "Campus Student" },
                lastMessage: "",
                lastMessageAt: new Date().toISOString(),
                unreadCount: 0,
                listingId: listingId ? { _id: listingId, title: listingTitle } : null
            };
            conversations.unshift(existing);
        }
        openConversation(existing.user, listingId || (existing.listingId && existing.listingId._id), listingTitle || (existing.listingId && existing.listingId.title));
        window.history.replaceState({}, "", "chat.html");
    }

    function renderConversations() {
        const searchText = conversationSearch.value.toLowerCase().trim();
        const filtered = conversations.filter(c => c.user.name.toLowerCase().includes(searchText));
        if (filtered.length === 0) {
            conversationsList.innerHTML = "<p style='padding:15px 20px; color:#718096; font-size:0.9rem;'>No conversations yet. Visit a product and tap “Chat with Seller” to get started.</p>";
            return;
        }
        conversationsList.innerHTML = "";
        filtered.forEach(convo => {
            const isActive = activeConversation && activeConversation._id === convo.user._id;
            const isOnline = onlineUserIds.has(convo.user._id);
            const row = document.createElement("div");
            row.className = "user-row" + (isActive ? " active" : "");
            row.innerHTML = `
                <div class="row-avatar" style="position:relative;">
                    ${convo.user.avatar ? `<img src="${convo.user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : "👤"}
                    <span style="position:absolute; bottom:-1px; right:-1px; width:9px; height:9px; border-radius:50%; border:2px solid #f8fafc; background:${isOnline ? "#48bb78" : "#cbd5e0"};"></span>
                </div>
                <div class="row-meta" style="flex:1;">
                    <h4>${convo.user.name}</h4>
                    <p>${convo.lastMessage ? convo.lastMessage : (convo.listingId?.title ? `Re: ${convo.listingId.title}` : "Say hello 👋")}</p>
                </div>
                ${convo.unreadCount > 0 ? `<span class="unread-badge" style="position:static;">${convo.unreadCount}</span>` : ""}
            `;
            row.addEventListener("click", () => openConversation(convo.user, convo.listingId?._id, convo.listingId?.title));
            conversationsList.appendChild(row);
        });
    }
    conversationSearch.addEventListener("input", renderConversations);

    async function openConversation(user, listingId, listingTitle) {
        activeConversation = user;
        activeListingId = listingId || null;
        activeListingTitle = listingTitle || null;
        pendingBubbles.clear();
        chatWindowHeader.style.display = "flex";
        chatInputForm.style.display = "flex";
        activeChatterHeaderName.textContent = user.name;
        activeChatterListing.textContent = activeListingTitle ? `Re: ${activeListingTitle}` : "";
        updateOnlineDot();
        setPlaceholder("Loading messages...");
        try {
            const res = await apiFetch(`/messages/${user._id}`);
            if (res.data.length === 0) {
                setPlaceholder("No messages yet. Say hello 👋");
            } else {
                chatMessageStream.innerHTML = "";
                const fragment = document.createDocumentFragment();
                res.data.forEach(msg => fragment.appendChild(buildBubbleEl(msg)));
                chatMessageStream.appendChild(fragment);
                scrollToBottom();
            }
            const convo = conversations.find(c => c.user._id === user._id);
            if (convo) convo.unreadCount = 0;
            renderConversations();
        } catch (err) {
            chatMessageStream.innerHTML = `<p class="chat-placeholder-text" style="text-align:center; color:#c53030;">${escapeHtml(err.message)}</p>`;
        }
    }

    function updateOnlineDot() {
        if (!activeConversation) return;
        onlineDot.style.background = onlineUserIds.has(activeConversation._id) ? "#48bb78" : "#cbd5e0";
    }

    function buildBubbleEl(msg) {
        const senderId = msg.sender?._id || msg.senderId;
        const isOutgoing = senderId === currentUser._id;
        const bubble = document.createElement("div");
        bubble.className = `msg-bubble ${isOutgoing ? "outgoing" : "incoming"}${msg.pending ? " pending" : ""}`;
        bubble.innerHTML = `<p>${escapeHtml(msg.text)}</p>`;
        if (msg._id) bubble.dataset.messageId = msg._id;
        return bubble;
    }

    function appendBubble(msg, autoScroll = true) {
        if (chatMessageStream.querySelector(".chat-placeholder-text")) chatMessageStream.innerHTML = "";
        const bubble = buildBubbleEl(msg);
        chatMessageStream.appendChild(bubble);
        if (msg.tempId) pendingBubbles.set(msg.tempId, bubble);
        if (autoScroll) scrollToBottom();
        return bubble;
    }

    function reconcileBubble(tempId, msg) {
        const bubble = pendingBubbles.get(tempId);
        if (bubble) {
            bubble.classList.remove("pending");
            bubble.dataset.messageId = msg._id;
        }
        pendingBubbles.delete(tempId);
    }

    function setPlaceholder(html) {
        chatMessageStream.innerHTML = `<p class="chat-placeholder-text" style="text-align:center; color:#a0aec0; margin-top:40px;">${html}</p>`;
    }
    function scrollToBottom() {
        chatMessageStream.scrollTop = chatMessageStream.scrollHeight;
    }
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    chatInputForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = typeMsgBox.value.trim();
        if (!text || !activeConversation) return;
        if (!socket.connected) {
            if (typeof csToast === "function") csToast("You're offline - reconnecting...", "error");
            return;
        }
        const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        appendBubble({
            tempId,
            senderId: currentUser._id,
            sender: { _id: currentUser._id },
            receiver: activeConversation._id,
            text,
            pending: true,
            createdAt: new Date().toISOString()
        });
        socket.emit("send_private_message", {
            senderId: currentUser._id,
            receiverId: activeConversation._id,
            text,
            listingId: activeListingId || undefined,
            tempId
        });
        typeMsgBox.value = "";
    });

    socket.on("reconnect", () => {
        socket.emit("register_user", currentUser._id);
        if (activeConversation) openConversation(activeConversation, activeListingId, activeListingTitle);
    });

    loadConversations();
});
