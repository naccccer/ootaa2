(function () {
    const appConfig = window.OOTAA_APP || { basePath: "", initialRoom: "", assets: {} };
    const pollDelay = 3000;

    const state = {
        authMode: "login",
        user: null,
        room: null,
        participant: null,
        presence: { onlineCount: 0, participants: [] },
        messages: new Map(),
        syncCursor: null,
        pollTimer: null,
        editingMessageId: null,
        replyingMessageId: null,
        contextMessageId: null,
        roomDialogMode: "join",
        selectedFiles: [],
        longPressTimer: null,
        busy: false
    };

    const dom = {
        authScreen: document.getElementById("authScreen"),
        appScreen: document.getElementById("appScreen"),
        loginTabButton: document.getElementById("loginTabButton"),
        registerTabButton: document.getElementById("registerTabButton"),
        loginForm: document.getElementById("loginForm"),
        registerForm: document.getElementById("registerForm"),
        loginMobileInput: document.getElementById("loginMobileInput"),
        loginPasswordInput: document.getElementById("loginPasswordInput"),
        registerMobileInput: document.getElementById("registerMobileInput"),
        registerNameInput: document.getElementById("registerNameInput"),
        registerPasswordInput: document.getElementById("registerPasswordInput"),
        loginSubmitButton: document.getElementById("loginSubmitButton"),
        registerSubmitButton: document.getElementById("registerSubmitButton"),
        authStatus: document.getElementById("authStatus"),
        registerNameDialog: document.getElementById("registerNameDialog"),
        registerNameForm: document.getElementById("registerNameForm"),
        registerDialogNameInput: document.getElementById("registerDialogNameInput"),
        closeRegisterNameDialogButton: document.getElementById("closeRegisterNameDialogButton"),
        submitRegisterNameButton: document.getElementById("submitRegisterNameButton"),
        registerNameStatus: document.getElementById("registerNameStatus"),
        accountName: document.getElementById("accountName"),
        accountMobile: document.getElementById("accountMobile"),
        openAccountMenuButton: document.getElementById("openAccountMenuButton"),
        accountMenuDialog: document.getElementById("accountMenuDialog"),
        closeAccountMenuButton: document.getElementById("closeAccountMenuButton"),
        openProfileButton: document.getElementById("openProfileButton"),
        openPasswordButton: document.getElementById("openPasswordButton"),
        logoutButton: document.getElementById("logoutButton"),
        recentRoomsList: document.getElementById("recentRoomsList"),
        openCreateRoomButton: document.getElementById("openCreateRoomButton"),
        openJoinRoomButton: document.getElementById("openJoinRoomButton"),
        welcomePanel: document.getElementById("welcomePanel"),
        chatPanel: document.getElementById("chatPanel"),
        welcomeCreateRoomButton: document.getElementById("welcomeCreateRoomButton"),
        welcomeJoinRoomButton: document.getElementById("welcomeJoinRoomButton"),
        roomTitle: document.getElementById("roomTitle"),
        roomSubtitle: document.getElementById("roomSubtitle"),
        openRoomMenuButton: document.getElementById("openRoomMenuButton"),
        roomMenuDialog: document.getElementById("roomMenuDialog"),
        closeRoomMenuButton: document.getElementById("closeRoomMenuButton"),
        openRoomNameButton: document.getElementById("openRoomNameButton"),
        copyRoomLinkButton: document.getElementById("copyRoomLinkButton"),
        leaveRoomButton: document.getElementById("leaveRoomButton"),
        presenceCount: document.getElementById("presenceCount"),
        presenceHint: document.getElementById("presenceHint"),
        presenceList: document.getElementById("presenceList"),
        chatStatus: document.getElementById("chatStatus"),
        messagesList: document.getElementById("messagesList"),
        messageMenuDialog: document.getElementById("messageMenuDialog"),
        closeMessageMenuButton: document.getElementById("closeMessageMenuButton"),
        messageReplyButton: document.getElementById("messageReplyButton"),
        messageCopyButton: document.getElementById("messageCopyButton"),
        messageForwardButton: document.getElementById("messageForwardButton"),
        messageEditButton: document.getElementById("messageEditButton"),
        messageDeleteButton: document.getElementById("messageDeleteButton"),
        composerForm: document.getElementById("composerForm"),
        replyBanner: document.getElementById("replyBanner"),
        replyBannerText: document.getElementById("replyBannerText"),
        cancelReplyButton: document.getElementById("cancelReplyButton"),
        editBanner: document.getElementById("editBanner"),
        editBannerText: document.getElementById("editBannerText"),
        cancelEditButton: document.getElementById("cancelEditButton"),
        selectedFilesList: document.getElementById("selectedFilesList"),
        fileInput: document.getElementById("fileInput"),
        messageInput: document.getElementById("messageInput"),
        sendButton: document.getElementById("sendButton"),
        roomDialog: document.getElementById("roomDialog"),
        roomDialogTitle: document.getElementById("roomDialogTitle"),
        roomDialogDescription: document.getElementById("roomDialogDescription"),
        roomDialogForm: document.getElementById("roomDialogForm"),
        roomCodeInput: document.getElementById("roomCodeInput"),
        closeRoomDialogButton: document.getElementById("closeRoomDialogButton"),
        submitRoomDialogButton: document.getElementById("submitRoomDialogButton"),
        roomDialogStatus: document.getElementById("roomDialogStatus"),
        profileDialog: document.getElementById("profileDialog"),
        profileForm: document.getElementById("profileForm"),
        profileMobileInput: document.getElementById("profileMobileInput"),
        profileNameInput: document.getElementById("profileNameInput"),
        closeProfileDialogButton: document.getElementById("closeProfileDialogButton"),
        saveProfileButton: document.getElementById("saveProfileButton"),
        profileStatus: document.getElementById("profileStatus"),
        passwordDialog: document.getElementById("passwordDialog"),
        passwordForm: document.getElementById("passwordForm"),
        currentPasswordInput: document.getElementById("currentPasswordInput"),
        newPasswordInput: document.getElementById("newPasswordInput"),
        closePasswordDialogButton: document.getElementById("closePasswordDialogButton"),
        savePasswordButton: document.getElementById("savePasswordButton"),
        passwordStatus: document.getElementById("passwordStatus"),
        roomNameDialog: document.getElementById("roomNameDialog"),
        roomNameForm: document.getElementById("roomNameForm"),
        roomNameInput: document.getElementById("roomNameInput"),
        closeRoomNameDialogButton: document.getElementById("closeRoomNameDialogButton"),
        saveRoomNameButton: document.getElementById("saveRoomNameButton"),
        roomNameStatus: document.getElementById("roomNameStatus")
    };

    function apiPath(path) {
        return `${appConfig.basePath || ""}${path}`;
    }

    function roomPath(roomCode) {
        return apiPath(`/room/${roomCode}`);
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function removeStorage(key) {
        localStorage.removeItem(key);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }

        const date = new Date(String(value).replace(" ", "T"));

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function formatRoomTitle(room) {
        if (!room) {
            return "اتاق";
        }

        return room.name || `اتاق ${room.code}`;
    }

    function formatSize(sizeBytes) {
        if (sizeBytes < 1024) {
            return `${sizeBytes} بایت`;
        }

        if (sizeBytes < 1024 * 1024) {
            return `${(sizeBytes / 1024).toFixed(1)} کیلوبایت`;
        }

        return `${(sizeBytes / (1024 * 1024)).toFixed(1)} مگابایت`;
    }

    function setStatus(target, message, isError) {
        if (!message) {
            target.hidden = true;
            target.textContent = "";
            target.classList.remove("is-error");
            return;
        }

        target.hidden = false;
        target.textContent = message;
        target.classList.toggle("is-error", Boolean(isError));
    }

    async function fetchJson(url, options = {}) {
        const isFormData = options.body instanceof FormData;
        const response = await fetch(url, {
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...(isFormData ? {} : { "Content-Type": "application/json" }),
                ...(options.headers || {})
            },
            ...options
        });

        const raw = await response.text();
        let payload = null;

        try {
            payload = raw ? JSON.parse(raw) : null;
        } catch (error) {
            throw new Error("پاسخ سرور معتبر نیست.");
        }

        if (response.status === 401) {
            handleUnauthorized();
            throw new Error(payload?.error?.message || "نشست شما منقضی شده است.");
        }

        if (response.status >= 400 || !payload?.ok) {
            throw new Error(payload?.error?.message || "درخواست انجام نشد.");
        }

        return payload.data;
    }

    function userStorageKey(suffix) {
        return state.user ? `ootaa:${suffix}:user:${state.user.id}` : "";
    }

    function getRecentRooms() {
        return state.user ? readJson(userStorageKey("recent-rooms"), []) : [];
    }

    function setRecentRooms(rooms) {
        if (!state.user) {
            return;
        }

        writeJson(userStorageKey("recent-rooms"), rooms);
    }

    function getActiveRoomCode() {
        return state.user ? (readJson(userStorageKey("active-room"), {}).roomCode || "") : "";
    }

    function setActiveRoomCode(roomCode) {
        if (!state.user) {
            return;
        }

        writeJson(userStorageKey("active-room"), { roomCode });
    }

    function clearActiveRoomCode() {
        if (!state.user) {
            return;
        }

        removeStorage(userStorageKey("active-room"));
    }

    function rememberRoom(room) {
        if (!state.user || !room) {
            return;
        }

        const rooms = getRecentRooms();
        const next = [
            {
                roomCode: room.code,
                roomName: room.name || "",
                visitedAt: new Date().toISOString()
            },
            ...rooms.filter((item) => item.roomCode !== room.code)
        ].slice(0, 15);

        setRecentRooms(next);
    }

    function updateRememberedRoomName(room) {
        if (!state.user || !room) {
            return;
        }

        setRecentRooms(getRecentRooms().map((item) => (
            item.roomCode === room.code
                ? { ...item, roomName: room.name || "" }
                : item
        )));
    }

    function clearSelectedFiles() {
        state.selectedFiles.forEach((entry) => {
            if (entry.previewUrl) {
                URL.revokeObjectURL(entry.previewUrl);
            }
        });

        state.selectedFiles = [];
        dom.fileInput.value = "";
        renderSelectedFiles();
    }

    function toSelectedFileEntry(file) {
        const previewKind = file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
                ? "video"
                : file.type.startsWith("audio/")
                    ? "audio"
                    : "download";

        return {
            id: `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 7)}`,
            file,
            previewKind,
            previewUrl: previewKind === "image" || previewKind === "video" ? URL.createObjectURL(file) : null
        };
    }

    function renderSelectedFiles() {
        if (state.selectedFiles.length === 0) {
            dom.selectedFilesList.hidden = true;
            dom.selectedFilesList.innerHTML = "";
            return;
        }

        dom.selectedFilesList.hidden = false;
        dom.selectedFilesList.innerHTML = state.selectedFiles.map((entry) => `
            <div class="selected-file" data-file-id="${escapeHtml(entry.id)}">
                <div>
                    <strong>${escapeHtml(entry.file.name)}</strong>
                    <div class="selected-file__meta">${escapeHtml(formatSize(entry.file.size))}</div>
                </div>
                <button type="button" class="icon-button close-button" data-action="remove-file" data-file-id="${escapeHtml(entry.id)}" aria-label="حذف فایل"></button>
            </div>
        `).join("");
    }

    function renderAuthMode() {
        const isLogin = state.authMode === "login";
        dom.loginTabButton.classList.toggle("is-active", isLogin);
        dom.registerTabButton.classList.toggle("is-active", !isLogin);
        dom.loginForm.hidden = !isLogin;
        dom.registerForm.hidden = isLogin;
        setStatus(dom.authStatus, "", false);
    }

    function renderShell() {
        const loggedIn = Boolean(state.user);
        dom.authScreen.hidden = loggedIn;
        dom.appScreen.hidden = !loggedIn;
        dom.appScreen.classList.toggle("has-room", Boolean(state.room));

        if (!loggedIn) {
            return;
        }

        dom.accountName.textContent = state.user.displayName;
        dom.accountMobile.textContent = state.user.mobileDisplay;
        dom.welcomePanel.hidden = Boolean(state.room);
        dom.chatPanel.hidden = !state.room;
        renderRecentRooms();
        renderRoomMeta();
        renderPresence();
        renderComposerState();
    }

    function renderRecentRooms() {
        if (!state.user) {
            dom.recentRoomsList.innerHTML = "";
            return;
        }

        const rooms = getRecentRooms();

        if (rooms.length === 0) {
            dom.recentRoomsList.innerHTML = '<div class="recent-room recent-room--empty"><div class="recent-room__meta">اتاقی نیست.</div></div>';
            return;
        }

        dom.recentRoomsList.innerHTML = rooms.map((room) => {
            const isActive = state.room?.code === room.roomCode;
            const title = room.roomName || `اتاق ${room.roomCode}`;
            const colorIndex = Number(room.roomCode || 0) % 4;
            return `
                <button type="button" class="recent-room recent-room--tone-${colorIndex}${isActive ? " is-active" : ""}" data-room-code="${escapeHtml(room.roomCode)}">
                    <span class="recent-room__avatar" aria-hidden="true"></span>
                    <span class="recent-room__content">
                        <span class="recent-room__title">${escapeHtml(title)}</span>
                        <span class="recent-room__meta">${escapeHtml(room.roomCode)} • ${escapeHtml(formatDate(room.visitedAt))}</span>
                    </span>
                    <span class="recent-room__chevron" aria-hidden="true"></span>
                </button>
            `;
        }).join("");
    }

    function renderRoomMeta() {
        if (!state.room) {
            dom.roomTitle.textContent = "اتاق";
            dom.roomSubtitle.textContent = "-";
            dom.openRoomNameButton.hidden = true;
            return;
        }

        dom.roomTitle.textContent = formatRoomTitle(state.room);
        dom.roomSubtitle.textContent = `${formatDate(state.room.lastActivityAt)} • ${state.room.code}`;
        dom.openRoomNameButton.hidden = !state.room.isCreator;
    }

    function renderPresence() {
        const count = state.presence?.onlineCount || 0;
        dom.presenceCount.textContent = `${new Intl.NumberFormat("fa-IR").format(count)} آنلاین`;
        dom.presenceHint.textContent = count > 0 ? "" : "خلوت";
        const participants = state.presence?.participants || [];

        dom.presenceList.innerHTML = participants.map((participant) => `
            <div class="presence-pill">${escapeHtml(participant.displayName)} • ${escapeHtml(participant.mobileDisplay)}</div>
        `).join("");
    }

    function renderComposerState() {
        const hasText = dom.messageInput.value.trim() !== "";
        const hasFiles = state.selectedFiles.length > 0;
        const canSend = state.room && !state.busy && (state.editingMessageId ? hasText : (hasText || hasFiles));

        dom.sendButton.disabled = !canSend;
        dom.fileInput.disabled = Boolean(state.editingMessageId || state.busy);
        dom.replyBanner.hidden = !state.replyingMessageId;
        dom.editBanner.hidden = !state.editingMessageId;
    }

    function renderMessages() {
        const messages = Array.from(state.messages.values()).sort((left, right) => left.id - right.id);

        if (messages.length === 0) {
            dom.messagesList.innerHTML = '<div class="message message--empty"><div class="message__body">اولین پیام را بنویسید.</div></div>';
            return;
        }

        dom.messagesList.innerHTML = messages.map((message) => {
            const attachments = renderAttachments(message.attachments || []);
            const replyMarkup = message.replyTo ? `
                <div class="message__reply">
                    <div class="message__reply-meta">${escapeHtml(message.replyTo.senderName)} • ${escapeHtml(message.replyTo.senderMobile || "")}</div>
                    <div>${escapeHtml(message.replyTo.isDeleted ? "این پیام حذف شده است." : (message.replyTo.bodyText || "فایل"))}</div>
                </div>
            ` : "";
            const bodyText = message.isDeleted
                ? '<div class="message__body">این پیام حذف شده است.</div>'
                : `<div class="message__body">${escapeHtml(message.bodyText || "")}</div>`;
            return `
                <article class="message${message.isOwn ? " is-own" : ""}" data-message-id="${message.id}" tabindex="0">
                    <div class="message__head">
                        <div class="message__author">
                            <strong>${escapeHtml(message.senderName)}</strong>
                        </div>
                        <div class="message__time">${escapeHtml(formatDate(message.updatedAt))}${message.isEdited ? " • ویرایش‌شده" : ""}</div>
                    </div>
                    ${replyMarkup}
                    ${bodyText}
                    ${attachments}
                </article>
            `;
        }).join("");

        dom.messagesList.scrollTop = dom.messagesList.scrollHeight;
    }

    function renderAttachments(attachments) {
        if (!attachments || attachments.length === 0) {
            return "";
        }

        return `
            <div class="message__attachments">
                ${attachments.map((attachment) => `
                    <div class="attachment">
                        ${renderAttachmentPreview(attachment)}
                        <div class="attachment__meta">
                            <span>${escapeHtml(attachment.name)}</span>
                            <span>${escapeHtml(formatSize(attachment.sizeBytes))}</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function renderAttachmentPreview(attachment) {
        if (attachment.previewKind === "image") {
            return `<a href="${escapeHtml(attachment.url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name)}"></a>`;
        }

        if (attachment.previewKind === "video") {
            return `<video controls preload="metadata" src="${escapeHtml(attachment.url)}"></video>`;
        }

        if (attachment.previewKind === "audio") {
            return `<audio controls preload="metadata" src="${escapeHtml(attachment.url)}"></audio>`;
        }

        return `<a class="secondary-button" href="${escapeHtml(attachment.url)}" target="_blank" rel="noreferrer">دانلود فایل</a>`;
    }

    function applyBootstrapData(data) {
        state.room = data.room || null;
        state.participant = data.participant || null;
        state.presence = data.presence || { onlineCount: 0, participants: [] };
        state.syncCursor = data.syncCursor || null;
        state.messages.clear();

        (data.messages || []).forEach((message) => {
            state.messages.set(message.id, message);
        });

        if (state.room) {
            rememberRoom(state.room);
            setActiveRoomCode(state.room.code);
        }

        renderShell();
        renderMessages();
    }

    function applySyncData(data) {
        state.room = data.room || state.room;
        state.presence = data.presence || state.presence;
        state.syncCursor = data.syncCursor || state.syncCursor;

        (data.messages || []).forEach((message) => {
            state.messages.set(message.id, message);
        });

        if (state.room) {
            rememberRoom(state.room);
            updateRememberedRoomName(state.room);
        }

        renderRoomMeta();
        renderPresence();
        renderMessages();
    }

    function handleUnauthorized() {
        stopPolling();
        state.user = null;
        state.room = null;
        state.participant = null;
        state.presence = { onlineCount: 0, participants: [] };
        state.messages.clear();
        state.syncCursor = null;
        state.editingMessageId = null;
        state.replyingMessageId = null;
        state.contextMessageId = null;
        clearSelectedFiles();
        renderShell();
        setStatus(dom.authStatus, "نشست شما منقضی شده است. دوباره وارد شوید.", true);
    }

    async function loadCurrentUser() {
        const data = await fetchJson(apiPath("/api/auth/me"), {
            method: "GET"
        });

        state.user = data.user || null;
        renderShell();
    }

    async function restoreSession() {
        try {
            await loadCurrentUser();
        } catch (error) {
            state.user = null;
        }

        if (!state.user) {
            renderShell();
            return;
        }

        const preferredRoom = appConfig.initialRoom || getActiveRoomCode();

        if (preferredRoom) {
            try {
                await enterRoom(preferredRoom, true);
            } catch (error) {
                clearActiveRoomCode();
                setStatus(dom.chatStatus, error.message, true);
            }
        }
    }

    async function enterRoom(roomCode, isAutomatic) {
        if (!state.user) {
            return;
        }

        setStatus(dom.chatStatus, "", false);

        const payload = {
            roomCode: roomCode || ""
        };

        const data = await fetchJson(apiPath("/api/room/enter"), {
            method: "POST",
            body: JSON.stringify(payload)
        });

        state.room = data.room;
        state.participant = data.participant;
        state.presence = data.presence || state.presence;
        rememberRoom(state.room);
        setActiveRoomCode(state.room.code);
        renderShell();

        await bootstrapRoom();

        if (!isAutomatic) {
            closeRoomDialog();
        }
    }

    async function bootstrapRoom() {
        if (!state.room) {
            return;
        }

        const data = await fetchJson(`${apiPath("/api/room/bootstrap")}?code=${encodeURIComponent(state.room.code)}`, {
            method: "GET"
        });
        applyBootstrapData(data);
        startPolling();
    }

    function leaveRoom() {
        stopPolling();
        state.room = null;
        state.participant = null;
        state.presence = { onlineCount: 0, participants: [] };
        state.messages.clear();
        state.syncCursor = null;
        state.editingMessageId = null;
        state.replyingMessageId = null;
        dom.messageInput.value = "";
        clearSelectedFiles();
        clearActiveRoomCode();
        renderShell();
        renderMessages();
        setStatus(dom.chatStatus, "", false);
    }

    async function syncMessages() {
        if (!state.room) {
            return;
        }

        const params = new URLSearchParams({ code: state.room.code });

        if (state.syncCursor) {
            params.set("since", state.syncCursor);
        }

        const data = await fetchJson(`${apiPath("/api/room/messages")}?${params.toString()}`, {
            method: "GET"
        });
        applySyncData(data);
    }

    function stopPolling() {
        window.clearTimeout(state.pollTimer);
        state.pollTimer = null;
    }

    function startPolling() {
        stopPolling();

        const tick = async () => {
            if (!state.room) {
                return;
            }

            try {
                await syncMessages();
            } catch (error) {
                setStatus(dom.chatStatus, error.message, true);
            } finally {
                if (state.room) {
                    state.pollTimer = window.setTimeout(tick, pollDelay);
                }
            }
        };

        state.pollTimer = window.setTimeout(tick, pollDelay);
    }

    async function handleAuthSubmit(mode, form) {
        state.busy = true;
        renderComposerState();
        setStatus(dom.authStatus, "", false);

        try {
            const formData = new FormData(form);
            const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
            const data = await fetchJson(apiPath(endpoint), {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(formData.entries()))
            });
            state.user = data.user;
            renderShell();

            if (appConfig.initialRoom) {
                await enterRoom(appConfig.initialRoom, true);
            } else if (getActiveRoomCode()) {
                await enterRoom(getActiveRoomCode(), true);
            }

            return true;
        } catch (error) {
            setStatus(dom.authStatus, error.message, true);
            return false;
        } finally {
            state.busy = false;
            renderComposerState();
        }
    }

    async function handleLogout() {
        try {
            await fetchJson(apiPath("/api/auth/logout"), {
                method: "POST",
                body: JSON.stringify({})
            });
        } catch (error) {
            // keep UI logout resilient
        }

        leaveRoom();
        handleUnauthorized();
    }

    async function submitProfile(event) {
        event.preventDefault();
        setStatus(dom.profileStatus, "", false);

        try {
            const data = await fetchJson(apiPath("/api/account/profile"), {
                method: "PATCH",
                body: JSON.stringify({
                    displayName: dom.profileNameInput.value.trim()
                })
            });
            state.user = data.user;
            renderShell();
            dom.profileDialog.close();
        } catch (error) {
            setStatus(dom.profileStatus, error.message, true);
        }
    }

    async function submitPassword(event) {
        event.preventDefault();
        setStatus(dom.passwordStatus, "", false);

        try {
            const data = await fetchJson(apiPath("/api/account/password"), {
                method: "PATCH",
                body: JSON.stringify({
                    currentPassword: dom.currentPasswordInput.value,
                    newPassword: dom.newPasswordInput.value
                })
            });
            state.user = data.user;
            dom.passwordDialog.close();
            dom.passwordForm.reset();
            renderShell();
        } catch (error) {
            setStatus(dom.passwordStatus, error.message, true);
        }
    }

    async function submitRoomName(event) {
        event.preventDefault();

        if (!state.room) {
            return;
        }

        setStatus(dom.roomNameStatus, "", false);

        try {
            const data = await fetchJson(apiPath("/api/room/name"), {
                method: "PATCH",
                body: JSON.stringify({
                    roomCode: state.room.code,
                    name: dom.roomNameInput.value.trim()
                })
            });
            state.room = data.room;
            state.participant = data.participant || state.participant;
            state.presence = data.presence || state.presence;
            updateRememberedRoomName(state.room);
            renderRoomMeta();
            dom.roomNameDialog.close();
        } catch (error) {
            setStatus(dom.roomNameStatus, error.message, true);
        }
    }

    async function submitComposer(event) {
        event.preventDefault();

        if (!state.room || state.busy) {
            return;
        }

        setStatus(dom.chatStatus, "", false);
        state.busy = true;
        renderComposerState();

        try {
            if (state.editingMessageId) {
                const data = await fetchJson(apiPath(`/api/messages/${state.editingMessageId}`), {
                    method: "PATCH",
                    body: JSON.stringify({
                        text: dom.messageInput.value.trim()
                    })
                });
                state.messages.set(data.message.id, data.message);
                state.room = data.room || state.room;
                state.presence = data.presence || state.presence;
                exitEditMode();
                dom.messageInput.value = "";
                renderRoomMeta();
                renderPresence();
                renderMessages();
            } else {
                const formData = new FormData();
                formData.append("roomCode", state.room.code);
                formData.append("text", dom.messageInput.value.trim());

                if (state.replyingMessageId) {
                    formData.append("replyToMessageId", String(state.replyingMessageId));
                }

                state.selectedFiles.forEach((entry) => {
                    formData.append("files[]", entry.file);
                });

                const data = await fetchJson(apiPath("/api/room/messages"), {
                    method: "POST",
                    body: formData
                });
                state.messages.set(data.message.id, data.message);
                state.room = data.room || state.room;
                state.presence = data.presence || state.presence;
                dom.messageInput.value = "";
                clearSelectedFiles();
                exitReplyMode();
                renderRoomMeta();
                renderPresence();
                renderMessages();
            }
        } catch (error) {
            setStatus(dom.chatStatus, error.message, true);
        } finally {
            state.busy = false;
            renderComposerState();
        }
    }

    function enterReplyMode(messageId) {
        const message = state.messages.get(messageId);

        if (!message || message.isDeleted) {
            return;
        }

        state.replyingMessageId = messageId;
        dom.replyBannerText.textContent = `${message.senderName}: ${message.bodyText || "فایل"}`;
        renderComposerState();
        dom.messageInput.focus();
    }

    function exitReplyMode() {
        state.replyingMessageId = null;
        dom.replyBannerText.textContent = "";
        renderComposerState();
    }

    function enterEditMode(messageId) {
        const message = state.messages.get(messageId);

        if (!message || !message.isOwn || message.isDeleted) {
            return;
        }

        state.editingMessageId = messageId;
        dom.messageInput.value = message.bodyText || "";
        clearSelectedFiles();
        renderComposerState();
        dom.messageInput.focus();
    }

    function exitEditMode() {
        state.editingMessageId = null;
        renderComposerState();
    }

    async function deleteMessage(messageId) {
        setStatus(dom.chatStatus, "", false);

        try {
            const data = await fetchJson(apiPath(`/api/messages/${messageId}`), {
                method: "DELETE",
                body: JSON.stringify({})
            });
            state.messages.set(data.message.id, data.message);
            state.room = data.room || state.room;
            state.presence = data.presence || state.presence;
            renderRoomMeta();
            renderPresence();
            renderMessages();
        } catch (error) {
            setStatus(dom.chatStatus, error.message, true);
        }
    }

    function getContextMessage() {
        return state.contextMessageId ? state.messages.get(state.contextMessageId) : null;
    }

    function openMessageMenu(messageId) {
        const message = state.messages.get(messageId);

        if (!message || message.isDeleted) {
            return;
        }

        state.contextMessageId = messageId;
        dom.messageEditButton.hidden = !message.isOwn;
        dom.messageDeleteButton.hidden = !message.isOwn;

        if (!dom.messageMenuDialog.open) {
            dom.messageMenuDialog.showModal();
        }
    }

    function closeMessageMenu() {
        if (dom.messageMenuDialog.open) {
            dom.messageMenuDialog.close();
        }
    }

    async function copyMessageText() {
        const message = getContextMessage();

        if (!message || !message.bodyText) {
            closeMessageMenu();
            return;
        }

        try {
            await navigator.clipboard.writeText(message.bodyText);
            setStatus(dom.chatStatus, "پیام کپی شد.", false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی انجام نشد.", true);
        } finally {
            closeMessageMenu();
        }
    }

    function forwardMessageText() {
        const message = getContextMessage();

        if (!message || !message.bodyText) {
            closeMessageMenu();
            return;
        }

        dom.messageInput.value = message.bodyText;
        renderComposerState();
        closeMessageMenu();
        dom.messageInput.focus();
    }

    function openRoomDialog(mode) {
        state.roomDialogMode = mode;
        const joining = mode === "join";
        dom.roomDialogTitle.textContent = joining ? "ورود به اتاق" : "ساخت اتاق جدید";
        dom.roomDialogDescription.textContent = joining ? "" : "";
        dom.roomCodeInput.value = joining ? (appConfig.initialRoom || "") : "";
        dom.roomCodeInput.disabled = !joining;
        dom.roomCodeInput.closest(".field").hidden = !joining;
        dom.submitRoomDialogButton.textContent = joining ? "ورود" : "ساخت";
        dom.roomDialog.showModal();
        setStatus(dom.roomDialogStatus, "", false);
    }

    function openRegisterNameDialog() {
        dom.registerDialogNameInput.value = dom.registerNameInput.value || "";
        setStatus(dom.registerNameStatus, "", false);
        setStatus(dom.authStatus, "", false);
        dom.registerNameDialog.showModal();
        dom.registerDialogNameInput.focus();
    }

    function closeRegisterNameDialog() {
        if (dom.registerNameDialog.open) {
            dom.registerNameDialog.close();
        }
        setStatus(dom.registerNameStatus, "", false);
    }

    function openAccountMenu() {
        if (!dom.accountMenuDialog.open) {
            dom.accountMenuDialog.showModal();
        }
    }

    function closeAccountMenu() {
        if (dom.accountMenuDialog.open) {
            dom.accountMenuDialog.close();
        }
    }

    function openRoomMenu() {
        if (!state.room) {
            return;
        }

        if (!dom.roomMenuDialog.open) {
            dom.roomMenuDialog.showModal();
        }
    }

    function closeRoomMenu() {
        if (dom.roomMenuDialog.open) {
            dom.roomMenuDialog.close();
        }
    }

    function closeRoomDialog() {
        if (dom.roomDialog.open) {
            dom.roomDialog.close();
        }
        setStatus(dom.roomDialogStatus, "", false);
    }

    function openProfileDialog() {
        if (!state.user) {
            return;
        }

        dom.profileMobileInput.value = state.user.mobileDisplay;
        dom.profileNameInput.value = state.user.displayName;
        setStatus(dom.profileStatus, "", false);
        dom.profileDialog.showModal();
    }

    function openPasswordDialog() {
        setStatus(dom.passwordStatus, "", false);
        dom.passwordForm.reset();
        dom.passwordDialog.showModal();
    }

    function openRoomNameDialog() {
        if (!state.room) {
            return;
        }

        dom.roomNameInput.value = state.room.name || "";
        setStatus(dom.roomNameStatus, "", false);
        dom.roomNameDialog.showModal();
    }

    function bindEvents() {
        dom.loginTabButton.addEventListener("click", () => {
            state.authMode = "login";
            renderAuthMode();
        });

        dom.registerTabButton.addEventListener("click", () => {
            state.authMode = "register";
            renderAuthMode();
        });

        dom.loginForm.addEventListener("submit", (event) => {
            event.preventDefault();
            handleAuthSubmit("login", dom.loginForm);
        });

        dom.registerForm.addEventListener("submit", (event) => {
            event.preventDefault();
            openRegisterNameDialog();
        });

        dom.logoutButton.addEventListener("click", () => {
            closeAccountMenu();
            handleLogout();
        });
        dom.openAccountMenuButton.addEventListener("click", openAccountMenu);
        dom.closeAccountMenuButton.addEventListener("click", closeAccountMenu);
        dom.openRoomMenuButton.addEventListener("click", openRoomMenu);
        dom.closeRoomMenuButton.addEventListener("click", closeRoomMenu);
        dom.closeMessageMenuButton.addEventListener("click", closeMessageMenu);
        dom.messageReplyButton.addEventListener("click", () => {
            const message = getContextMessage();
            closeMessageMenu();

            if (message) {
                enterReplyMode(message.id);
            }
        });
        dom.messageCopyButton.addEventListener("click", copyMessageText);
        dom.messageForwardButton.addEventListener("click", forwardMessageText);
        dom.messageEditButton.addEventListener("click", () => {
            const message = getContextMessage();
            closeMessageMenu();

            if (message) {
                enterEditMode(message.id);
            }
        });
        dom.messageDeleteButton.addEventListener("click", () => {
            const message = getContextMessage();
            closeMessageMenu();

            if (message) {
                deleteMessage(message.id);
            }
        });
        dom.registerNameForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const displayName = dom.registerDialogNameInput.value.trim();

            if (!displayName) {
                setStatus(dom.registerNameStatus, "نام را وارد کنید.", true);
                dom.registerDialogNameInput.focus();
                return;
            }

            dom.registerNameInput.value = displayName;
            const registered = await handleAuthSubmit("register", dom.registerForm);

            if (registered) {
                closeRegisterNameDialog();
            } else {
                setStatus(dom.registerNameStatus, dom.authStatus.textContent || "ثبت‌نام انجام نشد.", true);
            }
        });
        dom.closeRegisterNameDialogButton.addEventListener("click", closeRegisterNameDialog);
        dom.openProfileButton.addEventListener("click", () => {
            closeAccountMenu();
            openProfileDialog();
        });
        dom.openPasswordButton.addEventListener("click", () => {
            closeAccountMenu();
            openPasswordDialog();
        });
        dom.profileForm.addEventListener("submit", submitProfile);
        dom.passwordForm.addEventListener("submit", submitPassword);
        dom.roomNameForm.addEventListener("submit", submitRoomName);
        dom.closeProfileDialogButton.addEventListener("click", () => dom.profileDialog.close());
        dom.closePasswordDialogButton.addEventListener("click", () => dom.passwordDialog.close());
        dom.closeRoomNameDialogButton.addEventListener("click", () => dom.roomNameDialog.close());
        dom.openRoomNameButton.addEventListener("click", () => {
            closeRoomMenu();
            openRoomNameDialog();
        });

        dom.openCreateRoomButton.addEventListener("click", () => openRoomDialog("create"));
        dom.openJoinRoomButton.addEventListener("click", () => openRoomDialog("join"));
        dom.welcomeCreateRoomButton.addEventListener("click", () => openRoomDialog("create"));
        dom.welcomeJoinRoomButton.addEventListener("click", () => openRoomDialog("join"));
        dom.closeRoomDialogButton.addEventListener("click", closeRoomDialog);
        dom.roomDialogForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            setStatus(dom.roomDialogStatus, "", false);

            try {
                const roomCode = state.roomDialogMode === "join" ? dom.roomCodeInput.value.trim() : "";
                await enterRoom(roomCode, false);
            } catch (error) {
                setStatus(dom.roomDialogStatus, error.message, true);
            }
        });

        dom.recentRoomsList.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-room-code]");

            if (!button) {
                return;
            }

            try {
                await enterRoom(button.dataset.roomCode || "", false);
            } catch (error) {
                setStatus(dom.chatStatus, error.message, true);
            }
        });

        dom.leaveRoomButton.addEventListener("click", leaveRoom);
        dom.copyRoomLinkButton.addEventListener("click", async () => {
            if (!state.room) {
                return;
            }

            try {
                await navigator.clipboard.writeText(window.location.origin + roomPath(state.room.code));
                closeRoomMenu();
                setStatus(dom.chatStatus, "لینک اتاق کپی شد.", false);
            } catch (error) {
                setStatus(dom.chatStatus, "کپی خودکار انجام نشد.", true);
            }
        });

        dom.fileInput.addEventListener("change", () => {
            clearSelectedFiles();
            state.selectedFiles = Array.from(dom.fileInput.files || []).map(toSelectedFileEntry);
            renderSelectedFiles();
            renderComposerState();
        });

        dom.selectedFilesList.addEventListener("click", (event) => {
            const button = event.target.closest('[data-action="remove-file"]');

            if (!button) {
                return;
            }

            const fileId = button.dataset.fileId || "";
            const target = state.selectedFiles.find((entry) => entry.id === fileId);

            if (target?.previewUrl) {
                URL.revokeObjectURL(target.previewUrl);
            }

            state.selectedFiles = state.selectedFiles.filter((entry) => entry.id !== fileId);
            renderSelectedFiles();
            renderComposerState();
        });

        dom.composerForm.addEventListener("submit", submitComposer);
        dom.messageInput.addEventListener("input", renderComposerState);
        dom.cancelReplyButton.addEventListener("click", exitReplyMode);
        dom.cancelEditButton.addEventListener("click", () => {
            exitEditMode();
            dom.messageInput.value = "";
        });

        dom.messagesList.addEventListener("contextmenu", (event) => {
            const message = event.target.closest("[data-message-id]");

            if (!message || event.target.closest("a, button, input, video, audio")) {
                return;
            }

            event.preventDefault();
            openMessageMenu(Number(message.dataset.messageId || 0));
        });

        dom.messagesList.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" || event.target.closest("a, button, input, video, audio")) {
                return;
            }

            const message = event.target.closest("[data-message-id]");

            if (!message) {
                return;
            }

            window.clearTimeout(state.longPressTimer);
            state.longPressTimer = window.setTimeout(() => {
                openMessageMenu(Number(message.dataset.messageId || 0));
            }, 520);
        });

        ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
            dom.messagesList.addEventListener(eventName, () => {
                window.clearTimeout(state.longPressTimer);
                state.longPressTimer = null;
            });
        });

        dom.messagesList.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            const message = event.target.closest("[data-message-id]");

            if (!message) {
                return;
            }

            event.preventDefault();
            openMessageMenu(Number(message.dataset.messageId || 0));
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && state.room) {
                syncMessages().catch(() => {});
            }
        });
    }

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator) || !appConfig.assets?.serviceWorker) {
            return;
        }

        window.addEventListener("load", () => {
            navigator.serviceWorker.register(appConfig.assets.serviceWorker, {
                scope: `${appConfig.basePath || ""}/`
            }).catch(() => {});
        });
    }

    bindEvents();
    renderAuthMode();
    renderShell();
    renderMessages();
    renderSelectedFiles();
    registerServiceWorker();
    restoreSession();
})();
