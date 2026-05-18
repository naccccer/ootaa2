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
        renderedMessageIds: new Set(),
        editingMessageId: null,
        replyingMessageId: null,
        contextMessageId: null,
        contextRoomCode: null,
        contextAttachmentId: null,
        selectingRooms: false,
        selectedRoomCodes: new Set(),
        selectingMessages: false,
        selectedMessageIds: new Set(),
        roomDialogMode: "join",
        selectedFiles: [],
        dragDepth: 0,
        longPressTimer: null,
        roomLongPressTimer: null,
        contactSearchTimer: null,
        roomContextOpenedByPress: false,
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
        sidebar: document.querySelector(".sidebar"),
        recentRoomsList: document.getElementById("recentRoomsList"),
        quickRoomForm: document.getElementById("quickRoomForm"),
        quickRoomCodeInput: document.getElementById("quickRoomCodeInput"),
        quickJoinRoomButton: document.getElementById("quickJoinRoomButton"),
        quickCreateRoomButton: document.getElementById("quickCreateRoomButton"),
        toggleContactSearchButton: document.getElementById("toggleContactSearchButton"),
        contactSearchPanel: document.getElementById("contactSearchPanel"),
        contactSearchInput: document.getElementById("contactSearchInput"),
        contactSearchResults: document.getElementById("contactSearchResults"),
        roomSelectionBar: document.getElementById("roomSelectionBar"),
        roomSelectionCount: document.getElementById("roomSelectionCount"),
        deleteSelectedRoomsButton: document.getElementById("deleteSelectedRoomsButton"),
        cancelRoomSelectionButton: document.getElementById("cancelRoomSelectionButton"),
        welcomePanel: document.getElementById("welcomePanel"),
        chatPanel: document.getElementById("chatPanel"),
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
        chatDropOverlay: document.getElementById("chatDropOverlay"),
        messageSelectionBar: document.getElementById("messageSelectionBar"),
        messageSelectionCount: document.getElementById("messageSelectionCount"),
        copySelectedMessagesButton: document.getElementById("copySelectedMessagesButton"),
        forwardSelectedMessagesButton: document.getElementById("forwardSelectedMessagesButton"),
        deleteSelectedMessagesButton: document.getElementById("deleteSelectedMessagesButton"),
        cancelMessageSelectionButton: document.getElementById("cancelMessageSelectionButton"),
        messageMenuDialog: document.getElementById("messageMenuDialog"),
        closeMessageMenuButton: document.getElementById("closeMessageMenuButton"),
        messageReplyButton: document.getElementById("messageReplyButton"),
        messageSelectButton: document.getElementById("messageSelectButton"),
        messageCopyButton: document.getElementById("messageCopyButton"),
        messageForwardButton: document.getElementById("messageForwardButton"),
        messageEditButton: document.getElementById("messageEditButton"),
        messageDeleteButton: document.getElementById("messageDeleteButton"),
        attachmentMenuDialog: document.getElementById("attachmentMenuDialog"),
        closeAttachmentMenuButton: document.getElementById("closeAttachmentMenuButton"),
        attachmentOpenButton: document.getElementById("attachmentOpenButton"),
        attachmentDownloadButton: document.getElementById("attachmentDownloadButton"),
        attachmentCopyButton: document.getElementById("attachmentCopyButton"),
        attachmentReplyButton: document.getElementById("attachmentReplyButton"),
        attachmentSelectButton: document.getElementById("attachmentSelectButton"),
        attachmentDeleteButton: document.getElementById("attachmentDeleteButton"),
        roomContextMenuDialog: document.getElementById("roomContextMenuDialog"),
        closeRoomContextMenuButton: document.getElementById("closeRoomContextMenuButton"),
        roomContextSelectButton: document.getElementById("roomContextSelectButton"),
        roomContextRenameButton: document.getElementById("roomContextRenameButton"),
        roomContextCopyButton: document.getElementById("roomContextCopyButton"),
        roomContextDeleteButton: document.getElementById("roomContextDeleteButton"),
        confirmDialog: document.getElementById("confirmDialog"),
        confirmDialogForm: document.getElementById("confirmDialogForm"),
        confirmDialogTitle: document.getElementById("confirmDialogTitle"),
        confirmDialogMessage: document.getElementById("confirmDialogMessage"),
        acceptConfirmDialogButton: document.getElementById("acceptConfirmDialogButton"),
        rejectConfirmDialogButton: document.getElementById("rejectConfirmDialogButton"),
        cancelConfirmDialogButton: document.getElementById("cancelConfirmDialogButton"),
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
        imagePreviewDialog: document.getElementById("imagePreviewDialog"),
        imagePreviewForm: document.getElementById("imagePreviewForm"),
        imagePreviewTitle: document.getElementById("imagePreviewTitle"),
        imagePreviewStage: document.getElementById("imagePreviewStage"),
        imageCaptionInput: document.getElementById("imageCaptionInput"),
        imagePreviewThumbs: document.getElementById("imagePreviewThumbs"),
        closeImagePreviewButton: document.getElementById("closeImagePreviewButton"),
        cancelImagePreviewButton: document.getElementById("cancelImagePreviewButton"),
        sendImagePreviewButton: document.getElementById("sendImagePreviewButton"),
        photoViewerDialog: document.getElementById("photoViewerDialog"),
        photoViewerImage: document.getElementById("photoViewerImage"),
        closePhotoViewerButton: document.getElementById("closePhotoViewerButton"),
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

    function parseDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(String(value).replace(" ", "T"));

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }

    function formatDate(value) {
        const date = parseDate(value);

        if (!date) {
            return "-";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function formatMessageDate(value) {
        const date = parseDate(value);

        if (!date) {
            return "";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            weekday: "long",
            month: "long",
            day: "numeric"
        }).format(date);
    }

    function formatMessageDateKey(value) {
        const date = parseDate(value);

        if (!date) {
            return "";
        }

        return new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(date);
    }

    function formatMessageTime(value) {
        const date = parseDate(value);

        if (!date) {
            return "";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            hour: "2-digit",
            minute: "2-digit"
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

    function animateHide(element, className, callback) {
        if (!element || element.hidden) {
            if (callback) {
                callback();
            }
            return;
        }

        element.classList.add(className);
        const token = `${Date.now()}-${Math.random()}`;
        element.dataset.motionToken = token;
        let settled = false;
        const finish = () => {
            if (element.dataset.motionToken !== token) {
                return;
            }
            if (settled) {
                return;
            }
            settled = true;
            element.removeEventListener("animationend", handleAnimationEnd);
            delete element.dataset.motionToken;
            element.classList.remove(className);
            element.hidden = true;
            if (callback) {
                callback();
            }
        };

        const handleAnimationEnd = (event) => {
            if (event.target === element) {
                finish();
            }
        };

        element.addEventListener("animationend", handleAnimationEnd);
        window.setTimeout(finish, 360);
    }

    function closeDialogAnimated(dialog, afterClose = null) {
        if (!dialog.open) {
            if (afterClose) {
                afterClose();
            }
            return;
        }

        dialog.classList.add("is-closing");
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            dialog.removeEventListener("animationend", handleAnimationEnd);
            dialog.classList.remove("is-closing");
            if (dialog.open) {
                dialog.close();
            }
            if (afterClose) {
                afterClose();
            }
        };

        const handleAnimationEnd = (event) => {
            if (event.target.closest(".modal-card, .menu-card, .image-preview-card, .photo-viewer")) {
                finish();
            }
        };

        dialog.addEventListener("animationend", handleAnimationEnd);
        window.setTimeout(finish, 260);
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
        const existingRoom = rooms.find((item) => item.roomCode === room.code);

        if (existingRoom) {
            setRecentRooms(rooms.map((item) => (
                item.roomCode === room.code
                    ? { ...item, roomName: room.name || item.roomName || "" }
                    : item
            )));
            return;
        }

        const next = [
            {
                roomCode: room.code,
                roomName: room.name || "",
                visitedAt: new Date().toISOString()
            },
            ...rooms
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

    function findRememberedRoom(roomCode) {
        return getRecentRooms().find((room) => room.roomCode === roomCode) || null;
    }

    function removeRememberedRoom(roomCode) {
        if (!state.user || !roomCode) {
            return;
        }

        setRecentRooms(getRecentRooms().filter((room) => room.roomCode !== roomCode));
    }

    function askConfirm({ title = "تایید", message = "", acceptText = "تایید" } = {}) {
        return new Promise((resolve) => {
            let settled = false;

            const settle = (value) => {
                if (settled) {
                    return;
                }

                settled = true;
                dom.confirmDialogForm.removeEventListener("submit", handleSubmit);
                dom.rejectConfirmDialogButton.removeEventListener("click", handleReject);
                dom.cancelConfirmDialogButton.removeEventListener("click", handleReject);
                dom.confirmDialog.removeEventListener("cancel", handleCancel);
                dom.confirmDialog.removeEventListener("close", handleClose);

                closeDialogAnimated(dom.confirmDialog, () => resolve(value));
            };

            const handleSubmit = (event) => {
                event.preventDefault();
                settle(true);
            };
            const handleReject = () => settle(false);
            const handleCancel = (event) => {
                event.preventDefault();
                settle(false);
            };
            const handleClose = () => settle(false);

            dom.confirmDialogTitle.textContent = title;
            dom.confirmDialogMessage.textContent = message;
            dom.acceptConfirmDialogButton.textContent = acceptText;

            dom.confirmDialogForm.addEventListener("submit", handleSubmit);
            dom.rejectConfirmDialogButton.addEventListener("click", handleReject);
            dom.cancelConfirmDialogButton.addEventListener("click", handleReject);
            dom.confirmDialog.addEventListener("cancel", handleCancel);
            dom.confirmDialog.addEventListener("close", handleClose);
            dom.confirmDialog.showModal();
        });
    }

    function enterRoomSelectionMode(roomCode) {
        if (!roomCode) {
            return;
        }

        state.selectingRooms = true;
        state.selectedRoomCodes.add(roomCode);
        closeRoomContextMenu();
        renderRecentRooms();
    }

    function exitRoomSelectionMode() {
        state.selectingRooms = false;
        state.selectedRoomCodes.clear();
        renderRecentRooms();
    }

    function toggleRoomSelection(roomCode) {
        if (!roomCode) {
            return;
        }

        if (state.selectedRoomCodes.has(roomCode)) {
            state.selectedRoomCodes.delete(roomCode);
        } else {
            state.selectedRoomCodes.add(roomCode);
        }

        state.selectingRooms = state.selectedRoomCodes.size > 0;
        renderRecentRooms();
    }

    async function deleteSelectedRooms() {
        if (!state.user || state.selectedRoomCodes.size === 0) {
            return;
        }

        const selectedCodes = new Set(state.selectedRoomCodes);

        const confirmed = await askConfirm({
            title: "حذف چت‌ها",
            message: "چت‌های انتخاب‌شده فقط از لیست شما حذف می‌شوند.",
            acceptText: "حذف"
        });

        if (!confirmed) {
            return;
        }

        setRecentRooms(getRecentRooms().filter((room) => !selectedCodes.has(room.roomCode)));

        if (state.room && selectedCodes.has(state.room.code)) {
            leaveRoom();
        }

        state.selectedRoomCodes.clear();
        state.selectingRooms = false;
        renderRecentRooms();
        setStatus(dom.chatStatus, "", false);
    }

    function enterMessageSelectionMode(messageId) {
        const numericId = Number(messageId || 0);

        if (!numericId || !state.messages.has(numericId)) {
            return;
        }

        state.selectingMessages = true;
        state.selectedMessageIds.add(numericId);
        closeMessageMenu();
        closeAttachmentMenu();
        renderMessages({ scroll: "none" });
        renderMessageSelectionState();
    }

    function exitMessageSelectionMode() {
        state.selectingMessages = false;
        state.selectedMessageIds.clear();
        renderMessages({ scroll: "none" });
        renderMessageSelectionState();
    }

    function toggleMessageSelection(messageId) {
        const numericId = Number(messageId || 0);

        if (!numericId || !state.messages.has(numericId)) {
            return;
        }

        if (state.selectedMessageIds.has(numericId)) {
            state.selectedMessageIds.delete(numericId);
        } else {
            state.selectedMessageIds.add(numericId);
        }

        state.selectingMessages = state.selectedMessageIds.size > 0;
        renderMessages({ scroll: "none" });
        renderMessageSelectionState();
    }

    function selectedMessages() {
        return Array.from(state.selectedMessageIds)
            .map((messageId) => state.messages.get(messageId))
            .filter((message) => message && !message.isDeleted)
            .sort((left, right) => left.id - right.id);
    }

    function selectedMessagesText() {
        return selectedMessages()
            .map((message) => message.bodyText || ((message.attachments || []).length > 0 ? "فایل" : ""))
            .filter(Boolean)
            .join("\n");
    }

    function renderMessageSelectionState() {
        const messages = selectedMessages();
        const count = messages.length;
        state.selectingMessages = count > 0;

        dom.messageSelectionBar.hidden = !state.selectingMessages;
        dom.composerForm.classList.toggle("is-selection-active", state.selectingMessages);
        dom.messageSelectionCount.textContent = `${new Intl.NumberFormat("fa-IR").format(count)} انتخاب`;
        dom.copySelectedMessagesButton.disabled = count === 0 || selectedMessagesText() === "";
        dom.forwardSelectedMessagesButton.disabled = count === 0 || selectedMessagesText() === "";
        dom.deleteSelectedMessagesButton.disabled = count === 0 || messages.every((message) => !message.isOwn);
    }

    async function copySelectedMessages() {
        const text = selectedMessagesText();

        if (!text) {
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setStatus(dom.chatStatus, "پیام‌های انتخاب‌شده کپی شد.", false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی انجام نشد.", true);
        }
    }

    function forwardSelectedMessages() {
        const text = selectedMessagesText();

        if (!text) {
            return;
        }

        dom.messageInput.value = text;
        exitMessageSelectionMode();
        renderComposerState();
        dom.messageInput.focus();
    }

    async function deleteSelectedMessages() {
        const messages = selectedMessages().filter((message) => message.isOwn);

        if (messages.length === 0) {
            return;
        }

        const confirmed = await askConfirm({
            title: "حذف پیام‌ها",
            message: "پیام‌های انتخاب‌شده حذف می‌شوند.",
            acceptText: "حذف"
        });

        if (!confirmed) {
            return;
        }

        for (const message of messages) {
            await deleteMessage(message.id, { render: false });
        }

        exitMessageSelectionMode();
        renderRoomMeta();
        renderPresence();
        renderMessages({ scroll: "preserve" });
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

    function replaceSelectedFiles(files) {
        state.selectedFiles.forEach((entry) => {
            if (entry.previewUrl) {
                URL.revokeObjectURL(entry.previewUrl);
            }
        });

        state.selectedFiles = Array.from(files || []).map(toSelectedFileEntry);
        renderSelectedFiles();
    }

    function syncFileInput(files) {
        if (!files || files.length === 0) {
            dom.fileInput.value = "";
            return;
        }

        if (typeof DataTransfer !== "function") {
            return;
        }

        const transfer = new DataTransfer();
        Array.from(files).forEach((file) => transfer.items.add(file));
        dom.fileInput.files = transfer.files;
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
        dom.selectedFilesList.hidden = true;
        dom.selectedFilesList.innerHTML = "";
    }

    function isPreviewableMedia(entry) {
        return entry.previewKind === "image" || entry.previewKind === "video";
    }

    function renderPreviewMedia(entry) {
        if (entry.previewKind === "video") {
            return `<video controls preload="metadata" src="${escapeHtml(entry.previewUrl || "")}" aria-label="${escapeHtml(entry.file.name)}"></video>`;
        }

        return `<img src="${escapeHtml(entry.previewUrl || "")}" alt="${escapeHtml(entry.file.name)}">`;
    }

    function renderPreviewThumb(entry) {
        if (entry.previewKind === "video") {
            return `<video muted preload="metadata" src="${escapeHtml(entry.previewUrl || "")}" aria-hidden="true"></video>`;
        }

        return `<img src="${escapeHtml(entry.previewUrl || "")}" alt="">`;
    }

    function renderPreviewFileEntry(entry) {
        return `
            <div class="preview-file">
                <span class="preview-file__icon" aria-hidden="true"></span>
                <span class="preview-file__meta">
                    <strong>${escapeHtml(entry.file.name)}</strong>
                    <small>${escapeHtml(formatSize(entry.file.size))}</small>
                </span>
            </div>
        `;
    }

    function renderImagePreviewDialog() {
        if (state.selectedFiles.length === 0) {
            dom.imagePreviewStage.innerHTML = "";
            dom.imagePreviewThumbs.innerHTML = "";
            dom.imagePreviewThumbs.hidden = true;
            return;
        }

        const [activeEntry] = state.selectedFiles;
        const allPreviewable = state.selectedFiles.every((entry) => isPreviewableMedia(entry));
        dom.imagePreviewTitle.textContent = allPreviewable ? "ارسال رسانه" : "ارسال فایل";
        dom.imagePreviewStage.classList.toggle("image-preview-stage--files", !allPreviewable);
        dom.imagePreviewStage.innerHTML = allPreviewable
            ? `
                <div class="image-preview-frame">
                    ${renderPreviewMedia(activeEntry)}
                </div>
            `
            : `
                <div class="preview-files">
                    ${state.selectedFiles.map(renderPreviewFileEntry).join("")}
                </div>
            `;

        dom.imagePreviewThumbs.hidden = !allPreviewable || state.selectedFiles.length < 2;
        dom.imagePreviewThumbs.innerHTML = state.selectedFiles.map((entry, index) => `
            <button type="button" class="image-preview-thumb${index === 0 ? " is-active" : ""}" data-action="select-preview-file" data-file-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(entry.file.name)}">
                ${renderPreviewThumb(entry)}
            </button>
        `).join("");
    }

    function openImagePreviewDialog() {
        if (state.selectedFiles.length === 0) {
            return;
        }

        dom.imageCaptionInput.value = dom.messageInput.value.trim();
        renderImagePreviewDialog();
        dom.imagePreviewDialog.showModal();
        dom.imageCaptionInput.focus();
    }

    function hasDraggedFiles(event) {
        const types = event.dataTransfer?.types;

        if (!types) {
            return false;
        }

        return Array.from(types).includes("Files");
    }

    function setChatDropOverlayVisible(isVisible) {
        dom.chatDropOverlay.hidden = !isVisible;
        dom.chatPanel.classList.toggle("is-drop-target", isVisible);
    }

    function resetChatDropOverlay() {
        state.dragDepth = 0;
        setChatDropOverlayVisible(false);
    }

    function handleIncomingFiles(files) {
        replaceSelectedFiles(files);
        syncFileInput(files);

        if (state.selectedFiles.length > 0) {
            openImagePreviewDialog();
        }

        renderComposerState();
    }

    function closeImagePreviewDialog(clearFiles = false) {
        if (clearFiles) {
            clearSelectedFiles();
        }

        if (dom.imagePreviewDialog.open) {
            closeDialogAnimated(dom.imagePreviewDialog);
        }
    }

    function removePreviewFile(fileId) {
        const target = state.selectedFiles.find((entry) => entry.id === fileId);

        if (target?.previewUrl) {
            URL.revokeObjectURL(target.previewUrl);
        }

        state.selectedFiles = state.selectedFiles.filter((entry) => entry.id !== fileId);

        if (state.selectedFiles.length === 0) {
            closeImagePreviewDialog(true);
            renderComposerState();
            return;
        }

        renderImagePreviewDialog();
        renderComposerState();
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
            renderRoomSelectionState();
            return;
        }

        const rooms = getRecentRooms();
        const roomCodes = new Set(rooms.map((room) => room.roomCode));
        state.selectedRoomCodes.forEach((roomCode) => {
            if (!roomCodes.has(roomCode)) {
                state.selectedRoomCodes.delete(roomCode);
            }
        });

        if (rooms.length === 0) {
            dom.recentRoomsList.innerHTML = '<div class="recent-room recent-room--empty"><div class="recent-room__meta">اتاقی نیست.</div></div>';
            state.selectedRoomCodes.clear();
            state.selectingRooms = false;
            renderRoomSelectionState();
            return;
        }

        dom.recentRoomsList.innerHTML = rooms.map((room) => {
            const isActive = state.room?.code === room.roomCode;
            const isSelected = state.selectedRoomCodes.has(room.roomCode);
            const title = room.roomName || `اتاق ${room.roomCode}`;
            const colorIndex = Number(room.roomCode || 0) % 4;
            return `
                <button type="button" class="recent-room recent-room--tone-${colorIndex}${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}" data-room-code="${escapeHtml(room.roomCode)}" aria-pressed="${isSelected ? "true" : "false"}">
                    <span class="recent-room__avatar" aria-hidden="true"></span>
                    <span class="recent-room__content">
                        <span class="recent-room__title">${escapeHtml(title)}</span>
                        <span class="recent-room__meta">${escapeHtml(room.roomCode)}</span>
                    </span>
                </button>
            `;
        }).join("");

        renderRoomSelectionState();
    }

    function renderRoomSelectionState() {
        const count = state.selectedRoomCodes.size;
        state.selectingRooms = count > 0;
        dom.quickRoomForm.hidden = state.selectingRooms;
        if (state.selectingRooms) {
            closeContactSearch();
        }
        dom.roomSelectionBar.hidden = !state.selectingRooms;
        dom.roomSelectionCount.textContent = `${new Intl.NumberFormat("fa-IR").format(count)} انتخاب`;
        dom.deleteSelectedRoomsButton.disabled = count === 0;
    }

    function renderRoomMeta() {
        if (!state.room) {
            dom.roomTitle.textContent = "اتاق";
            dom.roomSubtitle.textContent = "-";
            dom.openRoomNameButton.hidden = true;
            return;
        }

        dom.roomTitle.textContent = formatRoomTitle(state.room);
        dom.roomSubtitle.textContent = state.room.code;
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

        if (!state.room || state.editingMessageId || state.busy) {
            resetChatDropOverlay();
        }
    }

    function renderQuickRoomState() {
        const roomCode = dom.quickRoomCodeInput.value.trim();
        const canJoin = /^\d{4}$/.test(roomCode);
        dom.quickJoinRoomButton.classList.toggle("is-disabled", !canJoin);
        dom.quickJoinRoomButton.setAttribute("aria-disabled", canJoin ? "false" : "true");
    }

    function nudgeQuickRoomCodeInput() {
        dom.quickRoomCodeInput.classList.remove("is-nudged");
        void dom.quickRoomCodeInput.offsetWidth;
        dom.quickRoomCodeInput.classList.add("is-nudged");
    }

    function renderContactSearchResults(contacts, message = "") {
        if (message) {
            dom.contactSearchResults.innerHTML = `<div class="contact-search-empty">${escapeHtml(message)}</div>`;
            return;
        }

        if (!contacts || contacts.length === 0) {
            dom.contactSearchResults.innerHTML = "";
            return;
        }

        dom.contactSearchResults.innerHTML = contacts.map((contact, index) => `
            <button type="button" class="contact-search-result" data-contact-id="${escapeHtml(contact.id)}" style="--stagger-index: ${index}">
                <span class="contact-search-result__avatar" aria-hidden="true"></span>
                <span>
                    <strong>${escapeHtml(contact.displayName)}</strong>
                    <small>${escapeHtml(contact.mobileDisplay)}</small>
                </span>
            </button>
        `).join("");
    }

    async function searchContacts() {
        const query = dom.contactSearchInput.value.trim();

        if (query.length < 2) {
            renderContactSearchResults([], query ? "حداقل ۲ کاراکتر وارد کنید." : "");
            return;
        }

        renderContactSearchResults([], "در حال جستجو...");

        try {
            const params = new URLSearchParams({ q: query });
            const data = await fetchJson(`${apiPath("/api/contacts/search")}?${params.toString()}`, {
                method: "GET"
            });
            renderContactSearchResults(data.contacts || [], (data.contacts || []).length === 0 ? "مخاطبی پیدا نشد." : "");
        } catch (error) {
            renderContactSearchResults([], error.message);
        }
    }

    function closeContactSearch() {
        dom.toggleContactSearchButton.classList.remove("is-active");
        dom.quickRoomForm.classList.remove("is-searching");
        window.clearTimeout(state.contactSearchTimer);
        animateHide(dom.contactSearchPanel, "is-closing", () => {
            dom.contactSearchInput.value = "";
            renderContactSearchResults([]);
            renderQuickRoomState();
        });
    }

    function toggleContactSearch() {
        const opening = dom.contactSearchPanel.hidden;

        if (opening) {
            delete dom.contactSearchPanel.dataset.motionToken;
            dom.contactSearchPanel.classList.remove("is-closing");
            dom.contactSearchPanel.hidden = false;
            dom.toggleContactSearchButton.classList.add("is-active");
            dom.quickRoomForm.classList.add("is-searching");
            dom.contactSearchInput.focus();
            searchContacts().catch(() => {});
        } else {
            closeContactSearch();
        }
    }

    function handleContactSearchOutsideClick(event) {
        if (dom.contactSearchPanel.hidden) {
            return;
        }

        const target = event.target;
        const clickedSearchArea = dom.contactSearchInput.contains(target)
            || dom.toggleContactSearchButton.contains(target)
            || dom.contactSearchPanel.contains(target);

        if (!clickedSearchArea) {
            closeContactSearch();
        }
    }

    function scrollMessagesToBottom() {
        const scrollToEnd = () => {
            dom.messagesList.scrollTop = Math.max(0, dom.messagesList.scrollHeight - dom.messagesList.clientHeight);
        };

        scrollToEnd();
        window.requestAnimationFrame(() => {
            scrollToEnd();
            window.requestAnimationFrame(scrollToEnd);
        });
        window.setTimeout(scrollToEnd, 120);
        window.setTimeout(scrollToEnd, 360);
    }

    function renderMessages(options = {}) {
        const scrollMode = options.scroll || "preserve";
        const previousScrollHeight = dom.messagesList.scrollHeight;
        const previousScrollTop = dom.messagesList.scrollTop;
        const wasNearBottom = previousScrollHeight - previousScrollTop - dom.messagesList.clientHeight < 120;
        const messages = Array.from(state.messages.values())
            .filter((message) => !message.isDeleted)
            .sort((left, right) => left.id - right.id);

        state.selectedMessageIds.forEach((messageId) => {
            const message = state.messages.get(messageId);

            if (!message || message.isDeleted) {
                state.selectedMessageIds.delete(messageId);
            }
        });

        if (messages.length === 0) {
            dom.messagesList.innerHTML = '<div class="message message--empty"><div class="message__body">اولین پیام را بنویسید.</div></div>';
            dom.messagesList.scrollTop = 0;
            renderMessageSelectionState();
            return;
        }

        let lastDateKey = "";
        let previousSenderKey = "";
        const participantCount = Number(state.presence?.totalCount || state.presence?.participants?.length || 0);
        const showSenderNames = participantCount > 2;

        dom.messagesList.innerHTML = messages.map((message) => {
            const messageDate = message.createdAt || message.updatedAt;
            const dateKey = formatMessageDateKey(messageDate);
            const hasDateSeparator = Boolean(dateKey && dateKey !== lastDateKey);
            const dateSeparator = dateKey && dateKey !== lastDateKey
                ? `<div class="message-date-separator"><span>${escapeHtml(formatMessageDate(messageDate))}</span></div>`
                : "";

            if (dateKey) {
                lastDateKey = dateKey;
            }

            const senderKey = message.senderMobile || message.senderName || String(message.id);
            const shouldShowSenderName = showSenderNames && (hasDateSeparator || senderKey !== previousSenderKey);
            previousSenderKey = senderKey;

            const messageAttachments = message.attachments || [];
            const isPhotoMessage = messageAttachments.length > 0 && messageAttachments.every((attachment) => attachment.previewKind === "image");
            const isFileMessage = messageAttachments.length > 0 && messageAttachments.every((attachment) => attachment.previewKind === "download");
            const attachments = renderAttachments(messageAttachments);
            const isEntering = !state.renderedMessageIds.has(message.id);
            const isSelected = state.selectedMessageIds.has(message.id);
            const replyMarkup = message.replyTo && !message.replyTo.isDeleted ? `
                <div class="message__reply">
                    <div class="message__reply-meta">${escapeHtml(message.replyTo.senderName)}</div>
                    <div>${escapeHtml(message.replyTo.bodyText || "فایل")}</div>
                </div>
            ` : "";
            const bodyText = message.bodyText ? `<div class="message__body">${escapeHtml(message.bodyText)}</div>` : "";
            const messageContent = isFileMessage ? `${attachments}${bodyText}` : `${bodyText}${attachments}`;
            return `
                ${dateSeparator}
                <article class="message${message.isOwn ? " is-own" : ""}${isPhotoMessage ? " message--photo" : ""}${isFileMessage ? " message--file" : ""}${isSelected ? " is-selected" : ""}${isEntering ? " is-entering" : ""}" data-message-id="${message.id}" tabindex="0" aria-selected="${isSelected ? "true" : "false"}">
                    <span class="message__select-indicator" aria-hidden="true"></span>
                    ${shouldShowSenderName ? `
                        <div class="message__head">
                            <div class="message__author">
                                <strong>${escapeHtml(message.senderName)}</strong>
                            </div>
                        </div>
                    ` : ""}
                    ${replyMarkup}
                    ${messageContent}
                    <div class="message__meta">
                        <span class="message__time">${escapeHtml(formatMessageTime(messageDate))}</span>
                        ${message.isEdited ? '<span class="message__edited-icon" title="ویرایش‌شده" aria-label="ویرایش‌شده"></span>' : ""}
                    </div>
                </article>
            `;
        }).join("");

        messages.forEach((message) => state.renderedMessageIds.add(message.id));
        renderMessageSelectionState();

        if (scrollMode === "bottom" || (scrollMode === "auto" && wasNearBottom)) {
            scrollMessagesToBottom();
            dom.messagesList.querySelectorAll("img, video").forEach((media) => {
                if (media.complete || media.readyState >= 1) {
                    return;
                }

                media.addEventListener("load", scrollMessagesToBottom, { once: true });
                media.addEventListener("loadedmetadata", scrollMessagesToBottom, { once: true });
            });
            return;
        }

        if (scrollMode === "none") {
            dom.messagesList.scrollTop = previousScrollTop;
            return;
        }

        const heightDelta = dom.messagesList.scrollHeight - previousScrollHeight;
        dom.messagesList.scrollTop = Math.max(0, previousScrollTop + heightDelta);
    }

    function renderAttachments(attachments) {
        if (!attachments || attachments.length === 0) {
            return "";
        }

        if (attachments.every((attachment) => attachment.previewKind === "image")) {
            return `
                <div class="message__attachments message__attachments--photo">
                    ${attachments.map((attachment) => renderAttachmentPreview(attachment)).join("")}
                </div>
            `;
        }

        if (attachments.every((attachment) => attachment.previewKind === "download")) {
            return `
                <div class="message__attachments message__attachments--files">
                    ${attachments.map((attachment) => renderAttachmentPreview(attachment)).join("")}
                </div>
            `;
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
            return `<a class="attachment-photo" href="${escapeHtml(attachment.url)}" data-attachment-id="${escapeHtml(attachment.id)}" data-photo-url="${escapeHtml(attachment.url)}" data-photo-name="${escapeHtml(attachment.name)}"><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name)}"></a>`;
        }

        if (attachment.previewKind === "video") {
            return `<video controls preload="metadata" src="${escapeHtml(attachment.url)}" data-attachment-id="${escapeHtml(attachment.id)}"></video>`;
        }

        if (attachment.previewKind === "audio") {
            return `<audio controls preload="metadata" src="${escapeHtml(attachment.url)}" data-attachment-id="${escapeHtml(attachment.id)}"></audio>`;
        }

        return `
            <a class="attachment-file" href="${escapeHtml(attachment.url)}" target="_blank" rel="noreferrer" data-attachment-id="${escapeHtml(attachment.id)}">
                <span class="attachment-file__icon" aria-hidden="true"></span>
                <span class="attachment-file__meta">
                    <strong>${escapeHtml(attachment.name)}</strong>
                    <small>${escapeHtml(formatSize(attachment.sizeBytes))}</small>
                </span>
            </a>
        `;
    }

    function openPhotoViewer(url, name = "") {
        dom.photoViewerImage.src = url;
        dom.photoViewerImage.alt = name;
        dom.photoViewerDialog.showModal();
    }

    function closePhotoViewer() {
        closeDialogAnimated(dom.photoViewerDialog, () => {
            dom.photoViewerImage.removeAttribute("src");
            dom.photoViewerImage.alt = "";
        });
    }

    function messageFingerprint(message) {
        return JSON.stringify({
            id: message.id,
            bodyText: message.bodyText || "",
            updatedAt: message.updatedAt || "",
            deletedAt: message.deletedAt || "",
            isDeleted: Boolean(message.isDeleted),
            isEdited: Boolean(message.isEdited),
            attachments: (message.attachments || []).map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                url: attachment.url,
                sizeBytes: attachment.sizeBytes,
                previewKind: attachment.previewKind
            })),
            replyTo: message.replyTo ? {
                id: message.replyTo.id,
                bodyText: message.replyTo.bodyText || "",
                isDeleted: Boolean(message.replyTo.isDeleted)
            } : null
        });
    }

    function upsertMessages(messages) {
        let changed = false;

        (messages || []).forEach((message) => {
            const previous = state.messages.get(message.id);

            if (!previous || messageFingerprint(previous) !== messageFingerprint(message)) {
                state.messages.set(message.id, message);
                changed = true;
            }
        });

        return changed;
    }

    function applyBootstrapData(data) {
        state.room = data.room || null;
        state.participant = data.participant || null;
        state.presence = data.presence || { onlineCount: 0, participants: [] };
        state.syncCursor = data.syncCursor || null;
        state.messages.clear();
        state.renderedMessageIds.clear();

        upsertMessages(data.messages || []);

        if (state.room) {
            rememberRoom(state.room);
            setActiveRoomCode(state.room.code);
        }

        renderShell();
        renderMessages({ scroll: "bottom" });
    }

    function applySyncData(data) {
        state.room = data.room || state.room;
        state.presence = data.presence || state.presence;
        state.syncCursor = data.syncCursor || state.syncCursor;
        const messagesChanged = upsertMessages(data.messages || []);

        if (state.room) {
            rememberRoom(state.room);
            updateRememberedRoomName(state.room);
        }

        renderRoomMeta();
        renderPresence();

        if (messagesChanged) {
            renderMessages({ scroll: "auto" });
        }
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
        state.contextAttachmentId = null;
        state.contextRoomCode = null;
        state.selectingRooms = false;
        state.selectedRoomCodes.clear();
        state.selectingMessages = false;
        state.selectedMessageIds.clear();
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
        state.selectingMessages = false;
        state.selectedMessageIds.clear();
        dom.messageInput.value = "";
        clearSelectedFiles();
        clearActiveRoomCode();
        renderShell();
        renderMessages({ scroll: "bottom" });
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
            closeDialogAnimated(dom.profileDialog);
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
            closeDialogAnimated(dom.passwordDialog);
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
            renderRecentRooms();
            closeDialogAnimated(dom.roomNameDialog);
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
                renderMessages({ scroll: "preserve" });
            } else {
                const formData = new FormData();
                formData.append("roomCode", state.room.code);
                formData.append(
                    "text",
                    dom.imagePreviewDialog.open ? dom.imageCaptionInput.value.trim() : dom.messageInput.value.trim()
                );

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
                dom.imageCaptionInput.value = "";
                if (dom.imagePreviewDialog.open) {
                    closeDialogAnimated(dom.imagePreviewDialog);
                }
                clearSelectedFiles();
                exitReplyMode();
                renderRoomMeta();
                renderPresence();
                renderMessages({ scroll: "bottom" });
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

    async function deleteMessage(messageId, options = {}) {
        setStatus(dom.chatStatus, "", false);

        try {
            const data = await fetchJson(apiPath(`/api/messages/${messageId}`), {
                method: "DELETE",
                body: JSON.stringify({})
            });
            state.messages.set(data.message.id, data.message);
            state.room = data.room || state.room;
            state.presence = data.presence || state.presence;
            state.selectedMessageIds.delete(messageId);

            if (options.render !== false) {
                renderRoomMeta();
                renderPresence();
                renderMessages({ scroll: "preserve" });
            }
        } catch (error) {
            setStatus(dom.chatStatus, error.message, true);
        }
    }

    function openContextAttachment() {
        const attachment = getContextAttachment();

        if (!attachment) {
            closeAttachmentMenu();
            return;
        }

        closeAttachmentMenu();

        if (attachment.previewKind === "image") {
            openPhotoViewer(attachment.url, attachment.name);
            return;
        }

        window.open(attachment.url, "_blank", "noopener,noreferrer");
    }

    function downloadContextAttachment() {
        const attachment = getContextAttachment();

        if (!attachment) {
            closeAttachmentMenu();
            return;
        }

        closeAttachmentMenu();
        window.open(attachment.url, "_blank", "noopener,noreferrer");
    }

    async function copyContextAttachmentLink() {
        const attachment = getContextAttachment();

        if (!attachment) {
            closeAttachmentMenu();
            return;
        }

        try {
            await navigator.clipboard.writeText(new URL(attachment.url, window.location.href).href);
            setStatus(dom.chatStatus, "لینک فایل کپی شد.", false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی خودکار انجام نشد.", true);
        } finally {
            closeAttachmentMenu();
        }
    }

    function replyToContextAttachment() {
        const message = getContextMessage();
        closeAttachmentMenu();

        if (message) {
            enterReplyMode(message.id);
        }
    }

    function selectContextAttachmentMessage() {
        const message = getContextMessage();
        closeAttachmentMenu();

        if (message) {
            enterMessageSelectionMode(message.id);
        }
    }

    function deleteContextAttachmentMessage() {
        const message = getContextMessage();
        closeAttachmentMenu();

        if (message?.isOwn) {
            deleteMessage(message.id);
        }
    }

    function getContextMessage() {
        return state.contextMessageId ? state.messages.get(state.contextMessageId) : null;
    }

    function getContextAttachment() {
        const message = getContextMessage();

        if (!message || !state.contextAttachmentId) {
            return null;
        }

        return (message.attachments || []).find((attachment) => attachment.id === state.contextAttachmentId) || null;
    }

    function positionFloatingMenu(dialog, anchor, boundaryElement) {
        const padding = 8;

        dialog.style.left = "";
        dialog.style.top = "";

        const rect = dialog.getBoundingClientRect();
        const width = rect.width || 260;
        const height = rect.height || 260;
        const bounds = boundaryElement.getBoundingClientRect();
        const minLeft = bounds.left + padding;
        const maxLeft = bounds.right - width - padding;
        const minTop = bounds.top + padding;
        const maxTop = bounds.bottom - height - padding;
        let rawLeft = typeof anchor?.x === "number" ? anchor.x : bounds.left + ((bounds.width - width) / 2);
        const rawTop = typeof anchor?.y === "number" ? anchor.y : bounds.top + padding;

        if (anchor?.messageRect) {
            rawLeft = anchor.preferredSide === "left"
                ? anchor.messageRect.left - width - 6
                : anchor.messageRect.right + 6;
        }

        const left = Math.min(Math.max(rawLeft, minLeft), Math.max(minLeft, maxLeft));
        const top = Math.min(Math.max(rawTop, minTop), Math.max(minTop, maxTop));

        dialog.style.left = `${left}px`;
        dialog.style.top = `${top}px`;
    }

    function positionMessageMenu(anchor) {
        positionFloatingMenu(dom.messageMenuDialog, anchor, dom.messagesList);
    }

    function positionAttachmentMenu(anchor) {
        positionFloatingMenu(dom.attachmentMenuDialog, anchor, dom.messagesList);
    }

    function messageAnchorFromElement(element) {
        const rect = element.getBoundingClientRect();
        const isOwn = element.classList.contains("is-own");

        return {
            x: rect.left + (rect.width / 2),
            y: rect.top + Math.min(rect.height, 48),
            messageRect: rect,
            preferredSide: isOwn ? "left" : "right"
        };
    }

    function openMessageMenu(messageId, anchor = null) {
        const message = state.messages.get(messageId);

        if (!message || message.isDeleted) {
            return;
        }

        closeAttachmentMenu();
        closeRoomContextMenu();
        state.contextMessageId = messageId;
        state.contextAttachmentId = null;
        dom.messageSelectButton.hidden = false;
        dom.messageEditButton.hidden = !message.isOwn;
        dom.messageDeleteButton.hidden = !message.isOwn;

        if (!dom.messageMenuDialog.open) {
            dom.messageMenuDialog.show();
        }

        positionMessageMenu(anchor);
    }

    function closeMessageMenu() {
        if (dom.messageMenuDialog.open) {
            closeDialogAnimated(dom.messageMenuDialog);
        }
    }

    function selectContextMessage() {
        const message = getContextMessage();
        closeMessageMenu();

        if (message) {
            enterMessageSelectionMode(message.id);
        }
    }

    function openAttachmentMenu(messageId, attachmentId, anchor = null) {
        const message = state.messages.get(messageId);
        const attachment = (message?.attachments || []).find((item) => item.id === attachmentId);

        if (!message || !attachment || message.isDeleted) {
            return;
        }

        closeMessageMenu();
        closeRoomContextMenu();
        state.contextMessageId = messageId;
        state.contextAttachmentId = attachmentId;
        dom.attachmentOpenButton.querySelector("span:last-child").textContent = attachment.previewKind === "download" ? "باز کردن" : "نمایش";
        dom.attachmentDeleteButton.hidden = !message.isOwn;

        if (!dom.attachmentMenuDialog.open) {
            dom.attachmentMenuDialog.show();
        }

        positionAttachmentMenu(anchor);
    }

    function closeAttachmentMenu() {
        if (dom.attachmentMenuDialog.open) {
            closeDialogAnimated(dom.attachmentMenuDialog);
        }
    }

    function getContextRoom() {
        return state.contextRoomCode ? findRememberedRoom(state.contextRoomCode) : null;
    }

    function roomAnchorFromElement(element) {
        const rect = element.getBoundingClientRect();

        return {
            x: rect.left + 8,
            y: rect.top + 8,
            messageRect: rect,
            preferredSide: "left"
        };
    }

    function openRoomContextMenu(roomCode, anchor = null) {
        const room = findRememberedRoom(roomCode);

        if (!room) {
            return;
        }

        closeMessageMenu();
        closeAttachmentMenu();
        state.contextRoomCode = roomCode;

        if (!dom.roomContextMenuDialog.open) {
            dom.roomContextMenuDialog.show();
        }

        positionFloatingMenu(dom.roomContextMenuDialog, anchor, dom.sidebar || dom.appScreen);
    }

    function closeRoomContextMenu() {
        if (dom.roomContextMenuDialog.open) {
            closeDialogAnimated(dom.roomContextMenuDialog);
        }
    }

    function selectContextRoom() {
        const room = getContextRoom();
        closeRoomContextMenu();

        if (!room) {
            return;
        }

        enterRoomSelectionMode(room.roomCode);
    }

    async function copyContextRoomLink() {
        const room = getContextRoom();
        closeRoomContextMenu();

        if (!room) {
            return;
        }

        try {
            await navigator.clipboard.writeText(window.location.origin + roomPath(room.roomCode));
            setStatus(dom.chatStatus, "لینک اتاق کپی شد.", false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی خودکار انجام نشد.", true);
        }
    }

    async function renameContextRoom() {
        const room = getContextRoom();
        closeRoomContextMenu();

        if (!room) {
            return;
        }

        try {
            if (state.room?.code !== room.roomCode) {
                await enterRoom(room.roomCode, false);
            }

            if (!state.room?.isCreator) {
                setStatus(dom.chatStatus, "فقط سازنده اتاق می‌تواند نام را ویرایش کند.", true);
                return;
            }

            openRoomNameDialog();
        } catch (error) {
            setStatus(dom.chatStatus, error.message, true);
        }
    }

    async function deleteContextRoom() {
        const room = getContextRoom();
        closeRoomContextMenu();

        if (!room) {
            return;
        }

        const confirmed = await askConfirm({
            title: "حذف چت",
            message: "این چت فقط از لیست شما حذف می‌شود.",
            acceptText: "حذف"
        });

        if (!confirmed) {
            return;
        }

        removeRememberedRoom(room.roomCode);
        state.selectedRoomCodes.delete(room.roomCode);

        if (state.room?.code === room.roomCode) {
            leaveRoom();
        } else {
            renderRecentRooms();
            setStatus(dom.chatStatus, "", false);
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
        closeDialogAnimated(dom.registerNameDialog, () => setStatus(dom.registerNameStatus, "", false));
    }

    function openAccountMenu() {
        if (!dom.accountMenuDialog.open) {
            dom.accountMenuDialog.showModal();
        }
    }

    function closeAccountMenu() {
        if (dom.accountMenuDialog.open) {
            closeDialogAnimated(dom.accountMenuDialog);
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
            closeDialogAnimated(dom.roomMenuDialog);
        }
    }

    function closeRoomDialog() {
        closeDialogAnimated(dom.roomDialog, () => setStatus(dom.roomDialogStatus, "", false));
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
        dom.closeAttachmentMenuButton.addEventListener("click", closeAttachmentMenu);
        dom.attachmentOpenButton.addEventListener("click", openContextAttachment);
        dom.attachmentDownloadButton.addEventListener("click", downloadContextAttachment);
        dom.attachmentCopyButton.addEventListener("click", () => {
            copyContextAttachmentLink();
        });
        dom.attachmentReplyButton.addEventListener("click", replyToContextAttachment);
        dom.attachmentSelectButton.addEventListener("click", selectContextAttachmentMessage);
        dom.attachmentDeleteButton.addEventListener("click", deleteContextAttachmentMessage);
        dom.closeRoomContextMenuButton.addEventListener("click", closeRoomContextMenu);
        dom.roomContextSelectButton.addEventListener("click", selectContextRoom);
        dom.roomContextRenameButton.addEventListener("click", () => {
            renameContextRoom().catch((error) => {
                setStatus(dom.chatStatus, error.message, true);
            });
        });
        dom.roomContextCopyButton.addEventListener("click", () => {
            copyContextRoomLink().catch((error) => {
                setStatus(dom.chatStatus, error.message, true);
            });
        });
        dom.roomContextDeleteButton.addEventListener("click", () => {
            deleteContextRoom().catch((error) => {
                setStatus(dom.chatStatus, error.message, true);
            });
        });
        dom.cancelRoomSelectionButton.addEventListener("click", exitRoomSelectionMode);
        dom.cancelMessageSelectionButton.addEventListener("click", exitMessageSelectionMode);
        dom.copySelectedMessagesButton.addEventListener("click", () => {
            copySelectedMessages();
        });
        dom.forwardSelectedMessagesButton.addEventListener("click", forwardSelectedMessages);
        dom.deleteSelectedMessagesButton.addEventListener("click", () => {
            deleteSelectedMessages().catch((error) => {
                setStatus(dom.chatStatus, error.message, true);
            });
        });
        dom.deleteSelectedRoomsButton.addEventListener("click", () => {
            deleteSelectedRooms().catch((error) => {
                setStatus(dom.chatStatus, error.message, true);
            });
        });
        dom.messageReplyButton.addEventListener("click", () => {
            const message = getContextMessage();
            closeMessageMenu();

            if (message) {
                enterReplyMode(message.id);
            }
        });
        dom.messageSelectButton.addEventListener("click", selectContextMessage);
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
        dom.closeProfileDialogButton.addEventListener("click", () => closeDialogAnimated(dom.profileDialog));
        dom.closePasswordDialogButton.addEventListener("click", () => closeDialogAnimated(dom.passwordDialog));
        dom.closeRoomNameDialogButton.addEventListener("click", () => closeDialogAnimated(dom.roomNameDialog));
        dom.openRoomNameButton.addEventListener("click", () => {
            closeRoomMenu();
            openRoomNameDialog();
        });

        if (appConfig.initialRoom && dom.quickRoomCodeInput) {
            dom.quickRoomCodeInput.value = appConfig.initialRoom;
        }
        renderQuickRoomState();
        dom.quickRoomCodeInput.addEventListener("input", renderQuickRoomState);
        dom.toggleContactSearchButton.addEventListener("click", toggleContactSearch);
        document.addEventListener("pointerdown", handleContactSearchOutsideClick);
        dom.contactSearchInput.addEventListener("input", () => {
            window.clearTimeout(state.contactSearchTimer);
            state.contactSearchTimer = window.setTimeout(() => {
                searchContacts().catch(() => {});
            }, 240);
        });
        dom.contactSearchResults.addEventListener("click", async (event) => {
            const result = event.target.closest(".contact-search-result");

            if (!result) {
                return;
            }

            const mobile = result.querySelector("small")?.textContent || "";

            try {
                await navigator.clipboard.writeText(mobile);
                setStatus(dom.chatStatus, "شماره مخاطب کپی شد.", false);
            } catch (error) {
                setStatus(dom.chatStatus, "کپی خودکار انجام نشد.", true);
            }
        });

        dom.quickRoomForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            setStatus(dom.chatStatus, "", false);
            const roomCode = dom.quickRoomCodeInput.value.trim();

            if (!/^\d{4}$/.test(roomCode)) {
                setStatus(dom.chatStatus, "کد اتاق باید ۴ رقمی باشد.", true);
                nudgeQuickRoomCodeInput();
                dom.quickRoomCodeInput.focus();
                renderQuickRoomState();
                return;
            }

            try {
                await enterRoom(roomCode, false);
                dom.quickRoomCodeInput.value = "";
                renderQuickRoomState();
            } catch (error) {
                setStatus(dom.chatStatus, error.message, true);
            }
        });

        dom.quickCreateRoomButton.addEventListener("click", async () => {
            setStatus(dom.chatStatus, "", false);

            try {
                await enterRoom("", false);
                dom.quickRoomCodeInput.value = "";
            } catch (error) {
                setStatus(dom.chatStatus, error.message, true);
            }
        });

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

            if (state.roomContextOpenedByPress) {
                state.roomContextOpenedByPress = false;
                event.preventDefault();
                return;
            }

            closeRoomContextMenu();

            if (state.selectingRooms) {
                event.preventDefault();
                toggleRoomSelection(button.dataset.roomCode || "");
                return;
            }

            try {
                await enterRoom(button.dataset.roomCode || "", false);
            } catch (error) {
                setStatus(dom.chatStatus, error.message, true);
            }
        });

        dom.recentRoomsList.addEventListener("contextmenu", (event) => {
            const button = event.target.closest("[data-room-code]");

            if (!button) {
                return;
            }

            event.preventDefault();
            openRoomContextMenu(button.dataset.roomCode || "", {
                x: event.clientX,
                y: event.clientY,
                messageRect: button.getBoundingClientRect(),
                preferredSide: "left"
            });
        });

        dom.recentRoomsList.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse") {
                return;
            }

            const button = event.target.closest("[data-room-code]");

            if (!button) {
                return;
            }

            window.clearTimeout(state.roomLongPressTimer);
            state.roomLongPressTimer = window.setTimeout(() => {
                state.roomContextOpenedByPress = true;
                openRoomContextMenu(button.dataset.roomCode || "", {
                    x: event.clientX,
                    y: event.clientY,
                    messageRect: button.getBoundingClientRect(),
                    preferredSide: "left"
                });
            }, 520);
        });

        ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
            dom.recentRoomsList.addEventListener(eventName, () => {
                window.clearTimeout(state.roomLongPressTimer);
                state.roomLongPressTimer = null;
            });
        });

        dom.recentRoomsList.addEventListener("keydown", (event) => {
            if (event.key !== "ContextMenu") {
                return;
            }

            const button = event.target.closest("[data-room-code]");

            if (!button) {
                return;
            }

            event.preventDefault();
            openRoomContextMenu(button.dataset.roomCode || "", roomAnchorFromElement(button));
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
            handleIncomingFiles(dom.fileInput.files);
        });

        dom.closeImagePreviewButton.addEventListener("click", () => closeImagePreviewDialog(true));
        dom.cancelImagePreviewButton.addEventListener("click", () => closeImagePreviewDialog(true));
        dom.imagePreviewDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closeImagePreviewDialog(true);
        });
        dom.imagePreviewForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!dom.sendButton.disabled) {
                dom.composerForm.requestSubmit();
            }
        });
        dom.imagePreviewThumbs.addEventListener("click", (event) => {
            const button = event.target.closest('[data-action="select-preview-file"]');

            if (!button) {
                return;
            }

            const fileId = button.dataset.fileId || "";
            const index = state.selectedFiles.findIndex((entry) => entry.id === fileId);

            if (index <= 0) {
                return;
            }

            const [entry] = state.selectedFiles.splice(index, 1);
            state.selectedFiles.unshift(entry);
            renderImagePreviewDialog();
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
        dom.messageInput.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
                return;
            }

            event.preventDefault();

            if (!dom.sendButton.disabled) {
                dom.composerForm.requestSubmit();
            }
        });
        dom.chatPanel.addEventListener("dragenter", (event) => {
            if (!state.room || state.editingMessageId || state.busy || !hasDraggedFiles(event)) {
                return;
            }

            event.preventDefault();
            state.dragDepth += 1;
            setChatDropOverlayVisible(true);
        });
        dom.chatPanel.addEventListener("dragover", (event) => {
            if (!state.room || state.editingMessageId || state.busy || !hasDraggedFiles(event)) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";

            if (!dom.chatDropOverlay.hidden) {
                return;
            }

            setChatDropOverlayVisible(true);
        });
        dom.chatPanel.addEventListener("dragleave", (event) => {
            if (!hasDraggedFiles(event) || state.dragDepth === 0) {
                return;
            }

            state.dragDepth = Math.max(0, state.dragDepth - 1);

            if (state.dragDepth === 0) {
                setChatDropOverlayVisible(false);
            }
        });
        dom.chatPanel.addEventListener("drop", (event) => {
            if (!state.room || state.editingMessageId || state.busy || !hasDraggedFiles(event)) {
                return;
            }

            event.preventDefault();
            const files = event.dataTransfer?.files;
            resetChatDropOverlay();

            if (!files || files.length === 0) {
                return;
            }

            handleIncomingFiles(files);
        });
        window.addEventListener("dragend", resetChatDropOverlay);
        window.addEventListener("drop", (event) => {
            if (event.target instanceof Node && dom.chatPanel.contains(event.target)) {
                return;
            }

            resetChatDropOverlay();
        });
        dom.cancelReplyButton.addEventListener("click", exitReplyMode);
        dom.cancelEditButton.addEventListener("click", () => {
            exitEditMode();
            dom.messageInput.value = "";
        });
        dom.closePhotoViewerButton.addEventListener("click", closePhotoViewer);
        dom.photoViewerDialog.addEventListener("click", (event) => {
            if (event.target === dom.photoViewerDialog) {
                closePhotoViewer();
            }
        });
        dom.photoViewerDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closePhotoViewer();
        });
        dom.messagesList.addEventListener("click", (event) => {
            const message = event.target.closest("[data-message-id]");

            if (state.selectingMessages && message) {
                event.preventDefault();
                toggleMessageSelection(Number(message.dataset.messageId || 0));
                return;
            }

            const photoLink = event.target.closest(".attachment-photo");

            if (!photoLink) {
                return;
            }

            event.preventDefault();
            openPhotoViewer(photoLink.dataset.photoUrl || photoLink.href, photoLink.dataset.photoName || "");
        });

        dom.messagesList.addEventListener("contextmenu", (event) => {
            const attachmentElement = event.target.closest("[data-attachment-id]");
            const message = event.target.closest("[data-message-id]");

            if (state.selectingMessages && message) {
                event.preventDefault();
                toggleMessageSelection(Number(message.dataset.messageId || 0));
                return;
            }

            if (attachmentElement && message) {
                event.preventDefault();
                openAttachmentMenu(Number(message.dataset.messageId || 0), attachmentElement.dataset.attachmentId || "", {
                    x: event.clientX,
                    y: event.clientY,
                    messageRect: attachmentElement.getBoundingClientRect(),
                    preferredSide: message.classList.contains("is-own") ? "left" : "right"
                });
                return;
            }

            if (!message || event.target.closest("a, button, input, video, audio")) {
                return;
            }

            event.preventDefault();
            openMessageMenu(Number(message.dataset.messageId || 0), {
                x: event.clientX,
                y: event.clientY,
                messageRect: message.getBoundingClientRect(),
                preferredSide: message.classList.contains("is-own") ? "left" : "right"
            });
        });

        dom.messagesList.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse") {
                return;
            }

            const message = event.target.closest("[data-message-id]");
            const attachmentElement = event.target.closest("[data-attachment-id]");

            if (!message) {
                return;
            }

            window.clearTimeout(state.longPressTimer);
            state.longPressTimer = window.setTimeout(() => {
                if (state.selectingMessages) {
                    toggleMessageSelection(Number(message.dataset.messageId || 0));
                    return;
                }

                if (attachmentElement) {
                    openAttachmentMenu(Number(message.dataset.messageId || 0), attachmentElement.dataset.attachmentId || "", {
                        x: event.clientX,
                        y: event.clientY,
                        messageRect: attachmentElement.getBoundingClientRect(),
                        preferredSide: message.classList.contains("is-own") ? "left" : "right"
                    });
                    return;
                }

                if (event.target.closest("a, button, input, video, audio")) {
                    return;
                }

                openMessageMenu(Number(message.dataset.messageId || 0), {
                    x: event.clientX,
                    y: event.clientY,
                    messageRect: message.getBoundingClientRect(),
                    preferredSide: message.classList.contains("is-own") ? "left" : "right"
                });
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
            openMessageMenu(Number(message.dataset.messageId || 0), messageAnchorFromElement(message));
        });

        document.addEventListener("pointerdown", (event) => {
            if (dom.messageMenuDialog.open && !event.target.closest("#messageMenuDialog")) {
                closeMessageMenu();
            }

            if (dom.roomContextMenuDialog.open && !event.target.closest("#roomContextMenuDialog")) {
                closeRoomContextMenu();
            }
        });

        window.addEventListener("resize", () => {
            closeMessageMenu();
            closeRoomContextMenu();
        });
        dom.messagesList.addEventListener("scroll", closeMessageMenu);
        dom.recentRoomsList.addEventListener("scroll", closeRoomContextMenu);

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
    renderMessages({ scroll: "bottom" });
    renderSelectedFiles();
    registerServiceWorker();
    restoreSession();
})();
