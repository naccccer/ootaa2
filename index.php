<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Support\BrowserSession;

BrowserSession::ensureBrowserId();

$initialRoom = trim((string) ($_GET['room'] ?? ''));
$basePath = app_base_path();
?>
<!DOCTYPE html>
<html lang="fa-IR" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>اوتا | گفت‌وگوی خصوصی</title>
    <link rel="stylesheet" href="<?= htmlspecialchars(app_url('assets/style.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
    <div class="app-backdrop"></div>

    <div class="app-frame">
        <div class="app-shell">
            <header class="app-topbar">
                <div class="app-brand">
                    <div class="brand-badge" aria-hidden="true">ا</div>
                    <div class="brand-copy">
                        <strong>اوتا</strong>
                    </div>
                </div>
            </header>

            <section class="screen screen-entry" id="entryPanel">
                <div class="screen-scroll">
                    <section class="hero-card">
                        <form id="enterForm" class="entry-form">
                            <label class="input-group">
                                <span class="input-label">نام نمایشی</span>
                                <div class="input-shell">
                                    <span class="input-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" focusable="false">
                                            <path d="M12 12.75a4.13 4.13 0 1 0 0-8.25 4.13 4.13 0 0 0 0 8.25Zm0 2.25c-4.17 0-7.5 2.1-7.5 4.69 0 .45.37.81.82.81h13.36c.45 0 .82-.36.82-.81 0-2.6-3.33-4.69-7.5-4.69Z" />
                                        </svg>
                                    </span>
                                    <input id="displayNameInput" name="displayName" type="text" maxlength="40" autocomplete="nickname" placeholder="مثلاً نازنین">
                                </div>
                            </label>

                            <label class="input-group">
                                <span class="input-label">کد اتاق</span>
                                <div class="input-shell">
                                    <span class="input-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" focusable="false">
                                            <path d="M6 4.5A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h12a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 18 4.5H6Zm2.25 3.25a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 4a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 4a.75.75 0 0 1 .75-.75h3.25a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z" />
                                        </svg>
                                    </span>
                                    <input id="roomCodeInput" name="roomCode" type="text" inputmode="numeric" pattern="\d{4}" maxlength="4" placeholder="خالی بگذار تا اتاق جدید ساخته شود">
                                </div>
                            </label>

                            <button id="enterButton" type="submit" class="primary-action">
                                <span>ورود به گفتگو</span>
                                <span class="button-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M8.47 4.97a.75.75 0 0 1 1.06 0l6.5 6.5a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 1 1-1.06-1.06L14.44 12 8.47 6.03a.75.75 0 0 1 0-1.06Z" />
                                    </svg>
                                </span>
                            </button>
                        </form>

                        <div class="status-banner" id="entryStatus" hidden></div>
                    </section>

                    <section class="recent-card">
                        <div class="section-row">
                            <div>
                                <h2>اتاق‌های اخیر</h2>
                                <p class="section-copy">برای بازگشت سریع به گفتگوهای قبلی</p>
                            </div>
                            <button type="button" id="clearRecentRoomsButton" class="icon-button soft-button" aria-label="پاک کردن اتاق‌های اخیر" title="پاک کردن اتاق‌های اخیر">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M9.75 3.5h4.5c.83 0 1.5.67 1.5 1.5V6h3a.75.75 0 0 1 0 1.5h-.72l-.63 10.07A2.5 2.5 0 0 1 14.91 20H9.09a2.5 2.5 0 0 1-2.49-2.43L5.97 7.5H5.25a.75.75 0 0 1 0-1.5h3V5c0-.83.67-1.5 1.5-1.5Zm4.5 2.5V5h-4.5v1h4.5ZM9.5 9.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Zm5 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Z" />
                                </svg>
                            </button>
                        </div>
                        <div id="recentRoomsList" class="recent-rooms-list empty-state"></div>
                    </section>
                </div>
            </section>

            <main id="chatView" class="screen screen-chat" hidden>
                <header class="chat-header">
                    <div class="chat-header__leading">
                        <button type="button" id="leaveRoomButton" class="icon-button topbar-button" aria-label="بازگشت" title="بازگشت">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M14.78 5.22a.75.75 0 0 1 0 1.06L9.06 12l5.72 5.72a.75.75 0 1 1-1.06 1.06l-6.25-6.25a.75.75 0 0 1 0-1.06l6.25-6.25a.75.75 0 0 1 1.06 0Z" />
                            </svg>
                        </button>
                        <div class="chat-header__meta">
                            <strong id="roomCodeBadge">----</strong>
                            <p id="roomSubtitleText">در حال آماده‌سازی اتاق...</p>
                        </div>
                    </div>
                    <div class="chat-header__actions">
                        <button type="button" id="copyRoomCodeButton" class="icon-button topbar-button" aria-label="کپی لینک اتاق" title="کپی لینک اتاق">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M9.25 4A2.25 2.25 0 0 0 7 6.25v8.5A2.25 2.25 0 0 0 9.25 17h8.5A2.25 2.25 0 0 0 20 14.75v-8.5A2.25 2.25 0 0 0 17.75 4h-8.5Zm-4 3A2.25 2.25 0 0 0 3 9.25v8.5A2.25 2.25 0 0 0 5.25 20h8.5A2.25 2.25 0 0 0 16 17.75v-.5h-1.5v.5a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5a.75.75 0 0 1 .75-.75h.5V7h-.5Z" />
                            </svg>
                        </button>
                    </div>
                </header>

                <div id="chatStatus" class="status-banner status-banner--floating" hidden></div>

                <section class="messages-panel">
                    <div id="messagesList" class="messages-list"></div>
                </section>

                <form id="composerForm" class="composer" enctype="multipart/form-data">
                    <div id="editModeBanner" class="composer-banner" hidden>
                        <div class="composer-banner__copy">
                            <strong>در حال ویرایش پیام</strong>
                            <span id="editModeText">متن پیام را اصلاح کنید.</span>
                        </div>
                        <button type="button" id="cancelEditButton" class="icon-button soft-button" aria-label="لغو ویرایش" title="لغو ویرایش">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z" />
                            </svg>
                        </button>
                    </div>

                    <div class="selected-files" id="selectedFilesList" hidden></div>

                    <div class="composer-box">
                        <label class="composer-input">
                            <textarea id="messageInput" name="text" rows="1" maxlength="4000" placeholder="پیام بنویسید"></textarea>
                        </label>

                        <div class="composer-tools">
                            <label class="icon-button soft-button file-trigger" aria-label="افزودن فایل" title="افزودن فایل">
                                <input id="fileInput" name="files[]" type="file" multiple>
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M15.5 6.25a3.25 3.25 0 0 1 0 6.5H8.75a2.25 2.25 0 0 0 0 4.5h7a3.75 3.75 0 0 0 0-7.5H8.5a1.75 1.75 0 0 1 0-3.5h7.25a.75.75 0 0 0 0-1.5H8.5a3.25 3.25 0 0 0 0 6.5h7.25a2.25 2.25 0 0 1 0 4.5h-7a3.75 3.75 0 0 1 0-7.5h6.75a.75.75 0 0 0 0-1.5Z" />
                                </svg>
                            </label>

                            <button id="sendButton" type="submit" class="send-button" aria-label="ارسال پیام" title="ارسال پیام">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M4.5 11.27 18.4 5.4c.98-.42 1.96.55 1.54 1.54l-5.88 13.9c-.46 1.08-2.03 1-2.38-.12l-1.54-4.99-5-1.54c-1.11-.34-1.19-1.92-.13-2.37Zm6.5 2.05 1.16 3.78 4.39-10.37L6.18 11.12l3.78 1.16a.75.75 0 0 1 .5.5l.54 1.74Z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                </form>
            </main>
        </div>
    </div>

    <dialog id="confirmDialog" class="dialog-sheet">
        <form method="dialog" class="dialog-sheet__card" id="confirmDialogForm">
            <div class="dialog-sheet__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 3.75c4.56 0 8.25 3.69 8.25 8.25S16.56 20.25 12 20.25 3.75 16.56 3.75 12 7.44 3.75 12 3.75Zm0 4.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0V9a.75.75 0 0 0-.75-.75Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
                </svg>
            </div>
            <div class="dialog-sheet__copy">
                <strong id="confirmDialogTitle">حذف پیام</strong>
                <p id="confirmDialogText">این عمل قابل بازگشت نیست.</p>
            </div>
            <div class="dialog-sheet__actions">
                <button type="button" id="confirmDialogCancel" class="soft-button dialog-button">انصراف</button>
                <button type="button" id="confirmDialogAccept" class="danger-button dialog-button">حذف</button>
            </div>
        </form>
    </dialog>

    <div id="messageContextMenu" class="context-menu" hidden>
        <button type="button" id="contextCopyButton" class="context-menu__item">
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.25 4A2.25 2.25 0 0 0 7 6.25v8.5A2.25 2.25 0 0 0 9.25 17h8.5A2.25 2.25 0 0 0 20 14.75v-8.5A2.25 2.25 0 0 0 17.75 4h-8.5Zm-4 3A2.25 2.25 0 0 0 3 9.25v8.5A2.25 2.25 0 0 0 5.25 20h8.5A2.25 2.25 0 0 0 16 17.75v-.5h-1.5v.5a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5a.75.75 0 0 1 .75-.75h.5V7h-.5Z" />
                </svg>
            </span>
            <span>کپی پیام</span>
        </button>
        <button type="button" id="contextEditButton" class="context-menu__item" hidden>
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M15.12 4.47a2.25 2.25 0 0 1 3.18 3.18L9.56 16.39l-3.98.8.8-3.98 8.74-8.74Zm1.06 1.06-8.39 8.39-.37 1.83 1.83-.37 8.39-8.39a.75.75 0 1 0-1.06-1.06Z" />
                </svg>
            </span>
            <span>ویرایش</span>
        </button>
        <button type="button" id="contextDeleteButton" class="context-menu__item context-menu__item--danger" hidden>
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.75 3.5h4.5c.83 0 1.5.67 1.5 1.5V6h3a.75.75 0 0 1 0 1.5h-.72l-.63 10.07A2.5 2.5 0 0 1 14.91 20H9.09a2.5 2.5 0 0 1-2.49-2.43L5.97 7.5H5.25a.75.75 0 0 1 0-1.5h3V5c0-.83.67-1.5 1.5-1.5Zm4.5 2.5V5h-4.5v1h4.5ZM9.5 9.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Zm5 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Z" />
                </svg>
            </span>
            <span>حذف</span>
        </button>
    </div>

    <script>
        window.OOTAA_APP = {
            basePath: <?= json_encode($basePath, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            initialRoom: <?= json_encode($initialRoom, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>
        };
    </script>
    <script src="<?= htmlspecialchars(app_url('assets/app.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
</body>
</html>
