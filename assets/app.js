(function () {
    const appConfig = window.OOTAA_APP || { basePath: "", initialRoom: "", assets: {} };
    const storageKeys = {
        displayName: "ootaa:last-display-name",
        recentRooms: "ootaa:recent-rooms",
        activeRoom: "ootaa:active-room"
    };
    const pollDelays = {
        active: 3000,
        hidden: 10000,
        fast: 900,
        reconnect: 400
    };
    const state = {
        room: null,
        participant: null,
        presence: null,
        syncCursor: null,
        messages: new Map(),
        pollTimer: null,
        editingMessageId: null,
        replyingMessageId: null,
        statusTimer: null,
        contextMessageId: null,
        longPressTimer: null,
        recentLongPressTimer: null,
        chatContextRoomCode: "",
        chatContextOpenedAt: 0,
        recentRoomsSelectMode: false,
        selectedRecentRooms: new Set(),
        recentRoomRenameCode: "",
        recentRoomRenameDraft: "",
        selectedFiles: [],
        uploadXhr: null,
        uploadProgress: 0,
        uploadActive: false,
        newMessagesCount: 0,
        lastPollError: "",
        isOnline: navigator.onLine,
        entryMode: "create",
        entryCodeExpanded: true,
        dragDepth: 0,
        identityEditing: false,
        identitySaving: false,
        roomNameEditing: false,
        roomNameSaving: false
    };

    const dom = {
        appShell: document.querySelector(".app-shell"),
        sidebarPanel: document.getElementById("sidebarPanel"),
        openEntryButton: document.getElementById("openEntryButton"),
        sidebarIdentityDisplay: document.getElementById("sidebarIdentityDisplay"),
        sidebarIdentityAvatar: document.getElementById("sidebarIdentityAvatar"),
        sidebarIdentityEditorAvatar: document.getElementById("sidebarIdentityEditorAvatar"),
        sidebarIdentityName: document.getElementById("sidebarIdentityName"),
        sidebarIdentityHint: document.getElementById("sidebarIdentityHint"),
        sidebarIdentityEditor: document.getElementById("sidebarIdentityEditor"),
        sidebarIdentityInput: document.getElementById("sidebarIdentityInput"),
        sidebarIdentitySaveButton: document.getElementById("sidebarIdentitySaveButton"),
        sidebarIdentityCancelButton: document.getElementById("sidebarIdentityCancelButton"),
        welcomePanel: document.getElementById("welcomePanel"),
        welcomeNewChatButton: document.getElementById("welcomeNewChatButton"),
        welcomeJoinButton: document.getElementById("welcomeJoinButton"),
        entryDialog: document.getElementById("entryDialog"),
        closeEntryDialogButton: document.getElementById("closeEntryDialogButton"),
        entryDialogTitle: document.getElementById("entryDialogTitle"),
        entryDialogDescription: document.getElementById("entryDialogDescription"),
        entryDialogHint: document.getElementById("entryDialogHint"),
        enterForm: document.getElementById("enterForm"),
        displayNameGroup: document.getElementById("displayNameGroup"),
        displayNameInput: document.getElementById("displayNameInput"),
        toggleRoomCodeButton: document.getElementById("toggleRoomCodeButton"),
        roomCodeLabel: document.querySelector("#roomCodeGroup .input-label"),
        roomCodeGroup: document.getElementById("roomCodeGroup"),
        roomCodeInput: document.getElementById("roomCodeInput"),
        enterButton: document.getElementById("enterButton"),
        entryStatus: document.getElementById("entryStatus"),
        recentRoomsSelectionBar: document.getElementById("recentRoomsSelectionBar"),
        recentRoomsSelectionText: document.getElementById("recentRoomsSelectionText"),
        recentRoomsDeleteButton: document.getElementById("recentRoomsDeleteButton"),
        recentRoomsCancelSelectionButton: document.getElementById("recentRoomsCancelSelectionButton"),
        recentRoomsList: document.getElementById("recentRoomsList"),
        clearRecentRoomsButton: document.getElementById("clearRecentRoomsButton"),
        chatView: document.getElementById("chatView"),
        roomAvatar: document.getElementById("roomAvatar"),
        roomNameDisplay: document.getElementById("roomNameDisplay"),
        roomNameText: document.getElementById("roomNameText"),
        roomNameEditor: document.getElementById("roomNameEditor"),
        roomNameInput: document.getElementById("roomNameInput"),
        roomNameSaveButton: document.getElementById("roomNameSaveButton"),
        roomNameCancelButton: document.getElementById("roomNameCancelButton"),
        copyRoomCodeButton: document.getElementById("copyRoomCodeButton"),
        leaveRoomButton: document.getElementById("leaveRoomButton"),
        messagesList: document.getElementById("messagesList"),
        jumpToLatestButton: document.getElementById("jumpToLatestButton"),
        jumpToLatestCount: document.getElementById("jumpToLatestCount"),
        composerForm: document.getElementById("composerForm"),
        composerBox: document.getElementById("composerBox"),
        composerDropHint: document.getElementById("composerDropHint"),
        editModeBanner: document.getElementById("editModeBanner"),
        editModeText: document.getElementById("editModeText"),
        cancelEditButton: document.getElementById("cancelEditButton"),
        replyModeBanner: document.getElementById("replyModeBanner"),
        replyModeTitle: document.getElementById("replyModeTitle"),
        replyModeText: document.getElementById("replyModeText"),
        cancelReplyButton: document.getElementById("cancelReplyButton"),
        messageInput: document.getElementById("messageInput"),
        fileInput: document.getElementById("fileInput"),
        selectedFilesList: document.getElementById("selectedFilesList"),
        uploadProgress: document.getElementById("uploadProgress"),
        uploadProgressLabel: document.getElementById("uploadProgressLabel"),
        uploadProgressPercent: document.getElementById("uploadProgressPercent"),
        uploadProgressBar: document.getElementById("uploadProgressBar"),
        sendButton: document.getElementById("sendButton"),
        chatStatus: document.getElementById("chatStatus"),
        confirmDialog: document.getElementById("confirmDialog"),
        confirmDialogTitle: document.getElementById("confirmDialogTitle"),
        confirmDialogText: document.getElementById("confirmDialogText"),
        confirmDialogCancel: document.getElementById("confirmDialogCancel"),
        confirmDialogAccept: document.getElementById("confirmDialogAccept"),
        messageContextMenu: document.getElementById("messageContextMenu"),
        contextReplyButton: document.getElementById("contextReplyButton"),
        contextCopyButton: document.getElementById("contextCopyButton"),
        contextEditButton: document.getElementById("contextEditButton"),
        contextDeleteButton: document.getElementById("contextDeleteButton"),
        chatContextMenu: document.getElementById("chatContextMenu"),
        chatContextPinButton: document.getElementById("chatContextPinButton"),
        chatContextSelectButton: document.getElementById("chatContextSelectButton"),
        chatContextRenameButton: document.getElementById("chatContextRenameButton"),
        chatContextCopyLinkButton: document.getElementById("chatContextCopyLinkButton"),
        chatContextDeleteButton: document.getElementById("chatContextDeleteButton")
    };

    if (dom.chatContextPinButton) {
        dom.chatContextPinButton.querySelector("span:last-child").textContent = "\u067e\u06cc\u0646";
    }

    function apiPath(path) {
        return `${appConfig.basePath || ""}${path}`;
    }

    function roomPath(roomCode) {
        return apiPath(`/${roomCode}`);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function parseServerDate(value) {
        if (!value) {
            return null;
        }

        const normalized = String(value).replace(" ", "T").replace(/\.(\d{3})\d+$/, ".$1");
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        const date = parseServerDate(value);

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

    function formatTime(value) {
        const date = parseServerDate(value);

        if (!date) {
            return "-";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function formatRelativeDate(value) {
        const date = parseServerDate(value);

        if (!date) {
            return "-";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function formatMessageDay(value) {
        const date = parseServerDate(value);

        if (!date) {
            return "امروز";
        }

        return new Intl.DateTimeFormat("fa-IR", {
            month: "long",
            day: "numeric"
        }).format(date);
    }

    function messageDayKey(value) {
        const date = parseServerDate(value);

        if (!date) {
            return String(value);
        }

        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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

    function setStatus(target, message, isError, persistent) {
        window.clearTimeout(state.statusTimer);

        if (!message) {
            target.hidden = true;
            target.textContent = "";
            target.classList.remove("is-error");
            return;
        }

        target.hidden = false;
        target.textContent = message;
        target.classList.toggle("is-error", Boolean(isError));

        if (!isError && !persistent) {
            state.statusTimer = window.setTimeout(() => {
                if (target.textContent === message) {
                    setStatus(target, "", false, false);
                }
            }, 2200);
        }
    }

    function clearPollError() {
        state.lastPollError = "";

        if (!state.uploadActive && !state.isOnline) {
            setStatus(dom.chatStatus, "شما آفلاین هستید. پیام‌های تازه بعد از اتصال دوباره دریافت می‌شوند.", true, true);
            return;
        }

        if (!state.uploadActive) {
            setStatus(dom.chatStatus, "", false, false);
        }
    }

    async function fetchJson(url, options) {
        const isFormData = options?.body instanceof FormData;
        const response = await fetch(url, {
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...(isFormData ? {} : { "Content-Type": "application/json" }),
                ...(options?.headers || {})
            },
            ...options
        });
        const raw = await response.text();
        return parseJsonPayload(response.status, response.headers.get("content-type") || "", raw);
    }

    function parseJsonPayload(status, contentType, raw) {
        let payload = null;

        try {
            payload = raw ? JSON.parse(raw) : null;
        } catch (error) {
            const isHtmlResponse = contentType.includes("text/html") || raw.trim().startsWith("<");

            if (status >= 500) {
                throw new Error("سرور با خطای داخلی پاسخ داد. تنظیمات دیتابیس، import جداول، و خطاهای PHP را بررسی کنید.");
            }

            if (status === 404) {
                throw new Error("مسیر API پیدا نشد. به احتمال زیاد .htaccess یا rewrite روی هاست درست کار نمی‌کند.");
            }

            if (!raw) {
                throw new Error("سرور پاسخ خالی برگرداند. معمولا یعنی PHP قبل از تولید JSON متوقف شده است.");
            }

            throw new Error(isHtmlResponse
                ? "سرور به‌جای JSON یک صفحه HTML برگرداند. معمولا مشکل از خطای PHP، .htaccess، یا rewrite است."
                : "پاسخ API معتبر نیست.");
        }

        if (status >= 400 || !payload?.ok) {
            throw new Error(payload?.error?.message || "درخواست انجام نشد.");
        }

        return payload.data;
    }

    function sendMultipartWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            state.uploadXhr = xhr;
            xhr.open("POST", url, true);
            xhr.responseType = "text";
            xhr.setRequestHeader("Accept", "application/json");
            xhr.withCredentials = true;

            xhr.upload.addEventListener("progress", (event) => {
                if (!event.lengthComputable) {
                    return;
                }

                const ratio = Math.max(0, Math.min(1, event.loaded / event.total));
                onProgress(ratio);
            });

            xhr.addEventListener("load", () => {
                try {
                    resolve(parseJsonPayload(xhr.status, xhr.getResponseHeader("Content-Type") || "", xhr.responseText || ""));
                } catch (error) {
                    reject(error);
                } finally {
                    state.uploadXhr = null;
                }
            });

            xhr.addEventListener("error", () => {
                state.uploadXhr = null;
                reject(new Error("ارسال فایل به سرور کامل نشد."));
            });

            xhr.addEventListener("abort", () => {
                state.uploadXhr = null;
                reject(new Error("ارسال فایل متوقف شد."));
            });

            xhr.send(formData);
        });
    }

    function setBusy(button, isBusy) {
        button.disabled = isBusy;
    }

    function setOnlineState(isOnline) {
        state.isOnline = isOnline;

        if (!isOnline) {
            setStatus(dom.chatStatus, "شما آفلاین هستید. پیام‌های تازه بعد از اتصال دوباره دریافت می‌شوند.", true, true);
            return;
        }

        if (!state.uploadActive) {
            setStatus(dom.chatStatus, "اتصال دوباره برقرار شد.", false, false);
        }
    }

    function previewKindFromFile(file) {
        if (!file?.type) {
            return "file";
        }

        if (file.type.startsWith("image/")) {
            return "image";
        }

        if (file.type.startsWith("video/")) {
            return "video";
        }

        if (file.type.startsWith("audio/")) {
            return "audio";
        }

        return "file";
    }

    function createSelectedFileEntry(file) {
        const previewKind = previewKindFromFile(file);
        const previewUrl = previewKind === "image" || previewKind === "video"
            ? URL.createObjectURL(file)
            : null;

        return {
            id: `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewKind,
            previewUrl
        };
    }

    function revokeSelectedFileEntry(entry) {
        if (entry?.previewUrl) {
            URL.revokeObjectURL(entry.previewUrl);
        }
    }

    function clearSelectedFiles() {
        state.selectedFiles.forEach(revokeSelectedFileEntry);
        state.selectedFiles = [];
    }

    function replaceSelectedFiles(files) {
        clearSelectedFiles();
        state.selectedFiles = files.map(createSelectedFileEntry);
        syncFileInput();
        updateFileSummary();
    }

    function syncFileInput() {
        const transfer = new DataTransfer();
        state.selectedFiles.forEach((entry) => transfer.items.add(entry.file));
        dom.fileInput.files = transfer.files;
    }

    function updateSendAvailability() {
        const hasText = dom.messageInput.value.trim() !== "";
        const hasFiles = state.selectedFiles.length > 0;
        const canSend = state.room && !state.uploadActive && (state.editingMessageId ? hasText : (hasText || hasFiles));

        dom.sendButton.disabled = !canSend;
    }

    function setUploadProgress(progress, label) {
        state.uploadProgress = progress;
        dom.uploadProgress.hidden = !state.uploadActive;
        dom.uploadProgressLabel.textContent = label || "در حال ارسال...";
        dom.uploadProgressPercent.textContent = `${Math.round(progress * 100)}%`;
        dom.uploadProgressBar.style.width = `${Math.round(progress * 100)}%`;
    }

    function beginUploadProgress() {
        state.uploadActive = true;
        dom.uploadProgress.hidden = false;
        setUploadProgress(0, "در حال ارسال...");
        renderComposerState();
    }

    function finishUploadProgress() {
        state.uploadActive = false;
        state.uploadProgress = 0;
        dom.uploadProgress.hidden = true;
        dom.uploadProgressBar.style.width = "0%";
        dom.uploadProgressPercent.textContent = "0%";
        renderComposerState();
    }

    function getDisplayInitial(value, fallback) {
        const source = String(value || fallback || "?").trim();
        return source.slice(0, 2).toUpperCase();
    }

    function hashString(value) {
        let hash = 0;
        const source = String(value || "");

        for (let index = 0; index < source.length; index += 1) {
            hash = ((hash << 5) - hash) + source.charCodeAt(index);
            hash |= 0;
        }

        return Math.abs(hash);
    }

    function getAvatarPalette(key) {
        const palettes = [
            {
                bg: "linear-gradient(135deg, #66c3ff, #4f84ff)",
                shadow: "rgba(78, 164, 246, 0.28)"
            },
            {
                bg: "linear-gradient(135deg, #42d7b6, #0f9d92)",
                shadow: "rgba(15, 157, 146, 0.24)"
            },
            {
                bg: "linear-gradient(135deg, #8d8bff, #5b49d6)",
                shadow: "rgba(91, 73, 214, 0.24)"
            },
            {
                bg: "linear-gradient(135deg, #ffb36b, #f27052)",
                shadow: "rgba(242, 112, 82, 0.24)"
            },
            {
                bg: "linear-gradient(135deg, #ff8cc6, #d85fa8)",
                shadow: "rgba(216, 95, 168, 0.24)"
            },
            {
                bg: "linear-gradient(135deg, #b1d36b, #5ea14b)",
                shadow: "rgba(94, 161, 75, 0.24)"
            },
            {
                bg: "linear-gradient(135deg, #ffd86f, #f2a33b)",
                shadow: "rgba(242, 163, 59, 0.24)"
            }
        ];
        const palette = palettes[hashString(key) % palettes.length];
        return `--avatar-bg: ${palette.bg}; --avatar-shadow: ${palette.shadow};`;
    }

    function getStoredDisplayName() {
        return (localStorage.getItem(storageKeys.displayName) || "").trim();
    }

    function getResolvedDisplayName() {
        return state.participant?.displayName || dom.displayNameInput.value.trim() || getStoredDisplayName() || "";
    }

    function getRoomDisplayName(room = state.room) {
        const roomCode = room?.code || room?.roomCode;

        if (!roomCode) {
            return "اتاق ----";
        }

        const rememberedRoom = getRecentRooms().find((item) => item.roomCode === roomCode);
        const customName = String(rememberedRoom?.customRoomName || "").trim();
        const roomName = String(room?.name || room?.roomName || "").trim();

        return customName || roomName || `اتاق ${roomCode}`;
    }

    function canEditRoomName() {
        return Boolean(state.room?.isCreator);
    }

    function syncStoredDisplayName(displayName) {
        const normalized = String(displayName || "").trim();

        if (!normalized) {
            localStorage.removeItem(storageKeys.displayName);
            return;
        }

        localStorage.setItem(storageKeys.displayName, normalized);
        dom.displayNameInput.value = normalized;

        const activeRoom = readJson(storageKeys.activeRoom, {});
        const activeRoomCode = state.room?.code || activeRoom.roomCode || "";

        if (activeRoomCode) {
            writeJson(storageKeys.activeRoom, {
                roomCode: activeRoomCode,
                displayName: normalized
            });
        }

        const recentRooms = readJson(storageKeys.recentRooms, []);

        if (recentRooms.length > 0) {
            writeJson(storageKeys.recentRooms, recentRooms.map((room) => ({
                ...room,
                displayName: normalized
            })));
        }
    }

    function updateRememberedRoomMeta(room, displayName) {
        if (!room?.code) {
            return;
        }

        const existing = readJson(storageKeys.recentRooms, []);

        if (existing.length === 0) {
            return;
        }

        writeJson(storageKeys.recentRooms, existing.map((item) => {
            if (item.roomCode !== room.code) {
                return item;
            }

            const nextRoomName = String(room.name || "").trim();
            const previousRoomName = String(item.roomName || "").trim();
            const previousCustomName = String(item.customRoomName || "").trim();
            const defaultRoomTitle = `اتاق ${item.roomCode}`;
            const nextCustomRoomName = previousCustomName
                && previousCustomName !== previousRoomName
                && previousCustomName !== defaultRoomTitle
                ? previousCustomName
                : "";

            return {
                ...item,
                roomName: nextRoomName,
                customRoomName: nextCustomRoomName,
                displayName: displayName || item.displayName
            };
        }));
    }

    function getRecentRoomTitle(room) {
        if (!room?.roomCode) {
            return "اتاق ----";
        }

        return String(room.customRoomName || room.roomName || "").trim() || `اتاق ${room.roomCode}`;
    }

    function setSidebarIdentityHint(message, isError) {
        dom.sidebarIdentityHint.textContent = message || "";
        dom.sidebarIdentityHint.classList.toggle("is-error", Boolean(isError));
    }

    function getRecentRooms() {
        const rooms = readJson(storageKeys.recentRooms, []);

        return rooms
            .map((room) => ({
                ...room,
                isPinned: Boolean(room.isPinned),
                customRoomName: String(room.customRoomName || "").trim(),
            }))
            .sort((left, right) => {
                if (left.isPinned !== right.isPinned) {
                    return left.isPinned ? -1 : 1;
                }

                return String(right.visitedAt || "").localeCompare(String(left.visitedAt || ""));
            });
    }

    function writeRecentRooms(rooms) {
        writeJson(storageKeys.recentRooms, rooms);
    }

    function syncRecentRoomsUiState(rooms) {
        const roomCodes = new Set(rooms.map((room) => room.roomCode));

        state.selectedRecentRooms.forEach((roomCode) => {
            if (!roomCodes.has(roomCode)) {
                state.selectedRecentRooms.delete(roomCode);
            }
        });

        if (state.recentRoomRenameCode && !roomCodes.has(state.recentRoomRenameCode)) {
            state.recentRoomRenameCode = "";
            state.recentRoomRenameDraft = "";
        }

        if (rooms.length === 0) {
            state.recentRoomsSelectMode = false;
        }
    }

    function renderRecentRoomsSelectionBar() {
        const isVisible = state.recentRoomsSelectMode;
        const selectedCount = state.selectedRecentRooms.size;
        const selectionLabel = selectedCount === 0
            ? "حالت انتخاب فعال است"
            : `${selectedCount} گفتگو انتخاب شده`;

        dom.recentRoomsSelectionBar.hidden = !isVisible;
        dom.recentRoomsSelectionText.textContent = selectionLabel;
        dom.recentRoomsDeleteButton.disabled = selectedCount === 0;
    }

    function syncDisplayNamePrompt(forcePrompt) {
        const hasPersistentDisplayName = Boolean(state.participant?.displayName || getStoredDisplayName());
        const requiresPrompt = Boolean(forcePrompt || !hasPersistentDisplayName);
        dom.displayNameGroup.hidden = !requiresPrompt;
        dom.displayNameInput.required = requiresPrompt;
    }

    function renderSidebarIdentity() {
        const displayName = getResolvedDisplayName();
        if (dom.sidebarIdentityAvatar) {
            dom.sidebarIdentityAvatar.textContent = "";
            dom.sidebarIdentityAvatar.setAttribute("style", getAvatarPalette(displayName || "sidebar-identity"));
        }
        if (dom.sidebarIdentityEditorAvatar) {
            dom.sidebarIdentityEditorAvatar.textContent = "";
            dom.sidebarIdentityEditorAvatar.setAttribute("style", getAvatarPalette(`editor:${displayName || "sidebar-identity"}`));
        }
        dom.sidebarIdentityName.textContent = displayName || "بدون نام نمایشی";
        dom.sidebarIdentityDisplay.hidden = state.identityEditing;
        dom.sidebarIdentityEditor.hidden = !state.identityEditing;
        dom.sidebarIdentityInput.disabled = state.identitySaving;
        dom.sidebarIdentitySaveButton.disabled = state.identitySaving;
        dom.sidebarIdentityCancelButton.disabled = state.identitySaving;

        if (!state.identityEditing) {
            setSidebarIdentityHint("", false);
        }
    }

    function renderRoomNameControls() {
        const canEdit = canEditRoomName();
        const roomTitle = getRoomDisplayName();

        dom.roomNameText.textContent = roomTitle;
        dom.roomNameDisplay.hidden = state.roomNameEditing;
        dom.roomNameEditor.hidden = !state.roomNameEditing;
        dom.roomNameDisplay.disabled = !canEdit;
        dom.roomNameDisplay.classList.toggle("room-name-button--editable", canEdit);
        dom.roomNameInput.disabled = state.roomNameSaving;
        dom.roomNameSaveButton.disabled = state.roomNameSaving;
        dom.roomNameCancelButton.disabled = state.roomNameSaving;
        dom.roomNameDisplay.setAttribute("title", canEdit ? "ویرایش نام اتاق" : roomTitle);
        dom.roomNameDisplay.setAttribute("aria-label", canEdit ? "ویرایش نام اتاق" : roomTitle);

        if (!state.roomNameEditing) {
            dom.roomNameInput.value = state.room?.name || "";
        }
    }

    function setRoomCodeVisibility(visible) {
        dom.roomCodeGroup.hidden = !visible;
        dom.toggleRoomCodeButton?.setAttribute("aria-expanded", visible ? "true" : "false");
        dom.toggleRoomCodeButton.textContent = "اگر کد داری";
        updateEntryDialogTexts();
    }

    function syncRoomCodeVisibility() {
        const hasRoomCode = Boolean(dom.roomCodeInput.value.trim());
        setRoomCodeVisibility(state.entryCodeExpanded || hasRoomCode);
    }

    function updateEntryDialogTexts() {
        const joining = state.entryMode === "join" || Boolean(dom.roomCodeInput.value.trim());

        dom.entryDialogTitle.textContent = joining ? "ورود با کد اتاق" : "گفت‌وگوی جدید";
        dom.entryDialogDescription.textContent = "";
        dom.entryDialogHint.textContent = "";
        if (dom.roomCodeLabel) {
            dom.roomCodeLabel.textContent = "اگر کد داری";
        }
        dom.enterButton.querySelector("span").textContent = joining ? "ورود به گفتگو" : "ساخت و ورود";
    }

    function openEntryDialog(mode, roomCode) {
        state.entryMode = mode === "join" ? "join" : "create";
        state.entryCodeExpanded = true;
        const displayName = getResolvedDisplayName();
        dom.displayNameInput.value = displayName;
        dom.roomCodeInput.value = roomCode || "";
        syncDisplayNamePrompt(!displayName);
        syncRoomCodeVisibility();
        updateEntryDialogTexts();
        renderSidebarIdentity();
        setStatus(dom.entryStatus, "", false, false);

        if (!dom.entryDialog.open) {
            dom.entryDialog.showModal();
        }

        if (!dom.displayNameGroup.hidden) {
            dom.displayNameInput.focus();
        } else if (!dom.roomCodeGroup.hidden && !dom.roomCodeInput.value.trim()) {
            dom.roomCodeInput.focus();
        } else {
            dom.enterButton.focus();
        }
    }

    function closeEntryDialog() {
        if (dom.entryDialog.open) {
            dom.entryDialog.close();
        }

        setStatus(dom.entryStatus, "", false, false);
    }

    function startRoomNameEdit() {
        if (!state.room || !canEditRoomName() || state.roomNameEditing) {
            return;
        }

        state.roomNameEditing = true;
        state.roomNameSaving = false;
        dom.roomNameInput.value = state.room.name || "";
        renderRoomNameControls();

        window.requestAnimationFrame(() => {
            dom.roomNameInput.focus();
            dom.roomNameInput.select();
        });
    }

    function cancelRoomNameEdit() {
        state.roomNameEditing = false;
        state.roomNameSaving = false;
        renderRoomNameControls();
    }

    async function submitRoomNameEdit() {
        const roomName = dom.roomNameInput.value.trim();

        if (!state.room) {
            return;
        }

        if (!roomName) {
            setStatus(dom.chatStatus, "نام اتاق را وارد کنید.", true, true);
            dom.roomNameInput.focus();
            return;
        }

        if (roomName === String(state.room.name || "").trim()) {
            state.roomNameEditing = false;
            state.roomNameSaving = false;
            renderRoomNameControls();
            return;
        }

        state.roomNameSaving = true;
        renderRoomNameControls();

        try {
            const data = await fetchJson(apiPath("/api/room/name"), {
                method: "PATCH",
                body: JSON.stringify({
                    roomCode: state.room.code,
                    name: roomName
                })
            });

            if (state.room) {
                state.room.name = roomName;
            }
            applyRoomPayload(data);
            state.roomNameEditing = false;
            state.roomNameSaving = false;
            renderShell();
            setStatus(dom.chatStatus, "نام اتاق به‌روزرسانی شد.", false, false);
        } catch (error) {
            state.roomNameSaving = false;
            renderRoomNameControls();
            setStatus(dom.chatStatus, error.message, true, true);
        }
    }

    function startIdentityEdit() {
        if (state.identityEditing) {
            return;
        }

        state.identityEditing = true;
        state.identitySaving = false;
        dom.sidebarIdentityInput.value = getResolvedDisplayName();
        renderSidebarIdentity();

        window.requestAnimationFrame(() => {
            dom.sidebarIdentityInput.focus();
            dom.sidebarIdentityInput.select();
        });
    }

    function cancelIdentityEdit() {
        state.identityEditing = false;
        state.identitySaving = false;
        dom.sidebarIdentityInput.value = getResolvedDisplayName();
        renderSidebarIdentity();
    }

    async function submitIdentityEdit() {
        const nextDisplayName = dom.sidebarIdentityInput.value.trim();

        if (!nextDisplayName) {
            setSidebarIdentityHint("نام نمایشی را وارد کنید.", true);
            dom.sidebarIdentityInput.focus();
            return;
        }

        const currentDisplayName = getResolvedDisplayName();

        if (nextDisplayName === currentDisplayName) {
            state.identityEditing = false;
            state.identitySaving = false;
            renderShell();
            return;
        }

        state.identitySaving = true;
        setSidebarIdentityHint("در حال ذخیره...", false);
        renderSidebarIdentity();

        try {
            if (state.room?.code) {
                const data = await fetchJson(apiPath("/api/room/enter"), {
                    method: "POST",
                    body: JSON.stringify({
                        displayName: nextDisplayName,
                        roomCode: state.room.code
                    })
                });

                applyRoomPayload(data);
            }

            if (state.participant) {
                state.participant.displayName = nextDisplayName;
            }

            syncStoredDisplayName(nextDisplayName);
            state.identityEditing = false;
            state.identitySaving = false;
            renderShell();
        } catch (error) {
            state.identitySaving = false;
            setSidebarIdentityHint(error.message, true);
            renderSidebarIdentity();
        }
    }

    async function enterRoom(displayName, roomCode, isAutomatic) {
        document.body.classList.remove("app-loading");
        setStatus(dom.entryStatus, isAutomatic ? "در حال بازیابی گفتگو..." : "در حال ورود به اتاق...", false, true);
        setBusy(dom.enterButton, true);

        try {
            const data = await fetchJson(apiPath("/api/room/enter"), {
                method: "POST",
                body: JSON.stringify({
                    displayName,
                    roomCode
                })
            });

            state.room = data.room;
            state.participant = data.participant;
            state.presence = data.presence || null;
            state.syncCursor = null;
            state.messages.clear();
            state.editingMessageId = null;
            state.newMessagesCount = 0;

            syncStoredDisplayName(displayName);
            writeJson(storageKeys.activeRoom, {
                roomCode: data.room.code,
                displayName
            });
            rememberRoom(data.room, displayName);
            history.replaceState({}, "", roomPath(data.room.code));
            dom.displayNameInput.value = displayName;
            dom.roomCodeInput.value = data.room.code;

            renderShell();
            renderLoadingMessages();
            closeEntryDialog();
            await bootstrapRoom();
            setStatus(dom.entryStatus, "", false, false);
        } catch (error) {
            if (isAutomatic) {
                localStorage.removeItem(storageKeys.activeRoom);
            }

            setStatus(dom.entryStatus, error.message, true, true);
            leaveRoom(false);

            if (!isAutomatic) {
                openEntryDialog(roomCode ? "join" : "create", roomCode);
            }
        } finally {
            setBusy(dom.enterButton, false);
            renderSidebarIdentity();
        }
    }

    function applyRoomPayload(data) {
        state.room = data.room || state.room;
        state.participant = data.participant || state.participant;
        state.presence = data.presence || state.presence;

        if (state.room) {
            updateRememberedRoomMeta(
                state.room,
                data.participant?.displayName || state.participant?.displayName || getStoredDisplayName()
            );
        }
    }

    async function bootstrapRoom() {
        const data = await fetchJson(`${apiPath("/api/room/bootstrap")}?code=${encodeURIComponent(state.room.code)}`);

        applyRoomPayload(data);
        state.syncCursor = data.syncCursor;
        state.messages = new Map();

        data.messages.forEach((message) => {
            state.messages.set(message.id, message);
        });

        renderShell();
        renderMessages(true, 0);
        schedulePolling("fast");
    }

    async function pollMessages() {
        if (!state.room) {
            return;
        }

        try {
            const query = new URLSearchParams({ code: state.room.code });

            if (state.syncCursor) {
                query.set("since", state.syncCursor);
            }

            const data = await fetchJson(`${apiPath("/api/room/messages")}?${query.toString()}`);
            const beforeIds = new Set(state.messages.keys());
            const incoming = [];

            applyRoomPayload(data);

            data.messages.forEach((message) => {
                if (!beforeIds.has(message.id)) {
                    incoming.push(message);
                }

                state.messages.set(message.id, message);
            });

            if (data.syncCursor) {
                state.syncCursor = data.syncCursor;
            }

            clearPollError();
            renderShell();
            renderMessages(false, incoming.length);
        } catch (error) {
            if (error.message !== state.lastPollError) {
                state.lastPollError = error.message;
                setStatus(dom.chatStatus, error.message, true, true);
            }
        } finally {
            schedulePolling("normal");
        }
    }

    function schedulePolling(mode) {
        window.clearTimeout(state.pollTimer);

        if (!state.room) {
            return;
        }

        let delay = pollDelays.active;

        switch (mode) {
            case "fast":
                delay = pollDelays.fast;
                break;
            case "reconnect":
                delay = pollDelays.reconnect;
                break;
            case "normal":
            default:
                delay = document.visibilityState === "visible" ? pollDelays.active : pollDelays.hidden;
                break;
        }

        state.pollTimer = window.setTimeout(() => {
            pollMessages();
        }, delay);
    }

    function summarizeReplyTarget(message) {
        if (!message) {
            return "پیام ناموجود";
        }

        if (message.isDeleted) {
            return "پیام حذف شده";
        }

        const bodyText = String(message.bodyText || "").trim();

        if (bodyText !== "") {
            return bodyText.length > 90 ? `${bodyText.slice(0, 87)}...` : bodyText;
        }

        if ((message.attachments || []).length > 0) {
            return "فایل پیوست‌شده";
        }

        return "پیام خالی";
    }

    function enterReplyMode(messageId) {
        const message = state.messages.get(messageId);

        if (!message) {
            return;
        }

        state.replyingMessageId = messageId;

        if (state.editingMessageId) {
            state.editingMessageId = null;
        }

        renderComposerState();
        dom.messageInput.focus();
        setStatus(dom.chatStatus, "حالت پاسخ فعال شد.", false, false);
    }

    function exitReplyMode() {
        state.replyingMessageId = null;
        renderComposerState();
    }

    async function sendMessage(event) {
        event.preventDefault();

        if (!state.room || dom.sendButton.disabled) {
            return;
        }

        const text = dom.messageInput.value.trim();
        setBusy(dom.sendButton, true);

        try {
            if (state.editingMessageId) {
                const data = await fetchJson(apiPath(`/api/messages/${state.editingMessageId}`), {
                    method: "PATCH",
                    body: JSON.stringify({ text })
                });

                applyRoomPayload(data);
                state.messages.set(data.message.id, data.message);
                state.syncCursor = data.message.updatedAt;
                resetComposer();
                renderShell();
                renderMessages(false, 0);
                setStatus(dom.chatStatus, "ویرایش ذخیره شد.", false, false);
                schedulePolling("fast");
                return;
            }

            const formData = new FormData();
            formData.append("roomCode", state.room.code);
            formData.append("text", dom.messageInput.value);
            if (state.replyingMessageId) {
                formData.append("replyToMessageId", String(state.replyingMessageId));
            }

            state.selectedFiles.forEach((entry) => {
                formData.append("files[]", entry.file, entry.file.name);
            });

            beginUploadProgress();

            const data = await sendMultipartWithProgress(apiPath("/api/room/messages"), formData, (progress) => {
                setUploadProgress(progress, "در حال بارگذاری فایل...");
            });

            applyRoomPayload(data);
            state.messages.set(data.message.id, data.message);
            state.syncCursor = data.message.updatedAt;
            resetComposer();
            finishUploadProgress();
            renderShell();
            renderMessages(true, 0);
            setStatus(dom.chatStatus, "پیام ارسال شد.", false, false);
            schedulePolling("fast");
        } catch (error) {
            finishUploadProgress();
            setStatus(dom.chatStatus, error.message, true, true);
        } finally {
            setBusy(dom.sendButton, false);
            updateSendAvailability();
        }
    }

    function enterEditMode(messageId) {
        const current = state.messages.get(messageId);

        if (!current || current.isDeleted) {
            return;
        }

        state.editingMessageId = messageId;
        state.replyingMessageId = null;
        dom.messageInput.value = current.bodyText || "";
        clearSelectedFiles();
        syncFileInput();
        updateFileSummary();
        renderComposerState();
        autoResizeTextarea();
        dom.messageInput.focus();
        setStatus(dom.chatStatus, "ویرایش پیام فعال شد.", false, false);
    }

    function exitEditMode() {
        state.editingMessageId = null;
        renderComposerState();
    }

    async function deleteMessage(messageId) {
        const confirmed = await confirmAction({
            title: "حذف پیام",
            text: "پیام برای همه اعضای اتاق حذف می‌شود. مطمئن هستید؟",
            acceptLabel: "حذف"
        });

        if (!confirmed) {
            return;
        }

        try {
            const data = await fetchJson(apiPath(`/api/messages/${messageId}`), {
                method: "DELETE",
                body: JSON.stringify({})
            });

            applyRoomPayload(data);
            state.messages.set(data.message.id, data.message);
            state.syncCursor = data.message.updatedAt;

            if (state.editingMessageId === messageId) {
                resetComposer();
            }

            renderShell();
            renderMessages(false, 0);
            setStatus(dom.chatStatus, "پیام حذف شد.", false, false);
            schedulePolling("fast");
        } catch (error) {
            setStatus(dom.chatStatus, error.message, true, true);
        }
    }

    function hideMessageContextMenu() {
        state.contextMessageId = null;
        dom.messageContextMenu.hidden = true;
    }

    function hideChatContextMenu() {
        state.chatContextRoomCode = "";
        state.chatContextOpenedAt = 0;
        dom.chatContextMenu.hidden = true;
    }

    function positionContextMenu(menu, x, y) {
        const rect = menu.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 170);
        const menuHeight = Math.max(rect.height, 48);
        const left = Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12));
        const top = Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12));

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function showMessageContextMenu(messageId, isOwn, x, y) {
        state.contextMessageId = messageId;
        dom.contextReplyButton.hidden = false;
        dom.contextEditButton.hidden = !isOwn;
        dom.contextDeleteButton.hidden = !isOwn;
        dom.messageContextMenu.hidden = false;
        positionContextMenu(dom.messageContextMenu, x, y);
    }

    function showChatContextMenu(roomCode, x, y) {
        const room = getRecentRoomByCode(roomCode);

        if (!room) {
            return;
        }

        state.chatContextRoomCode = roomCode;
        state.chatContextOpenedAt = Date.now();
        dom.chatContextPinButton.dataset.pinLabel = room.isPinned ? "\u0628\u0631\u062f\u0627\u0634\u062a\u0646 \u067e\u06cc\u0646" : "\u067e\u06cc\u0646";
        dom.chatContextPinButton.querySelector("span:last-child").textContent = room.isPinned ? "برداشتن سنجاق" : "سنجاق";
        dom.chatContextSelectButton.querySelector("span:last-child").textContent = state.selectedRecentRooms.has(roomCode) ? "لغو انتخاب" : "انتخاب";
        dom.chatContextMenu.hidden = false;
        dom.chatContextPinButton.querySelector("span:last-child").textContent = dom.chatContextPinButton.dataset.pinLabel || "pin";

        dom.chatContextPinButton.querySelector("span:last-child").textContent = dom.chatContextPinButton.dataset.pinLabel || "\u067e\u06cc\u0646";
        positionContextMenu(dom.chatContextMenu, x, y);
    }

    async function copyMessageText(messageId) {
        const message = state.messages.get(messageId);

        if (!message || !message.bodyText) {
            setStatus(dom.chatStatus, "متنی برای کپی وجود ندارد.", true, true);
            return;
        }

        try {
            await navigator.clipboard.writeText(message.bodyText);
            setStatus(dom.chatStatus, "پیام کپی شد.", false, false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی خودکار انجام نشد.", true, true);
        }
    }

    async function copyRoomLink(roomCode) {
        try {
            await navigator.clipboard.writeText(window.location.origin + roomPath(roomCode));
            setStatus(dom.chatStatus, "لینک اتاق کپی شد.", false, false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی خودکار انجام نشد. لینک را دستی کپی کنید.", true, true);
        }
    }

    function getRecentRoomByCode(roomCode) {
        return getRecentRooms().find((room) => room.roomCode === roomCode) || null;
    }

    function toggleRecentRoomPin(roomCode) {
        const rooms = getRecentRooms().map((room) => (
            room.roomCode === roomCode
                ? { ...room, isPinned: !room.isPinned }
                : room
        ));
        writeRecentRooms(rooms);
        renderRecentRooms();
    }

    function exitRecentRoomsSelectMode() {
        state.recentRoomsSelectMode = false;
        state.selectedRecentRooms.clear();
        renderRecentRooms();
    }

    function toggleRecentRoomSelection(roomCode) {
        state.recentRoomsSelectMode = true;
        state.recentRoomRenameCode = "";
        state.recentRoomRenameDraft = "";

        if (state.selectedRecentRooms.has(roomCode)) {
            state.selectedRecentRooms.delete(roomCode);
        } else {
            state.selectedRecentRooms.add(roomCode);
        }

        renderRecentRooms();
    }

    function startRecentRoomRename(roomCode) {
        const room = getRecentRoomByCode(roomCode);

        if (!room) {
            return;
        }

        state.recentRoomsSelectMode = false;
        state.selectedRecentRooms.clear();
        state.recentRoomRenameCode = roomCode;
        state.recentRoomRenameDraft = getRecentRoomTitle(room);
        renderRecentRooms();

        window.requestAnimationFrame(() => {
            const input = dom.recentRoomsList.querySelector("[data-recent-room-rename-input]");

            if (input) {
                input.focus();
                input.select();
            }
        });
    }

    function cancelRecentRoomRename() {
        state.recentRoomRenameCode = "";
        state.recentRoomRenameDraft = "";
        renderRecentRooms();
    }

    function submitRecentRoomRename() {
        const roomCode = state.recentRoomRenameCode;
        const rooms = getRecentRooms();
        const room = rooms.find((item) => item.roomCode === roomCode);
        const nextName = state.recentRoomRenameDraft.trim();

        if (!room) {
            cancelRecentRoomRename();
            return;
        }

        if (!nextName) {
            setStatus(dom.chatStatus, "Ù†Ø§Ù… Ú¯ÙØªÚ¯Ùˆ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯.", true, true);
            const input = dom.recentRoomsList.querySelector("[data-recent-room-rename-input]");

            if (input) {
                input.focus();
            }

            return;
        }

        const baseTitle = String(room.roomName || "").trim() || `Ø§ØªØ§Ù‚ ${room.roomCode}`;
        const nextRooms = rooms.map((item) => {
            if (item.roomCode !== roomCode) {
                return item;
            }

            return {
                ...item,
                customRoomName: nextName === baseTitle ? "" : nextName
            };
        });

        writeRecentRooms(nextRooms);
        state.recentRoomRenameCode = "";
        state.recentRoomRenameDraft = "";

        if (state.room?.code === roomCode) {
            renderShell();
        } else {
            renderRecentRooms();
        }

        setStatus(dom.chatStatus, "Ù†Ø§Ù… Ú¯ÙØªÚ¯Ùˆ Ø¨Ù‡â€ŒØ±ÙˆØ² Ø´Ø¯.", false, false);
    }

    async function deleteRecentRoomShortcut(roomCode) {
        const confirmed = await confirmAction({
            title: "حذف از گفتگوها",
            text: "این مورد فقط از فهرست گفتگوهای اخیر شما حذف می‌شود.",
            acceptLabel: "حذف"
        });

        if (!confirmed) {
            return;
        }

        const rooms = getRecentRooms().filter((room) => room.roomCode !== roomCode);
        state.selectedRecentRooms.delete(roomCode);
        if (state.recentRoomRenameCode === roomCode) {
            state.recentRoomRenameCode = "";
            state.recentRoomRenameDraft = "";
        }
        writeRecentRooms(rooms);
        renderRecentRooms();
        setStatus(dom.chatStatus, "گفتگو از فهرست حذف شد.", false, false);
    }

    async function deleteSelectedRecentRooms() {
        const selectedRoomCodes = Array.from(state.selectedRecentRooms);

        if (selectedRoomCodes.length === 0) {
            return;
        }

        const confirmed = await confirmAction({
            title: "Ø­Ø°Ù Ú¯ÙØªÚ¯ÙˆÙ‡Ø§ÛŒ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡",
            text: selectedRoomCodes.length === 1
                ? "Ø§ÛŒÙ† Ù…ÙˆØ±Ø¯ ÙÙ‚Ø· Ø§Ø² ÙÙ‡Ø±Ø³Øª Ú¯ÙØªÚ¯ÙˆÙ‡Ø§ÛŒ Ø§Ø®ÛŒØ± Ø´Ù…Ø§ Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆØ¯."
                : "Ú¯ÙØªÚ¯ÙˆÙ‡Ø§ÛŒ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡ ÙÙ‚Ø· Ø§Ø² ÙÙ‡Ø±Ø³Øª Ú¯ÙØªÚ¯ÙˆÙ‡Ø§ÛŒ Ø§Ø®ÛŒØ± Ø´Ù…Ø§ Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.",
            acceptLabel: "Ø­Ø°Ù"
        });

        if (!confirmed) {
            return;
        }

        const selectedSet = new Set(selectedRoomCodes);
        const rooms = getRecentRooms().filter((room) => !selectedSet.has(room.roomCode));
        state.recentRoomsSelectMode = false;
        state.selectedRecentRooms.clear();
        state.recentRoomRenameCode = "";
        state.recentRoomRenameDraft = "";
        writeRecentRooms(rooms);
        renderRecentRooms();
        setStatus(dom.chatStatus, selectedRoomCodes.length === 1 ? "Ú¯ÙØªÚ¯Ùˆ Ø­Ø°Ù Ø´Ø¯." : "Ú¯ÙØªÚ¯ÙˆÙ‡Ø§ÛŒ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡ Ø­Ø°Ù Ø´Ø¯Ù†Ø¯.", false, false);
    }

    function getContextTargetFromBubble(bubble) {
        if (!bubble) {
            return null;
        }

        const messageId = Number(bubble.dataset.messageId || 0);

        if (!messageId) {
            return null;
        }

        return {
            messageId,
            isOwn: bubble.dataset.messageOwn === "1"
        };
    }

    function confirmAction({ title, text, acceptLabel }) {
        return new Promise((resolve) => {
            dom.confirmDialogTitle.textContent = title;
            dom.confirmDialogText.textContent = text;
            dom.confirmDialogAccept.textContent = acceptLabel;

            const close = (result) => {
                dom.confirmDialogCancel.removeEventListener("click", onCancel);
                dom.confirmDialogAccept.removeEventListener("click", onAccept);
                dom.confirmDialog.removeEventListener("cancel", onCancel);
                if (dom.confirmDialog.open) {
                    dom.confirmDialog.close();
                }
                resolve(result);
            };

            const onCancel = () => close(false);
            const onAccept = () => close(true);

            dom.confirmDialogCancel.addEventListener("click", onCancel, { once: true });
            dom.confirmDialogAccept.addEventListener("click", onAccept, { once: true });
            dom.confirmDialog.addEventListener("cancel", onCancel, { once: true });
            dom.confirmDialog.showModal();
        });
    }

    function renderShell() {
        const isInRoom = Boolean(state.room);
        dom.welcomePanel.hidden = isInRoom;
        dom.chatView.hidden = !isInRoom;
        dom.appShell.classList.toggle("app-shell--in-room", isInRoom);
        document.body.classList.remove("app-loading");

        if (isInRoom) {
            dom.roomAvatar.textContent = "";
            dom.roomAvatar.setAttribute("style", getAvatarPalette(getRoomDisplayName(state.room) || state.room.code));
            renderRoomNameControls();
        }

        renderRecentRooms();
        renderSidebarIdentity();
        renderComposerState();
        renderJumpToLatest();
    }

    function renderLoadingMessages() {
        dom.messagesList.innerHTML = `
            <div class="messages-loading">
                <span class="messages-loading__pulse"></span>
                <span class="messages-loading__pulse"></span>
                <span class="messages-loading__pulse"></span>
            </div>
        `;
    }

    function renderMessages(forceScroll, incomingCount) {
        const items = Array.from(state.messages.values())
            .filter((message) => !message.isDeleted)
            .sort((left, right) => left.id - right.id);
        const shouldStickToBottom = forceScroll || isScrolledNearBottom(dom.messagesList);
        const previousScrollHeight = dom.messagesList.scrollHeight;
        const previousScrollTop = dom.messagesList.scrollTop;

        if (items.length === 0) {
            dom.messagesList.innerHTML = `
                <div class="messages-empty empty-state">
                    هنوز پیامی در این اتاق نیست.
                    <br>
                    گفتگو را با یک پیام کوتاه یا یک فایل شروع کنید.
                </div>
            `;
            state.newMessagesCount = 0;
            renderJumpToLatest();
            return;
        }

        let previousDay = "";
        const markup = [];

        items.forEach((message) => {
            const currentDay = messageDayKey(message.createdAt);

            if (currentDay !== previousDay) {
                previousDay = currentDay;
                markup.push(`
                    <div class="message-day-separator">
                        <span>${formatMessageDay(message.createdAt)}</span>
                    </div>
                `);
            }

            markup.push(renderMessageCard(message));
        });

        dom.messagesList.innerHTML = markup.join("");

        if (shouldStickToBottom) {
            dom.messagesList.scrollTop = dom.messagesList.scrollHeight;
            state.newMessagesCount = 0;
        } else {
            const nextScrollHeight = dom.messagesList.scrollHeight;
            dom.messagesList.scrollTop = previousScrollTop + (nextScrollHeight - previousScrollHeight);

            if (incomingCount > 0) {
                state.newMessagesCount += incomingCount;
            }
        }

        renderJumpToLatest();
    }

    function renderMessageCard(message) {
        const rowClass = message.isOwn ? "own" : "other";
        const hasAttachments = (message.attachments || []).length > 0;
        const author = !message.isOwn ? `<div class="message-author">${escapeHtml(message.senderName)}</div>` : "";
        const body = message.bodyText ? `<div class="message-text">${escapeHtml(message.bodyText)}</div>` : "";
        const editedText = message.isEdited ? '<span class="message-edited">ویرایش‌شده</span>' : "";
        const replyMarkup = message.replyTo ? `
            <button type="button" class="message-reply-preview" data-jump-message="${message.replyTo.id}">
                <strong>${escapeHtml(message.replyTo.senderName || "پیام")}</strong>
                <span>${escapeHtml(summarizeReplyTarget(message.replyTo))}</span>
            </button>
        ` : "";

        return `
            <article class="message-row ${rowClass}">
                <div class="message-bubble${hasAttachments ? " has-attachments" : ""}" data-message-id="${message.id}" data-message-own="${message.isOwn ? "1" : "0"}">
                    ${author}
                    ${replyMarkup}
                    ${body}
                    ${renderAttachments(message.attachments || [])}
                    <div class="message-foot">
                        ${editedText}
                        <span class="message-time">${formatTime(message.createdAt)}</span>
                    </div>
                </div>
            </article>
        `;
    }

    function renderAttachments(attachments) {
        if (!attachments || attachments.length === 0) {
            return "";
        }

        return `
            <div class="message-attachments">
                ${attachments.map((attachment) => {
                    if (attachment.previewKind === "image") {
                        return `
                            <div class="attachment-card">
                                <img class="attachment-media" src="${attachment.url}" alt="${escapeHtml(attachment.name)}" loading="lazy">
                                <div class="attachment-body">
                                    ${renderAttachmentMeta(attachment, "image")}
                                </div>
                            </div>
                        `;
                    }

                    if (attachment.previewKind === "audio") {
                        return `
                            <div class="attachment-card">
                                <div class="attachment-body">
                                    ${renderAttachmentMeta(attachment, "audio")}
                                    <audio class="attachment-audio" controls preload="metadata" src="${attachment.url}"></audio>
                                </div>
                            </div>
                        `;
                    }

                    if (attachment.previewKind === "video") {
                        return `
                            <div class="attachment-card">
                                <video class="attachment-media" controls preload="metadata" src="${attachment.url}"></video>
                                <div class="attachment-body">
                                    ${renderAttachmentMeta(attachment, "video")}
                                </div>
                            </div>
                        `;
                    }

                    return `
                        <div class="attachment-card">
                            <div class="attachment-body">
                                ${renderAttachmentMeta(attachment, "file")}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderAttachmentMeta(attachment, kind) {
        const downloadLabel = escapeHtml(`دانلود ${attachment.name}`);

        return `
            <div class="attachment-head">
                <div class="attachment-meta">
                    <div class="attachment-kind" aria-hidden="true">${renderIcon(kind)}</div>
                    <div>
                        <div class="attachment-title">${escapeHtml(attachment.name)}</div>
                        <div class="attachment-size">${formatSize(attachment.sizeBytes)}</div>
                    </div>
                </div>
                <div class="attachment-actions">
                    <a class="attachment-link attachment-link--ghost" href="${attachment.url}" target="_blank" rel="noopener">باز کردن</a>
                    <a class="attachment-link attachment-link--icon" href="${attachment.url}" download aria-label="${downloadLabel}" title="${downloadLabel}">
                        <span aria-hidden="true">${renderIcon("download")}</span>
                    </a>
                </div>
            </div>
        `;
    }

    function rememberRoom(room, displayName) {
        const existing = getRecentRooms();
        const previous = existing.find((item) => item.roomCode === room.code);
        const next = [
            {
                roomCode: room.code,
                roomName: String(room.name || "").trim(),
                customRoomName: String(previous?.customRoomName || "").trim(),
                displayName,
                visitedAt: new Date().toISOString(),
                isPinned: Boolean(previous?.isPinned),
            },
            ...existing.filter((item) => item.roomCode !== room.code)
        ].slice(0, 8);

        writeRecentRooms(next);
        renderRecentRooms();
    }

    function renderRecentRoomsLegacy() {
        const rooms = getRecentRooms();

        if (rooms.length === 0) {
            dom.recentRoomsList.className = "recent-rooms-list empty-state";
            dom.recentRoomsList.innerHTML = "هنوز گفتگویی ذخیره نشده است.<br>بعد از اولین ورود، اتاق‌ها اینجا ظاهر می‌شوند.";
            return;
        }

        dom.recentRoomsList.className = "recent-rooms-list";
        dom.recentRoomsList.innerHTML = rooms.map((room) => {
            const isActive = state.room?.code === room.roomCode;
            const isSelected = state.selectedRecentRooms.has(room.roomCode);
            const roomTitle = String(room.roomName || "").trim() || `اتاق ${room.roomCode}`;
            const avatar = getDisplayInitial(room.roomName || room.displayName, room.roomCode);
            return `
                <button type="button" class="recent-room${isActive ? " recent-room--active" : ""}${isSelected ? " recent-room--selected" : ""}" data-join-room="${room.roomCode}">
                    <div class="recent-room__content">
                        <div class="recent-room__avatar" aria-hidden="true">${escapeHtml(avatar)}</div>
                        <div class="recent-room__meta">
                            <strong>${escapeHtml(roomTitle)}</strong>
                            <span>کد ${escapeHtml(room.roomCode)} • ${escapeHtml(room.displayName)} • ${formatRelativeDate(room.visitedAt)}</span>
                        </div>
                    </div>
                    <div class="recent-room__tail">
                        ${room.isPinned ? '<span class="recent-room__pin" aria-hidden="true">سنجاق</span>' : ""}
                        ${isActive ? '<span class="recent-room__state">فعال</span>' : ""}
                        <span class="recent-room__arrow" aria-hidden="true">${renderIcon("enter")}</span>
                    </div>
                </button>
            `;
        }).join("");

        dom.recentRoomsList.querySelectorAll("[data-join-room]").forEach((button) => {
            button.addEventListener("click", () => {
                if (Date.now() - state.chatContextOpenedAt < 500) {
                    return;
                }

                const roomCode = button.dataset.joinRoom || "";
                const displayName = dom.displayNameInput.value.trim() || localStorage.getItem(storageKeys.displayName) || "";

                if (!displayName) {
                    openEntryDialog("join", roomCode);
                    setStatus(dom.entryStatus, "اول یک نام نمایشی وارد کنید.", true, true);
                    dom.displayNameInput.focus();
                    return;
                }

                enterRoom(displayName, roomCode, false);
            });
        });
    }

    function renderRecentRooms() {
        const rooms = getRecentRooms();
        syncRecentRoomsUiState(rooms);
        renderRecentRoomsSelectionBar();

        if (rooms.length === 0) {
            dom.recentRoomsList.className = "recent-rooms-list empty-state";
            dom.recentRoomsList.innerHTML = "هنوز گفتگویی ذخیره نشده است.<br>بعد از اولین ورود، اتاق‌ها اینجا ظاهر می‌شوند.";
            return;
        }

        dom.recentRoomsList.className = `recent-rooms-list${state.recentRoomsSelectMode ? " recent-rooms-list--select-mode" : ""}`;
        dom.recentRoomsList.innerHTML = rooms.map((room) => {
            const isActive = state.room?.code === room.roomCode;
            const isSelected = state.selectedRecentRooms.has(room.roomCode);
            const isRenaming = state.recentRoomRenameCode === room.roomCode;
            const roomTitle = getRecentRoomTitle(room);
            const avatarStyle = getAvatarPalette(room.roomCode || roomTitle || room.displayName);
            const tailAction = state.recentRoomsSelectMode
                ? `<span class="recent-room__pick${isSelected ? " recent-room__pick--selected" : ""}" aria-hidden="true">${isSelected ? renderIcon("check") : ""}</span>`
                : `<span class="recent-room__arrow" aria-hidden="true">${renderIcon("enter")}</span>`;

            if (isRenaming) {
                return `
                    <div class="recent-room recent-room--editing${isActive ? " recent-room--active" : ""}" data-recent-room-editing="${room.roomCode}">
                        <div class="recent-room__content">
                            <div class="recent-room__avatar" style="${avatarStyle}" aria-hidden="true"></div>
                            <div class="recent-room__meta recent-room__meta--editing">
                                <div class="room-name-editor recent-room__rename-editor">
                                    <input
                                        type="text"
                                        class="room-name-editor__input"
                                        data-recent-room-rename-input
                                        maxlength="80"
                                        value="${escapeHtml(state.recentRoomRenameDraft)}"
                                        placeholder="نام گفتگو">
                                    <div class="room-name-editor__actions">
                                        <button type="button" class="icon-button soft-button icon-button--sm" data-recent-room-rename-save aria-label="تایید تغییر نام گفتگو" title="تایید">
                                            ${renderIcon("check")}
                                        </button>
                                        <button type="button" class="icon-button soft-button icon-button--sm" data-recent-room-rename-cancel aria-label="لغو تغییر نام گفتگو" title="لغو">
                                            ${renderIcon("close")}
                                        </button>
                                    </div>
                                </div>
                                <span>کد ${escapeHtml(room.roomCode)} • ${escapeHtml(room.displayName)} • ${formatRelativeDate(room.visitedAt)}</span>
                            </div>
                        </div>
                        <div class="recent-room__tail">
                            ${room.isPinned ? '<span class="recent-room__pin" aria-hidden="true">سنجاق</span>' : ""}
                        </div>
                    </div>
                `;
            }

            return `
                <button
                    type="button"
                    class="recent-room${isActive ? " recent-room--active" : ""}${isSelected ? " recent-room--selected" : ""}${state.recentRoomsSelectMode ? " recent-room--selectable" : ""}"
                    data-join-room="${room.roomCode}"
                    aria-pressed="${state.recentRoomsSelectMode ? String(isSelected) : "false"}">
                    <div class="recent-room__content">
                        <div class="recent-room__avatar" style="${avatarStyle}" aria-hidden="true"></div>
                        <div class="recent-room__meta">
                            <strong>${escapeHtml(roomTitle)}</strong>
                            <span>کد ${escapeHtml(room.roomCode)} • ${escapeHtml(room.displayName)} • ${formatRelativeDate(room.visitedAt)}</span>
                        </div>
                    </div>
                    <div class="recent-room__tail">
                        ${room.isPinned ? '<span class="recent-room__pin" aria-hidden="true">سنجاق</span>' : ""}
                        ${isActive ? '<span class="recent-room__state">فعال</span>' : ""}
                        ${tailAction}
                    </div>
                </button>
            `;
        }).join("");

        dom.recentRoomsList.querySelectorAll("[data-join-room]").forEach((button) => {
            button.addEventListener("click", () => {
                if (Date.now() - state.chatContextOpenedAt < 500) {
                    return;
                }

                const roomCode = button.dataset.joinRoom || "";

                if (state.recentRoomsSelectMode) {
                    toggleRecentRoomSelection(roomCode);
                    return;
                }

                const displayName = dom.displayNameInput.value.trim() || localStorage.getItem(storageKeys.displayName) || "";

                if (!displayName) {
                    openEntryDialog("join", roomCode);
                    setStatus(dom.entryStatus, "اول یک نام نمایشی وارد کنید.", true, true);
                    dom.displayNameInput.focus();
                    return;
                }

                enterRoom(displayName, roomCode, false);
            });
        });

        const renameInput = dom.recentRoomsList.querySelector("[data-recent-room-rename-input]");
        if (renameInput) {
            renameInput.addEventListener("input", () => {
                state.recentRoomRenameDraft = renameInput.value;
            });
            renameInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submitRecentRoomRename();
                    return;
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRecentRoomRename();
                }
            });
        }

        dom.recentRoomsList.querySelector("[data-recent-room-rename-save]")?.addEventListener("click", submitRecentRoomRename);
        dom.recentRoomsList.querySelector("[data-recent-room-rename-cancel]")?.addEventListener("click", cancelRecentRoomRename);
    }

    function restoreFormState() {
        dom.displayNameInput.value = getStoredDisplayName();
        dom.roomCodeInput.value = appConfig.initialRoom || "";
        state.entryMode = dom.roomCodeInput.value ? "join" : "create";
        syncDisplayNamePrompt(!dom.displayNameInput.value.trim());
        syncRoomCodeVisibility();
        renderRecentRooms();
        renderSidebarIdentity();
        updateFileSummary();
        autoResizeTextarea();
        renderComposerState();
        updateSendAvailability();
    }

    function maybeAutoEnter() {
        const activeRoom = readJson(storageKeys.activeRoom, {});
        const roomCode = appConfig.initialRoom || activeRoom.roomCode || "";
        const displayName = getStoredDisplayName() || activeRoom.displayName || "";

        if (roomCode && displayName) {
            enterRoom(displayName, roomCode, true);
            return;
        }

        if (appConfig.initialRoom) {
            openEntryDialog("join", appConfig.initialRoom);
            return;
        }

        if (!getStoredDisplayName()) {
            openEntryDialog("create", "");
        }
    }

    function renderSelectedFilePreview(entry) {
        if (entry.previewKind === "image" && entry.previewUrl) {
            return `<img class="selected-file-chip__thumb" src="${entry.previewUrl}" alt="${escapeHtml(entry.file.name)}">`;
        }

        if (entry.previewKind === "video" && entry.previewUrl) {
            return `<video class="selected-file-chip__thumb" src="${entry.previewUrl}" muted playsinline preload="metadata"></video>`;
        }

        return `<span class="selected-file-chip__icon" aria-hidden="true">${renderIcon(entry.previewKind === "audio" ? "audio" : "file")}</span>`;
    }

    function updateFileSummary() {
        if (state.selectedFiles.length === 0) {
            dom.selectedFilesList.hidden = true;
            dom.selectedFilesList.innerHTML = "";
            updateSendAvailability();
            return;
        }

        dom.selectedFilesList.hidden = false;
        dom.selectedFilesList.innerHTML = state.selectedFiles.map((entry, index) => `
            <div class="selected-file-chip">
                <div class="selected-file-chip__preview">
                    ${renderSelectedFilePreview(entry)}
                </div>
                <div class="selected-file-chip__body">
                    <span class="selected-file-chip__name">${escapeHtml(entry.file.name)}</span>
                    <span class="selected-file-chip__meta">${formatSize(entry.file.size)}</span>
                </div>
                <button type="button" class="selected-file-chip__remove" data-remove-file="${index}" aria-label="حذف فایل">
                    ${renderIcon("close")}
                </button>
            </div>
        `).join("");

        dom.selectedFilesList.querySelectorAll("[data-remove-file]").forEach((button) => {
            button.addEventListener("click", () => {
                const index = Number(button.dataset.removeFile);

                if (Number.isNaN(index)) {
                    return;
                }

                const [removedEntry] = state.selectedFiles.splice(index, 1);
                revokeSelectedFileEntry(removedEntry);
                syncFileInput();
                updateFileSummary();
            });
        });

        updateSendAvailability();
    }

    function setComposerDragState(isActive) {
        dom.composerBox?.classList.toggle("composer-box--dragover", isActive);
        if (dom.composerDropHint) {
            dom.composerDropHint.hidden = !isActive;
        }
    }

    function extractDroppedFiles(dataTransfer) {
        if (!dataTransfer) {
            return [];
        }

        return Array.from(dataTransfer.files || []).filter((file) => file instanceof File);
    }

    function handleDroppedFiles(files) {
        if (!state.room || files.length === 0 || state.uploadActive || state.editingMessageId) {
            return;
        }

        replaceSelectedFiles(files);
        setStatus(dom.chatStatus, `${files.length} فایل آماده ارسال شد.`, false, false);
    }

    function renderComposerState() {
        const isEditing = Boolean(state.editingMessageId);
        const replyMessage = state.replyingMessageId ? state.messages.get(state.replyingMessageId) : null;
        dom.editModeBanner.hidden = !isEditing;
        dom.replyModeBanner.hidden = !replyMessage || isEditing;
        dom.fileInput.disabled = isEditing || state.uploadActive;
        dom.messageInput.disabled = state.uploadActive;
        dom.composerBox?.classList.toggle("composer-box--disabled", state.uploadActive);
        if (replyMessage) {
            dom.replyModeTitle.textContent = `پاسخ به ${replyMessage.senderName || "پیام"}`;
            dom.replyModeText.textContent = summarizeReplyTarget(replyMessage);
        }
        dom.editModeText.textContent = isEditing
            ? "در این حالت فقط متن پیام به‌روزرسانی می‌شود."
            : "متن پیام را اصلاح کنید.";
        dom.messageInput.placeholder = isEditing ? "ویرایش پیام..." : "پیام بنویسید";
        dom.sendButton.setAttribute("aria-label", isEditing ? "ثبت ویرایش پیام" : "ارسال پیام");
        dom.sendButton.setAttribute("title", isEditing ? "ثبت ویرایش پیام" : "ارسال پیام");
        dom.cancelEditButton.disabled = state.uploadActive;
        updateSendAvailability();
    }

    function autoResizeTextarea() {
        dom.messageInput.style.height = "42px";
        dom.messageInput.style.height = `${Math.min(dom.messageInput.scrollHeight, 160)}px`;
        updateSendAvailability();
    }

    function handleComposerKeydown(event) {
        if (event.key !== "Enter" || event.shiftKey) {
            return;
        }

        event.preventDefault();

        if (dom.sendButton.disabled) {
            return;
        }

        dom.composerForm.requestSubmit();
    }

    function resetComposer() {
        dom.composerForm.reset();
        state.editingMessageId = null;
        state.replyingMessageId = null;
        clearSelectedFiles();
        state.dragDepth = 0;
        setComposerDragState(false);
        syncFileInput();
        updateFileSummary();
        renderComposerState();
        autoResizeTextarea();
    }

    function leaveRoom(clearActive) {
        window.clearTimeout(state.pollTimer);
        state.room = null;
        state.participant = null;
        state.presence = null;
        state.syncCursor = null;
        state.messages.clear();
        state.editingMessageId = null;
        state.newMessagesCount = 0;
        state.roomNameEditing = false;
        state.roomNameSaving = false;
        finishUploadProgress();
        state.dragDepth = 0;
        setComposerDragState(false);

        if (clearActive) {
            localStorage.removeItem(storageKeys.activeRoom);
            history.replaceState({}, "", apiPath("/"));
        }

        dom.messagesList.innerHTML = "";
        resetComposer();
        setStatus(dom.chatStatus, "", false, false);
        renderShell();
    }

    function isScrolledNearBottom(element) {
        return element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    }

    function renderJumpToLatest() {
        const visible = state.newMessagesCount > 0 && !isScrolledNearBottom(dom.messagesList);
        dom.jumpToLatestButton.hidden = !visible;
        dom.jumpToLatestCount.textContent = String(state.newMessagesCount);
    }

    function scrollToLatest() {
        dom.messagesList.scrollTop = dom.messagesList.scrollHeight;
        state.newMessagesCount = 0;
        renderJumpToLatest();
    }

    function renderIcon(name) {
        const icons = {
            close: '<svg viewBox="0 0 24 24" focusable="false"><path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z"/></svg>',
            check: '<svg viewBox="0 0 24 24" focusable="false"><path d="M18.28 7.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L5.72 11.28a.75.75 0 1 1 1.06-1.06l3.72 3.72 6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>',
            edit: '<svg viewBox="0 0 24 24" focusable="false"><path d="M15.12 4.47a2.25 2.25 0 0 1 3.18 3.18L9.56 16.39l-3.98.8.8-3.98 8.74-8.74Zm1.06 1.06-8.39 8.39-.37 1.83 1.83-.37 8.39-8.39a.75.75 0 1 0-1.06-1.06Z"/></svg>',
            trash: '<svg viewBox="0 0 24 24" focusable="false"><path d="M9.75 3.5h4.5c.83 0 1.5.67 1.5 1.5V6h3a.75.75 0 0 1 0 1.5h-.72l-.63 10.07A2.5 2.5 0 0 1 14.91 20H9.09a2.5 2.5 0 0 1-2.49-2.43L5.97 7.5H5.25a.75.75 0 0 1 0-1.5h3V5c0-.83.67-1.5 1.5-1.5Zm4.5 2.5V5h-4.5v1h4.5ZM9.5 9.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Zm5 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Z"/></svg>',
            download: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 4.75a.75.75 0 0 1 .75.75v7.69l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 1 1 1.06-1.06l2.47 2.47V5.5A.75.75 0 0 1 12 4.75Zm-5 11.5a.75.75 0 0 1 .75.75v.25c0 .14.11.25.25.25h8a.25.25 0 0 0 .25-.25V17a.75.75 0 0 1 1.5 0v.25A1.75 1.75 0 0 1 16 19h-8a1.75 1.75 0 0 1-1.75-1.75V17a.75.75 0 0 1 .75-.75Z"/></svg>',
            image: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.75 4A2.75 2.75 0 0 0 3 6.75v10.5A2.75 2.75 0 0 0 5.75 20h12.5A2.75 2.75 0 0 0 21 17.25V6.75A2.75 2.75 0 0 0 18.25 4H5.75Zm0 1.5h12.5c.69 0 1.25.56 1.25 1.25v6.17l-3.13-3.12a1.75 1.75 0 0 0-2.47 0l-1.15 1.15-2.45-2.45a1.75 1.75 0 0 0-2.47 0L4.5 13.83V6.75c0-.69.56-1.25 1.25-1.25Zm1.9 2.4a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Zm-3.15 8.05 4.4-4.4a.25.25 0 0 1 .36 0l5 5H5.75a1.25 1.25 0 0 1-1.25-1.25v-.35Zm13.75 1.6h-1.88l-2.56-2.56 1.15-1.15a.25.25 0 0 1 .35 0l3.19 3.18a1.24 1.24 0 0 1-.25.53Z"/></svg>',
            audio: '<svg viewBox="0 0 24 24" focusable="false"><path d="M14 4.75a.75.75 0 0 1 1.28-.53l3.47 3.48a.75.75 0 0 1 0 1.06l-3.47 3.47A.75.75 0 0 1 14 11.7V9.75H9.25a2.75 2.75 0 1 0 0 5.5H10a.75.75 0 0 1 0 1.5h-.75a4.25 4.25 0 1 1 0-8.5H14v-3.5Z"/></svg>',
            video: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.75 5A2.75 2.75 0 0 0 3 7.75v8.5A2.75 2.75 0 0 0 5.75 19h7.5A2.75 2.75 0 0 0 16 16.25V14.8l3.07 2a1.25 1.25 0 0 0 1.93-1.05V8.25A1.25 1.25 0 0 0 19.07 7.2L16 9.2V7.75A2.75 2.75 0 0 0 13.25 5h-7.5Zm0 1.5h7.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-7.5c-.69 0-1.25-.56-1.25-1.25v-8.5c0-.69.56-1.25 1.25-1.25Zm11.75 4.48 2-1.31v4.66l-2-1.3v-2.05Z"/></svg>',
            file: '<svg viewBox="0 0 24 24" focusable="false"><path d="M7.75 3.5A2.75 2.75 0 0 0 5 6.25v11.5a2.75 2.75 0 0 0 2.75 2.75h8.5A2.75 2.75 0 0 0 19 17.75V9.56a2.75 2.75 0 0 0-.8-1.94l-2.82-2.82a2.75 2.75 0 0 0-1.95-.8h-5.68Zm0 1.5h5.18v3.25c0 1.1.9 2 2 2H17.5v7.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25V6.25c0-.69.56-1.25 1.25-1.25Zm1.5 7a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Zm5.18-9.69 2.76 2.75h-2.26a.5.5 0 0 1-.5-.5V5.31Z"/></svg>',
            pin: '<svg viewBox="0 0 24 24" focusable="false"><path d="M14.78 4.72a.75.75 0 0 1 1.06 0l3.44 3.44a.75.75 0 0 1 0 1.06l-1.97 1.97v2.27a.75.75 0 0 1-.22.53l-2.5 2.5a.75.75 0 0 1-.53.22h-1.77l-4.76 4.76a.75.75 0 0 1-1.06-1.06l4.76-4.76V13.9a.75.75 0 0 1 .22-.53l2.5-2.5a.75.75 0 0 1 .53-.22h2.27l1.97-1.97a.75.75 0 0 1 1.06 0ZM14.8 12.15h-1.76l-2.06 2.06v1.76l5.81-5.81V8.4l-2 2a.75.75 0 0 1-.53.22Z"/></svg>',
            enter: '<svg viewBox="0 0 24 24" focusable="false"><path d="M8.47 4.97a.75.75 0 0 1 1.06 0l6.5 6.5a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 1 1-1.06-1.06L14.44 12 8.47 6.03a.75.75 0 0 1 0-1.06Z"/></svg>'
        };

        return icons[name] || icons.file;
    }

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator) || !appConfig.assets?.serviceWorker) {
            return;
        }

        window.addEventListener("load", () => {
            navigator.serviceWorker.register(appConfig.assets.serviceWorker, {
                scope: `${appConfig.basePath || ""}/`
            }).catch(() => {
                // Keep startup resilient even if service worker registration fails.
            });
        });
    }

    document.addEventListener("visibilitychange", () => {
        if (state.room) {
            schedulePolling(document.visibilityState === "visible" ? "reconnect" : "normal");
        }
    });

    window.addEventListener("online", () => {
        setOnlineState(true);

        if (state.room) {
            schedulePolling("reconnect");
        }
    });

    window.addEventListener("offline", () => {
        setOnlineState(false);
    });

    dom.openEntryButton.addEventListener("click", () => openEntryDialog("create", ""));
    dom.sidebarIdentityDisplay.addEventListener("click", startIdentityEdit);
    dom.welcomeNewChatButton.addEventListener("click", () => openEntryDialog("create", ""));
    dom.welcomeJoinButton.addEventListener("click", () => openEntryDialog("join", ""));
    dom.closeEntryDialogButton.addEventListener("click", closeEntryDialog);
    dom.entryDialog.addEventListener("close", () => {
        setStatus(dom.entryStatus, "", false, false);
    });

    dom.enterForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const displayName = dom.displayNameInput.value.trim() || getStoredDisplayName();
        const roomCode = dom.roomCodeInput.value.trim();
        if (!displayName) {
            syncDisplayNamePrompt(true);
            setStatus(dom.entryStatus, "اول یک نام نمایشی وارد کنید.", true, true);
            dom.displayNameInput.focus();
            return;
        }

        if (roomCode && roomCode.length !== 4) {
            setStatus(dom.entryStatus, "برای ورود، کد ۴ رقمی اتاق را کامل وارد کنید.", true, true);
            dom.roomCodeInput.focus();
            return;
        }

        enterRoom(displayName, roomCode, false);
    });

    dom.displayNameInput.addEventListener("input", () => {
        renderSidebarIdentity();
    });

    dom.sidebarIdentityInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitIdentityEdit();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            cancelIdentityEdit();
        }
    });
    dom.sidebarIdentitySaveButton.addEventListener("click", submitIdentityEdit);
    dom.sidebarIdentityCancelButton.addEventListener("click", cancelIdentityEdit);

    dom.toggleRoomCodeButton.addEventListener("click", () => {
        const nextVisible = dom.roomCodeGroup.hidden;
        state.entryCodeExpanded = nextVisible;

        if (!nextVisible) {
            dom.roomCodeInput.value = "";
            state.entryMode = "create";
        }

        syncRoomCodeVisibility();

        if (nextVisible) {
            dom.roomCodeInput.focus();
            return;
        }

        dom.displayNameInput.focus();
    });

    dom.roomCodeInput.addEventListener("input", () => {
        dom.roomCodeInput.value = dom.roomCodeInput.value.replace(/\D+/g, "").slice(0, 4);
        state.entryCodeExpanded = true;
        state.entryMode = dom.roomCodeInput.value ? "join" : "create";
        syncRoomCodeVisibility();
    });

    dom.composerForm.addEventListener("submit", sendMessage);
    dom.messageInput.addEventListener("input", autoResizeTextarea);
    dom.messageInput.addEventListener("keydown", handleComposerKeydown);
    dom.fileInput.addEventListener("change", () => {
        replaceSelectedFiles(Array.from(dom.fileInput.files || []));
    });
    dom.cancelEditButton.addEventListener("click", () => {
        exitEditMode();
        resetComposer();
    });
    dom.cancelReplyButton.addEventListener("click", exitReplyMode);

    dom.clearRecentRoomsButton?.addEventListener("click", async () => {
        const confirmed = await confirmAction({
            title: "پاک کردن لیست اخیر",
            text: "تمام میانبرهای ذخیره‌شده از این مرورگر حذف می‌شوند.",
            acceptLabel: "پاک کردن"
        });

        if (!confirmed) {
            return;
        }

        localStorage.removeItem(storageKeys.recentRooms);
        renderRecentRooms();
    });
    dom.recentRoomsDeleteButton?.addEventListener("click", deleteSelectedRecentRooms);
    dom.recentRoomsCancelSelectionButton?.addEventListener("click", exitRecentRoomsSelectMode);

    dom.leaveRoomButton.addEventListener("click", () => leaveRoom(true));
    dom.roomNameDisplay.addEventListener("click", startRoomNameEdit);
    dom.roomNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitRoomNameEdit();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            cancelRoomNameEdit();
        }
    });
    dom.roomNameSaveButton.addEventListener("click", submitRoomNameEdit);
    dom.roomNameCancelButton.addEventListener("click", cancelRoomNameEdit);
    dom.copyRoomCodeButton.addEventListener("click", async () => {
        if (!state.room) {
            return;
        }

        try {
            await navigator.clipboard.writeText(window.location.origin + roomPath(state.room.code));
            setStatus(dom.chatStatus, "لینک اتاق کپی شد.", false, false);
        } catch (error) {
            setStatus(dom.chatStatus, "کپی خودکار انجام نشد. لینک را دستی کپی کنید.", true, true);
        }
    });

    dom.jumpToLatestButton.addEventListener("click", scrollToLatest);

    dom.composerBox?.addEventListener("dragenter", (event) => {
        event.preventDefault();
        if (!state.room || state.uploadActive) {
            return;
        }

        state.dragDepth += 1;
        setComposerDragState(true);
    });

    dom.composerBox?.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (!state.room || state.uploadActive) {
            return;
        }

        setComposerDragState(true);
    });

    ["dragleave", "dragend"].forEach((eventName) => {
        dom.composerBox?.addEventListener(eventName, (event) => {
            event.preventDefault();
            state.dragDepth = Math.max(0, state.dragDepth - 1);

            if (state.dragDepth === 0) {
                setComposerDragState(false);
            }
        });
    });

    dom.composerBox?.addEventListener("drop", (event) => {
        event.preventDefault();
        state.dragDepth = 0;
        setComposerDragState(false);
        handleDroppedFiles(extractDroppedFiles(event.dataTransfer));
    });

    ["dragover", "drop"].forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
            if (extractDroppedFiles(event.dataTransfer).length > 0) {
                event.preventDefault();
            }
        });
    });

    dom.messagesList.addEventListener("scroll", () => {
        if (isScrolledNearBottom(dom.messagesList)) {
            state.newMessagesCount = 0;
            renderJumpToLatest();
        }
    });

    dom.messagesList.addEventListener("contextmenu", (event) => {
        const replyPreview = event.target.closest("[data-jump-message]");

        if (replyPreview) {
            return;
        }

        const bubble = event.target.closest(".message-bubble");

        if (!bubble) {
            return;
        }

        event.preventDefault();
        const target = getContextTargetFromBubble(bubble);

        if (target) {
            showMessageContextMenu(target.messageId, target.isOwn, event.clientX, event.clientY);
        }
    });

    dom.messagesList.addEventListener("pointerdown", (event) => {
        const replyPreview = event.target.closest("[data-jump-message]");

        if (replyPreview) {
            return;
        }

        const bubble = event.target.closest(".message-bubble");

        if (!bubble) {
            return;
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        window.clearTimeout(state.longPressTimer);
        state.longPressTimer = window.setTimeout(() => {
            const target = getContextTargetFromBubble(bubble);

            if (target) {
                showMessageContextMenu(target.messageId, target.isOwn, event.clientX, event.clientY);
            }
        }, 450);
    });

    ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((eventName) => {
        dom.messagesList.addEventListener(eventName, () => {
            window.clearTimeout(state.longPressTimer);
        });
    });

    dom.messagesList.addEventListener("click", (event) => {
        const replyPreview = event.target.closest("[data-jump-message]");

        if (!replyPreview) {
            return;
        }

        const targetId = Number(replyPreview.dataset.jumpMessage || 0);
        const targetBubble = targetId ? dom.messagesList.querySelector(`[data-message-id="${targetId}"]`) : null;

        if (!targetBubble) {
            return;
        }

        targetBubble.scrollIntoView({ behavior: "smooth", block: "center" });
        targetBubble.classList.add("message-bubble--highlight");
        window.setTimeout(() => targetBubble.classList.remove("message-bubble--highlight"), 1200);
    });

    dom.recentRoomsList.addEventListener("contextmenu", (event) => {
        const roomButton = event.target.closest("[data-join-room]");

        if (!roomButton) {
            return;
        }

        event.preventDefault();
        showChatContextMenu(roomButton.dataset.joinRoom || "", event.clientX, event.clientY);
    });

    dom.recentRoomsList.addEventListener("pointerdown", (event) => {
        const roomButton = event.target.closest("[data-join-room]");

        if (!roomButton) {
            return;
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        window.clearTimeout(state.recentLongPressTimer);
        state.recentLongPressTimer = window.setTimeout(() => {
            showChatContextMenu(roomButton.dataset.joinRoom || "", event.clientX, event.clientY);
        }, 450);
    });

    ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((eventName) => {
        dom.recentRoomsList.addEventListener(eventName, () => {
            window.clearTimeout(state.recentLongPressTimer);
        });
    });

    dom.contextReplyButton.addEventListener("click", () => {
        const messageId = state.contextMessageId;
        hideMessageContextMenu();

        if (messageId) {
            enterReplyMode(messageId);
        }
    });

    dom.contextCopyButton.addEventListener("click", async () => {
        const messageId = state.contextMessageId;
        hideMessageContextMenu();

        if (messageId) {
            await copyMessageText(messageId);
        }
    });

    dom.contextEditButton.addEventListener("click", () => {
        const messageId = state.contextMessageId;
        hideMessageContextMenu();

        if (messageId) {
            enterEditMode(messageId);
        }
    });

    dom.contextDeleteButton.addEventListener("click", async () => {
        const messageId = state.contextMessageId;
        hideMessageContextMenu();

        if (messageId) {
            await deleteMessage(messageId);
        }
    });

    dom.chatContextPinButton.addEventListener("click", () => {
        const roomCode = state.chatContextRoomCode;
        hideChatContextMenu();

        if (roomCode) {
            toggleRecentRoomPin(roomCode);
        }
    });

    dom.chatContextSelectButton.addEventListener("click", () => {
        const roomCode = state.chatContextRoomCode;
        hideChatContextMenu();

        if (roomCode) {
            toggleRecentRoomSelection(roomCode);
        }
    });

    dom.chatContextRenameButton.addEventListener("click", () => {
        const roomCode = state.chatContextRoomCode;
        hideChatContextMenu();

        if (roomCode) {
            startRecentRoomRename(roomCode);
        }
    });

    dom.chatContextCopyLinkButton.addEventListener("click", async () => {
        const roomCode = state.chatContextRoomCode;
        hideChatContextMenu();

        if (roomCode) {
            await copyRoomLink(roomCode);
        }
    });

    dom.chatContextDeleteButton.addEventListener("click", async () => {
        const roomCode = state.chatContextRoomCode;
        hideChatContextMenu();

        if (roomCode) {
            await deleteRecentRoomShortcut(roomCode);
        }
    });

    document.addEventListener("click", (event) => {
        if (!dom.messageContextMenu.hidden && !dom.messageContextMenu.contains(event.target)) {
            hideMessageContextMenu();
        }

        if (!dom.chatContextMenu.hidden && !dom.chatContextMenu.contains(event.target)) {
            hideChatContextMenu();
        }
    });

    window.addEventListener("scroll", () => {
        hideMessageContextMenu();
        hideChatContextMenu();
    }, true);
    window.addEventListener("resize", () => {
        hideMessageContextMenu();
        hideChatContextMenu();
    });

    restoreFormState();
    maybeAutoEnter();
    renderShell();
    registerServiceWorker();
})();

