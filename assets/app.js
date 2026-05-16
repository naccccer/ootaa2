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
        statusTimer: null,
        contextMessageId: null,
        longPressTimer: null,
        selectedFiles: [],
        uploadXhr: null,
        uploadProgress: 0,
        uploadActive: false,
        newMessagesCount: 0,
        lastPollError: "",
        isOnline: navigator.onLine
    };

    const dom = {
        entryPanel: document.getElementById("entryPanel"),
        enterForm: document.getElementById("enterForm"),
        displayNameInput: document.getElementById("displayNameInput"),
        roomCodeInput: document.getElementById("roomCodeInput"),
        enterButton: document.getElementById("enterButton"),
        entryStatus: document.getElementById("entryStatus"),
        recentRoomsList: document.getElementById("recentRoomsList"),
        clearRecentRoomsButton: document.getElementById("clearRecentRoomsButton"),
        chatView: document.getElementById("chatView"),
        roomCodeBadge: document.getElementById("roomCodeBadge"),
        roomSubtitleText: document.getElementById("roomSubtitleText"),
        copyRoomCodeButton: document.getElementById("copyRoomCodeButton"),
        leaveRoomButton: document.getElementById("leaveRoomButton"),
        messagesList: document.getElementById("messagesList"),
        jumpToLatestButton: document.getElementById("jumpToLatestButton"),
        jumpToLatestCount: document.getElementById("jumpToLatestCount"),
        composerForm: document.getElementById("composerForm"),
        editModeBanner: document.getElementById("editModeBanner"),
        editModeText: document.getElementById("editModeText"),
        cancelEditButton: document.getElementById("cancelEditButton"),
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
        contextCopyButton: document.getElementById("contextCopyButton"),
        contextEditButton: document.getElementById("contextEditButton"),
        contextDeleteButton: document.getElementById("contextDeleteButton")
    };

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

    function syncFileInput() {
        const transfer = new DataTransfer();
        state.selectedFiles.forEach((file) => transfer.items.add(file));
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

            localStorage.setItem(storageKeys.displayName, displayName);
            writeJson(storageKeys.activeRoom, {
                roomCode: data.room.code,
                displayName
            });
            rememberRoom(data.room.code, displayName);
            history.replaceState({}, "", roomPath(data.room.code));
            dom.displayNameInput.value = displayName;
            dom.roomCodeInput.value = data.room.code;

            renderShell();
            renderLoadingMessages();
            await bootstrapRoom();
            setStatus(dom.entryStatus, "", false, false);
        } catch (error) {
            if (isAutomatic) {
                localStorage.removeItem(storageKeys.activeRoom);
            }

            setStatus(dom.entryStatus, error.message, true, true);
            leaveRoom(false);
        } finally {
            setBusy(dom.enterButton, false);
        }
    }

    function applyRoomPayload(data) {
        state.room = data.room || state.room;
        state.participant = data.participant || state.participant;
        state.presence = data.presence || state.presence;
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

    function summarizePresence() {
        if (!state.presence || state.presence.onlineCount <= 0) {
            return "فعلا کسی آنلاین نیست";
        }

        const names = Array.isArray(state.presence.participants) ? state.presence.participants : [];
        const extraCount = Math.max(0, state.presence.onlineCount - names.length);
        const namesText = names.join("، ");
        const suffix = extraCount > 0 ? ` +${extraCount}` : "";
        return `${state.presence.onlineCount} نفر آنلاین${namesText ? `: ${namesText}${suffix}` : ""}`;
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

        let delay;

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

        state.pollTimer = window.setTimeout(pollMessages, delay);
    }

    async function sendMessage(event) {
        event.preventDefault();

        if (!state.room) {
            return;
        }

        const text = dom.messageInput.value.trim();
        const files = [...state.selectedFiles];

        if (!text && files.length === 0 && !state.editingMessageId) {
            setStatus(dom.chatStatus, "یک پیام یا حداقل یک فایل انتخاب کنید.", true, true);
            updateSendAvailability();
            return;
        }

        setBusy(dom.sendButton, true);

        try {
            if (state.editingMessageId) {
                const data = await fetchJson(apiPath(`/api/messages/${state.editingMessageId}`), {
                    method: "PATCH",
                    body: JSON.stringify({ text })
                });

                state.messages.set(data.message.id, data.message);
                state.syncCursor = data.message.updatedAt;
                state.presence = data.presence || state.presence;
                resetComposer();
                renderShell();
                renderMessages(false, 0);
                setStatus(dom.chatStatus, "پیام ویرایش شد.", false, false);
                schedulePolling("fast");
                return;
            }

            const formData = new FormData();
            formData.append("roomCode", state.room.code);
            formData.append("text", dom.messageInput.value);

            files.forEach((file) => {
                formData.append("files[]", file);
            });

            beginUploadProgress();
            setStatus(dom.chatStatus, "در حال ارسال پیام...", false, true);

            const data = await sendMultipartWithProgress(apiPath("/api/room/messages"), formData, (progress) => {
                setUploadProgress(progress, "در حال بارگذاری فایل...");
            });

            state.messages.set(data.message.id, data.message);
            state.syncCursor = data.message.updatedAt;
            state.room = data.room;
            state.presence = data.presence || state.presence;
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
        dom.messageInput.value = current.bodyText || "";
        state.selectedFiles = [];
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

            state.messages.set(data.message.id, data.message);
            state.syncCursor = data.message.updatedAt;
            state.presence = data.presence || state.presence;

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

    function showMessageContextMenu(messageId, isOwn, x, y) {
        state.contextMessageId = messageId;
        dom.contextEditButton.hidden = !isOwn;
        dom.contextDeleteButton.hidden = !isOwn;
        dom.messageContextMenu.hidden = false;

        const menuWidth = 170;
        const menuHeight = isOwn ? 138 : 54;
        const left = Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12));
        const top = Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12));

        dom.messageContextMenu.style.left = `${left}px`;
        dom.messageContextMenu.style.top = `${top}px`;
    }

    function bindMessageContextTriggers() {
        dom.messagesList.querySelectorAll(".message-bubble").forEach((bubble) => {
            const openMenu = (x, y) => {
                const target = getContextTargetFromBubble(bubble);

                if (target) {
                    showMessageContextMenu(target.messageId, target.isOwn, x, y);
                }
            };

            bubble.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                openMenu(event.clientX, event.clientY);
            });

            bubble.addEventListener("pointerdown", (event) => {
                if (event.pointerType === "mouse" && event.button !== 0) {
                    return;
                }

                window.clearTimeout(state.longPressTimer);
                state.longPressTimer = window.setTimeout(() => {
                    openMenu(event.clientX, event.clientY);
                }, 450);
            });

            ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach((eventName) => {
                bubble.addEventListener(eventName, () => {
                    window.clearTimeout(state.longPressTimer);
                });
            });
        });
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
        dom.entryPanel.hidden = isInRoom;
        dom.chatView.hidden = !isInRoom;
        document.body.classList.remove("app-loading");

        if (!isInRoom) {
            return;
        }

        dom.roomCodeBadge.textContent = state.room.code;
        dom.roomSubtitleText.textContent = `${state.participant.displayName} • ${summarizePresence()} • اعتبار اتاق تا ${formatDate(state.room.expiresAt)}`;
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

        dom.messagesList.innerHTML = items.map(renderMessageCard).join("");
        bindMessageContextTriggers();

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
        const deletedClass = message.isDeleted ? " deleted" : "";
        const hasAttachments = !message.isDeleted && (message.attachments || []).length > 0;
        const body = message.isDeleted
            ? '<div class="message-text message-deleted-copy">این پیام حذف شده است.</div>'
            : (message.bodyText
                ? `<div class="message-text">${escapeHtml(message.bodyText)}</div>`
                : '<div class="message-text message-empty-copy">فقط فایل ارسال شده است.</div>');
        const editedText = message.isEdited && !message.isDeleted ? '<span class="message-edited">ویرایش‌شده</span>' : "<span></span>";
        const actions = message.isOwn && !message.isDeleted
            ? `
                <div class="message-actions">
                    <button type="button" class="message-action" data-action="edit" data-message-id="${message.id}" aria-label="ویرایش پیام" title="ویرایش پیام">
                        ${renderIcon("edit")}
                    </button>
                    <button type="button" class="message-action message-action--danger" data-action="delete" data-message-id="${message.id}" aria-label="حذف پیام" title="حذف پیام">
                        ${renderIcon("trash")}
                    </button>
                </div>
            `
            : "";

        return `
            <article class="message-row ${rowClass}${deletedClass}">
                <div class="message-bubble${hasAttachments ? " has-attachments" : ""}" data-message-id="${message.id}" data-message-own="${message.isOwn ? "1" : "0"}">
                    <div class="message-head">
                        <div class="message-author">${escapeHtml(message.senderName)}</div>
                        <div class="message-time">${formatTime(message.createdAt)}</div>
                    </div>
                    ${body}
                    ${message.isDeleted ? "" : renderAttachments(message.attachments || [])}
                    <div class="message-foot">
                        ${editedText}
                        ${actions}
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
        return `
            <div class="attachment-head">
                <div class="attachment-meta">
                    <div class="attachment-kind" aria-hidden="true">${renderIcon(kind)}</div>
                    <div>
                        <div class="attachment-title">${escapeHtml(attachment.name)}</div>
                        <div class="attachment-size">${formatSize(attachment.sizeBytes)}</div>
                    </div>
                </div>
                <a class="attachment-link" href="${attachment.url}" download>دانلود</a>
            </div>
        `;
    }

    function rememberRoom(roomCode, displayName) {
        const existing = readJson(storageKeys.recentRooms, []);
        const next = [
            { roomCode, displayName, visitedAt: new Date().toISOString() },
            ...existing.filter((item) => item.roomCode !== roomCode)
        ].slice(0, 6);

        writeJson(storageKeys.recentRooms, next);
        renderRecentRooms();
    }

    function renderRecentRooms() {
        const rooms = readJson(storageKeys.recentRooms, []);

        if (rooms.length === 0) {
            dom.recentRoomsList.className = "recent-rooms-list empty-state";
            dom.recentRoomsList.innerHTML = "هنوز اتاقی ذخیره نشده است.<br>بعد از اولین گفتگو، اینجا راه میانبر خواهید داشت.";
            return;
        }

        dom.recentRoomsList.className = "recent-rooms-list";
        dom.recentRoomsList.innerHTML = rooms.map((room) => `
            <button type="button" class="recent-room" data-join-room="${room.roomCode}">
                <div class="recent-room__content">
                    <div class="recent-room__icon" aria-hidden="true">${renderIcon("chat")}</div>
                    <div class="recent-room__meta">
                        <strong>اتاق ${escapeHtml(room.roomCode)}</strong>
                        <span>${escapeHtml(room.displayName)} • ${formatRelativeDate(room.visitedAt)}</span>
                    </div>
                </div>
                <div class="recent-room__actions">
                    <span class="icon-button soft-button" aria-hidden="true">${renderIcon("enter")}</span>
                </div>
            </button>
        `).join("");

        dom.recentRoomsList.querySelectorAll("[data-join-room]").forEach((button) => {
            button.addEventListener("click", () => {
                const displayName = dom.displayNameInput.value.trim() || localStorage.getItem(storageKeys.displayName) || "";

                if (!displayName) {
                    setStatus(dom.entryStatus, "اول یک نام نمایشی وارد کنید.", true, true);
                    dom.displayNameInput.focus();
                    return;
                }

                enterRoom(displayName, button.dataset.joinRoom, false);
            });
        });
    }

    function restoreFormState() {
        dom.displayNameInput.value = localStorage.getItem(storageKeys.displayName) || "";
        dom.roomCodeInput.value = appConfig.initialRoom || "";
        renderRecentRooms();
        updateFileSummary();
        autoResizeTextarea();
        renderComposerState();
        updateSendAvailability();
    }

    function maybeAutoEnter() {
        const activeRoom = readJson(storageKeys.activeRoom, {});
        const roomCode = appConfig.initialRoom || activeRoom.roomCode || "";
        const displayName = localStorage.getItem(storageKeys.displayName) || activeRoom.displayName || "";

        if (roomCode && displayName) {
            enterRoom(displayName, roomCode, true);
        }
    }

    function updateFileSummary() {
        if (state.selectedFiles.length === 0) {
            dom.selectedFilesList.hidden = true;
            dom.selectedFilesList.innerHTML = "";
            updateSendAvailability();
            return;
        }

        dom.selectedFilesList.hidden = false;
        dom.selectedFilesList.innerHTML = state.selectedFiles.map((file, index) => `
            <div class="selected-file-chip">
                <span aria-hidden="true">${renderIcon("file")}</span>
                <span class="selected-file-chip__name">${escapeHtml(file.name)}</span>
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

                state.selectedFiles.splice(index, 1);
                syncFileInput();
                updateFileSummary();
            });
        });

        updateSendAvailability();
    }

    function renderComposerState() {
        const isEditing = Boolean(state.editingMessageId);
        dom.editModeBanner.hidden = !isEditing;
        dom.fileInput.disabled = isEditing || state.uploadActive;
        dom.messageInput.disabled = state.uploadActive;
        dom.editModeText.textContent = isEditing
            ? "در این حالت فقط متن پیام به‌روزرسانی می‌شود."
            : "متن پیام را اصلاح کنید.";
        dom.sendButton.setAttribute("aria-label", isEditing ? "ثبت ویرایش پیام" : "ارسال پیام");
        dom.sendButton.setAttribute("title", isEditing ? "ثبت ویرایش پیام" : "ارسال پیام");
        dom.cancelEditButton.disabled = state.uploadActive;
        updateSendAvailability();
    }

    function autoResizeTextarea() {
        dom.messageInput.style.height = "40px";
        dom.messageInput.style.height = `${Math.min(dom.messageInput.scrollHeight, 132)}px`;
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
        state.selectedFiles = [];
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
        finishUploadProgress();

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
            edit: '<svg viewBox="0 0 24 24" focusable="false"><path d="M15.12 4.47a2.25 2.25 0 0 1 3.18 3.18L9.56 16.39l-3.98.8.8-3.98 8.74-8.74Zm1.06 1.06-8.39 8.39-.37 1.83 1.83-.37 8.39-8.39a.75.75 0 1 0-1.06-1.06Z"/></svg>',
            trash: '<svg viewBox="0 0 24 24" focusable="false"><path d="M9.75 3.5h4.5c.83 0 1.5.67 1.5 1.5V6h3a.75.75 0 0 1 0 1.5h-.72l-.63 10.07A2.5 2.5 0 0 1 14.91 20H9.09a2.5 2.5 0 0 1-2.49-2.43L5.97 7.5H5.25a.75.75 0 0 1 0-1.5h3V5c0-.83.67-1.5 1.5-1.5Zm4.5 2.5V5h-4.5v1h4.5ZM9.5 9.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Zm5 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Z"/></svg>',
            image: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.75 4A2.75 2.75 0 0 0 3 6.75v10.5A2.75 2.75 0 0 0 5.75 20h12.5A2.75 2.75 0 0 0 21 17.25V6.75A2.75 2.75 0 0 0 18.25 4H5.75Zm0 1.5h12.5c.69 0 1.25.56 1.25 1.25v6.17l-3.13-3.12a1.75 1.75 0 0 0-2.47 0l-1.15 1.15-2.45-2.45a1.75 1.75 0 0 0-2.47 0L4.5 13.83V6.75c0-.69.56-1.25 1.25-1.25Zm1.9 2.4a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Zm-3.15 8.05 4.4-4.4a.25.25 0 0 1 .36 0l5 5H5.75a1.25 1.25 0 0 1-1.25-1.25v-.35Zm13.75 1.6h-1.88l-2.56-2.56 1.15-1.15a.25.25 0 0 1 .35 0l3.19 3.18a1.24 1.24 0 0 1-.25.53Z"/></svg>',
            audio: '<svg viewBox="0 0 24 24" focusable="false"><path d="M14 4.75a.75.75 0 0 1 1.28-.53l3.47 3.48a.75.75 0 0 1 0 1.06l-3.47 3.47A.75.75 0 0 1 14 11.7V9.75H9.25a2.75 2.75 0 1 0 0 5.5H10a.75.75 0 0 1 0 1.5h-.75a4.25 4.25 0 1 1 0-8.5H14v-3.5Z"/></svg>',
            video: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.75 5A2.75 2.75 0 0 0 3 7.75v8.5A2.75 2.75 0 0 0 5.75 19h7.5A2.75 2.75 0 0 0 16 16.25V14.8l3.07 2a1.25 1.25 0 0 0 1.93-1.05V8.25A1.25 1.25 0 0 0 19.07 7.2L16 9.2V7.75A2.75 2.75 0 0 0 13.25 5h-7.5Zm0 1.5h7.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-7.5c-.69 0-1.25-.56-1.25-1.25v-8.5c0-.69.56-1.25 1.25-1.25Zm11.75 4.48 2-1.31v4.66l-2-1.3v-2.05Z"/></svg>',
            file: '<svg viewBox="0 0 24 24" focusable="false"><path d="M7.75 3.5A2.75 2.75 0 0 0 5 6.25v11.5a2.75 2.75 0 0 0 2.75 2.75h8.5A2.75 2.75 0 0 0 19 17.75V9.56a2.75 2.75 0 0 0-.8-1.94l-2.82-2.82a2.75 2.75 0 0 0-1.95-.8h-5.68Zm0 1.5h5.18v3.25c0 1.1.9 2 2 2H17.5v7.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25V6.25c0-.69.56-1.25 1.25-1.25Zm6.68.31 2.76 2.75h-2.26a.5.5 0 0 1-.5-.5V5.3Z"/></svg>',
            chat: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.75c-4.56 0-8.25 3.2-8.25 7.16 0 1.84.8 3.52 2.11 4.79-.12 1.31-.63 2.58-1.5 3.63a.75.75 0 0 0 .68 1.22c1.94-.15 3.69-.82 5.03-1.92a9.84 9.84 0 0 0 1.93.19c4.56 0 8.25-3.2 8.25-7.16S16.56 3.75 12 3.75Zm-2.5 8.1a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm2.5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm2.5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
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

    dom.enterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        enterRoom(dom.displayNameInput.value.trim(), dom.roomCodeInput.value.trim(), false);
    });

    dom.composerForm.addEventListener("submit", sendMessage);
    dom.messageInput.addEventListener("input", autoResizeTextarea);
    dom.messageInput.addEventListener("keydown", handleComposerKeydown);
    dom.fileInput.addEventListener("change", () => {
        state.selectedFiles = Array.from(dom.fileInput.files || []);
        updateFileSummary();
    });
    dom.cancelEditButton.addEventListener("click", () => {
        exitEditMode();
        resetComposer();
    });
    dom.clearRecentRoomsButton.addEventListener("click", async () => {
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
    dom.leaveRoomButton.addEventListener("click", () => leaveRoom(true));
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
    dom.roomCodeInput.addEventListener("input", () => {
        dom.roomCodeInput.value = dom.roomCodeInput.value.replace(/\D+/g, "").slice(0, 4);
    });
    dom.messagesList.addEventListener("scroll", () => {
        if (isScrolledNearBottom(dom.messagesList)) {
            state.newMessagesCount = 0;
            renderJumpToLatest();
        }
    });
    dom.messagesList.addEventListener("contextmenu", (event) => {
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
    dom.messagesList.addEventListener("click", (event) => {
        const editButton = event.target.closest("[data-action='edit']");
        const deleteButton = event.target.closest("[data-action='delete']");

        if (editButton) {
            enterEditMode(Number(editButton.dataset.messageId));
        }

        if (deleteButton) {
            deleteMessage(Number(deleteButton.dataset.messageId));
        }
    });
    document.addEventListener("click", (event) => {
        if (!dom.messageContextMenu.hidden && !dom.messageContextMenu.contains(event.target)) {
            hideMessageContextMenu();
        }
    });
    window.addEventListener("scroll", hideMessageContextMenu, true);
    window.addEventListener("resize", hideMessageContextMenu);

    restoreFormState();
    maybeAutoEnter();
    registerServiceWorker();
})();
