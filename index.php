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
    <title>ootaa.ir</title>
    <meta name="theme-color" content="#4ea4f6">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="manifest" href="<?= htmlspecialchars(asset_url('manifest.webmanifest'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="icon" href="<?= htmlspecialchars(asset_url('public/pwa/icon.svg'), ENT_QUOTES, 'UTF-8') ?>" type="image/svg+xml">
    <link rel="apple-touch-icon" href="<?= htmlspecialchars(asset_url('public/pwa/icon-192.png'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="preload" href="<?= htmlspecialchars(asset_url('public/fonts/Vazir-Regular-FD.woff2'), ENT_QUOTES, 'UTF-8') ?>" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('assets/style.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="app-loading">
    <div class="app-backdrop"></div>

    <div class="app-frame">
        <div class="app-shell">
            <aside id="sidebarPanel" class="sidebar">
                <header class="sidebar-header">
                    <section class="sidebar-identity sidebar-identity--header" aria-label="نام نمایشی">
                        <button type="button" id="sidebarIdentityDisplay" class="sidebar-identity__display" aria-label="ویرایش نام نمایشی" title="ویرایش نام نمایشی">
                            <span id="sidebarIdentityAvatar" class="sidebar-identity__avatar" aria-hidden="true">NA</span>
                            <span class="sidebar-identity__copy">
                                <strong id="sidebarIdentityName">بدون نام نمایشی</strong>
                                <span id="sidebarIdentityHint"></span>
                            </span>
                        </button>

                        <div id="sidebarIdentityEditor" class="sidebar-identity__editor" hidden>
                            <label class="sidebar-identity__field" for="sidebarIdentityInput">
                                <input id="sidebarIdentityInput" class="sidebar-identity__input" type="text" maxlength="40" autocomplete="nickname" placeholder="نام نمایشی">
                            </label>
                            <div class="sidebar-identity__inline-actions">
                                <button type="button" id="sidebarIdentitySaveButton" class="icon-button soft-button icon-button--sm" aria-label="تایید نام نمایشی" title="تایید">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M18.28 7.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L5.72 11.28a.75.75 0 1 1 1.06-1.06l3.72 3.72 6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                                    </svg>
                                </button>
                                <button type="button" id="sidebarIdentityCancelButton" class="icon-button soft-button icon-button--sm" aria-label="لغو ویرایش نام نمایشی" title="لغو">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </section>

                    <div class="sidebar-header__actions">
                        <button type="button" id="openEntryButton" class="icon-button primary-icon-button" aria-label="شروع گفتگو" title="شروع گفتگو">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M12 5.25a.75.75 0 0 1 .75.75v5.25H18a.75.75 0 0 1 0 1.5h-5.25V18a.75.75 0 0 1-1.5 0v-5.25H6a.75.75 0 0 1 0-1.5h5.25V6a.75.75 0 0 1 .75-.75Z" />
                            </svg>
                        </button>
                    </div>
                </header>

                <section class="sidebar-section">
                    <div class="section-row">
                        <div>
                            <h2>گفتگوها</h2>
                        </div>
                    </div>

                    <div id="recentRoomsSelectionBar" class="recent-rooms-selection" hidden>
                        <strong id="recentRoomsSelectionText" class="recent-rooms-selection__text">0 گفتگو انتخاب شده</strong>
                        <div class="recent-rooms-selection__actions">
                            <button type="button" id="recentRoomsDeleteButton" class="icon-button soft-button icon-button--sm recent-rooms-selection__button recent-rooms-selection__button--danger" aria-label="حذف گفتگوهای انتخاب‌شده" title="حذف">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M9.75 3.5h4.5c.83 0 1.5.67 1.5 1.5V6h3a.75.75 0 0 1 0 1.5h-.72l-.63 10.07A2.5 2.5 0 0 1 14.91 20H9.09a2.5 2.5 0 0 1-2.49-2.43L5.97 7.5H5.25a.75.75 0 0 1 0-1.5h3V5c0-.83.67-1.5 1.5-1.5Zm4.5 2.5V5h-4.5v1h4.5ZM9.5 9.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Zm5 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Z" />
                                </svg>
                            </button>
                            <button type="button" id="recentRoomsCancelSelectionButton" class="icon-button soft-button icon-button--sm recent-rooms-selection__button" aria-label="لغو حالت انتخاب گفتگوها" title="لغو">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div id="recentRoomsList" class="recent-rooms-list empty-state"></div>
                </section>
            </aside>

            <section class="workspace">
                <section id="welcomePanel" class="welcome-panel">
                    <div class="welcome-panel__card">
                        <div class="welcome-panel__visual" aria-hidden="true">
                            <div class="welcome-panel__plane">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M4.5 11.27 18.4 5.4c.98-.42 1.96.55 1.54 1.54l-5.88 13.9c-.46 1.08-2.03 1-2.38-.12l-1.54-4.99-5-1.54c-1.11-.34-1.19-1.92-.13-2.37Zm6.5 2.05 1.16 3.78 4.39-10.37L6.18 11.12l3.78 1.16a.75.75 0 0 1 .5.5l.54 1.74Z" />
                                </svg>
                            </div>
                        </div>

                        <div class="welcome-panel__copy">
                            <h1>اوتا</h1>
                            <p></p>
                        </div>

                        <div class="welcome-panel__actions">
                            <button type="button" id="welcomeNewChatButton" class="primary-action">
                                <span>گفتگوی جدید</span>
                                <span class="button-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M12 5.25a.75.75 0 0 1 .75.75v5.25H18a.75.75 0 0 1 0 1.5h-5.25V18a.75.75 0 0 1-1.5 0v-5.25H6a.75.75 0 0 1 0-1.5h5.25V6a.75.75 0 0 1 .75-.75Z" />
                                    </svg>
                                </span>
                            </button>
                            <button type="button" id="welcomeJoinButton" class="secondary-action">
                                <span>ورود با کد اتاق</span>
                            </button>
                        </div>
                    </div>
                </section>

                <main id="chatView" class="screen screen-chat" hidden>
                    <header class="chat-header">
                        <div class="chat-header__leading">
                            <button type="button" id="leaveRoomButton" class="icon-button topbar-button" aria-label="بازگشت به گفتگوها" title="بازگشت به گفتگوها">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M14.78 5.22a.75.75 0 0 1 0 1.06L9.06 12l5.72 5.72a.75.75 0 1 1-1.06 1.06l-6.25-6.25a.75.75 0 0 1 0-1.06l6.25-6.25a.75.75 0 0 1 1.06 0Z" />
                                </svg>
                            </button>

                            <div id="roomAvatar" class="chat-header__avatar" aria-hidden="true">00</div>

                            <div class="chat-header__meta">
                                <button type="button" id="roomNameDisplay" class="room-name-button" aria-label="ویرایش نام اتاق" title="ویرایش نام اتاق">
                                    <strong id="roomNameText">اتاق ----</strong>
                                    <span class="room-name-button__icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" focusable="false">
                                            <path d="M15.12 4.47a2.25 2.25 0 0 1 3.18 3.18L9.56 16.39l-3.98.8.8-3.98 8.74-8.74Zm1.06 1.06-8.39 8.39-.37 1.83 1.83-.37 8.39-8.39a.75.75 0 1 0-1.06-1.06Z" />
                                        </svg>
                                    </span>
                                </button>
                                <div id="roomNameEditor" class="room-name-editor" hidden>
                                    <input id="roomNameInput" class="room-name-editor__input" type="text" maxlength="80" placeholder="نام اتاق">
                                    <div class="room-name-editor__actions">
                                        <button type="button" id="roomNameSaveButton" class="icon-button soft-button icon-button--sm" aria-label="تایید نام اتاق" title="تایید">
                                            <svg viewBox="0 0 24 24" focusable="false">
                                                <path d="M18.28 7.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L5.72 11.28a.75.75 0 1 1 1.06-1.06l3.72 3.72 6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                                            </svg>
                                        </button>
                                        <button type="button" id="roomNameCancelButton" class="icon-button soft-button icon-button--sm" aria-label="لغو ویرایش نام اتاق" title="لغو">
                                            <svg viewBox="0 0 24 24" focusable="false">
                                                <path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
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
                        <button type="button" id="jumpToLatestButton" class="jump-to-latest" hidden>
                            <span id="jumpToLatestCount">0</span>
                            <span>پیام جدید</span>
                        </button>
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

                        <div id="replyModeBanner" class="composer-banner composer-banner--reply" hidden>
                            <div class="composer-banner__copy">
                                <strong id="replyModeTitle">در حال پاسخ</strong>
                                <span id="replyModeText">پاسخ به پیام انتخاب‌شده</span>
                            </div>
                            <button type="button" id="cancelReplyButton" class="icon-button soft-button" aria-label="لغو پاسخ" title="لغو پاسخ">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z" />
                                </svg>
                            </button>
                        </div>

                        <div class="selected-files" id="selectedFilesList" hidden></div>

                        <div id="uploadProgress" class="upload-progress" hidden>
                            <div class="upload-progress__head">
                                <strong id="uploadProgressLabel">در حال ارسال...</strong>
                                <span id="uploadProgressPercent">0%</span>
                            </div>
                            <div class="upload-progress__track" aria-hidden="true">
                                <div id="uploadProgressBar" class="upload-progress__bar"></div>
                            </div>
                        </div>

                        <div id="composerBox" class="composer-box">
                            <div id="composerDropHint" class="composer-drop-hint" hidden>فایل‌ها را اینجا رها کنید</div>
                            <label class="composer-input">
                                <textarea id="messageInput" name="text" rows="1" maxlength="4000" placeholder="پیام بنویسید"></textarea>
                            </label>

                            <div class="composer-tools">
                                <label class="icon-button soft-button file-trigger" aria-label="افزودن فایل" title="افزودن فایل">
                                    <input id="fileInput" name="files[]" type="file" multiple>
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M10.54 6.1a3.6 3.6 0 0 1 5.09 5.1l-4.95 4.95a2.35 2.35 0 1 1-3.33-3.33l4.6-4.6a1.1 1.1 0 1 1 1.56 1.56l-4.25 4.25a.35.35 0 1 0 .49.5l4.96-4.96a2.1 2.1 0 0 0-2.97-2.98l-5.31 5.32a3.85 3.85 0 1 0 5.44 5.44l4.25-4.25a.75.75 0 1 1 1.06 1.06l-4.25 4.25a5.35 5.35 0 1 1-7.56-7.56Z" />
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
            </section>
        </div>
    </div>

    <dialog id="entryDialog" class="dialog-sheet dialog-sheet--entry">
        <div class="dialog-sheet__card entry-sheet">
            <button type="button" id="closeEntryDialogButton" class="icon-button soft-button entry-sheet__close" aria-label="بستن" title="بستن">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M6.97 6.97a.75.75 0 0 1 1.06 0L12 10.94l3.97-3.97a.75.75 0 1 1 1.06 1.06L13.06 12l3.97 3.97a.75.75 0 1 1-1.06 1.06L12 13.06l-3.97 3.97a.75.75 0 1 1-1.06-1.06L10.94 12 6.97 8.03a.75.75 0 0 1 0-1.06Z" />
                </svg>
            </button>

            <div class="entry-sheet__hero">
                <div class="entry-sheet__badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M4.5 11.27 18.4 5.4c.98-.42 1.96.55 1.54 1.54l-5.88 13.9c-.46 1.08-2.03 1-2.38-.12l-1.54-4.99-5-1.54c-1.11-.34-1.19-1.92-.13-2.37Zm6.5 2.05 1.16 3.78 4.39-10.37L6.18 11.12l3.78 1.16a.75.75 0 0 1 .5.5l.54 1.74Z" />
                    </svg>
                </div>
                <div class="entry-sheet__copy">
                    <strong id="entryDialogTitle">گفتگوی جدید</strong>
                    <p id="entryDialogDescription"></p>
                </div>
            </div>

            <form id="enterForm" class="entry-form">
                <label id="displayNameGroup" class="input-group">
                    <span class="input-label">نام نمایشی</span>
                    <div class="input-shell">
                        <span class="input-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M12 12.75a4.13 4.13 0 1 0 0-8.25 4.13 4.13 0 0 0 0 8.25Zm0 2.25c-4.17 0-7.5 2.1-7.5 4.69 0 .45.37.81.82.81h13.36c.45 0 .82-.36.82-.81 0-2.6-3.33-4.69-7.5-4.69Z" />
                            </svg>
                        </span>
                        <input id="displayNameInput" name="displayName" type="text" maxlength="40" autocomplete="nickname" placeholder="مثلاً علی">
                    </div>
                </label>

                <div class="entry-inline-actions" hidden>
                    <button type="button" id="toggleRoomCodeButton" class="entry-link-button" aria-expanded="false" aria-controls="roomCodeGroup" hidden>
                        اگر کد داری
                    </button>
                </div>

                <div id="roomCodeGroup" class="entry-optional-group">
                    <label class="input-group">
                        <span class="input-label">کد اتاق</span>
                        <div class="input-shell">
                            <span class="input-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false">
                                    <path d="M6 4.5A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h12a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 18 4.5H6Zm2.25 3.25a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 4a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 4a.75.75 0 0 1 .75-.75h3.25a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z" />
                                </svg>
                            </span>
                            <input id="roomCodeInput" name="roomCode" type="text" inputmode="numeric" pattern="\d{4}" maxlength="4" placeholder="کد ۴ رقمی اتاق">
                        </div>
                    </label>
                </div>

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
            <p id="entryDialogHint" class="entry-sheet__hint"></p>
        </div>
    </dialog>

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
        <button type="button" id="contextReplyButton" class="context-menu__item">
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.53 5.22a.75.75 0 0 1 0 1.06L5.81 10H14a6.25 6.25 0 1 1 0 12.5h-2.5a.75.75 0 0 1 0-1.5H14a4.75 4.75 0 1 0 0-9.5H5.81l3.72 3.72a.75.75 0 1 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z" />
                </svg>
            </span>
            <span>پاسخ</span>
        </button>
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

    <div id="chatContextMenu" class="context-menu" hidden>
        <button type="button" id="chatContextPinButton" class="context-menu__item">
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M14.78 4.72a.75.75 0 0 1 1.06 0l3.44 3.44a.75.75 0 0 1 0 1.06l-1.97 1.97v2.27a.75.75 0 0 1-.22.53l-2.5 2.5a.75.75 0 0 1-.53.22h-1.77l-4.76 4.76a.75.75 0 0 1-1.06-1.06l4.76-4.76V13.9a.75.75 0 0 1 .22-.53l2.5-2.5a.75.75 0 0 1 .53-.22h2.27l1.97-1.97a.75.75 0 0 1 1.06 0ZM14.8 12.15h-1.76l-2.06 2.06v1.76l5.81-5.81V8.4l-2 2a.75.75 0 0 1-.53.22Z" />
                </svg>
            </span>
            <span>سنجاق</span>
        </button>
        <button type="button" id="chatContextSelectButton" class="context-menu__item">
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M5.75 4A2.75 2.75 0 0 0 3 6.75v10.5A2.75 2.75 0 0 0 5.75 20h12.5A2.75 2.75 0 0 0 21 17.25V6.75A2.75 2.75 0 0 0 18.25 4H5.75Zm0 1.5h12.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H5.75c-.69 0-1.25-.56-1.25-1.25V6.75c0-.69.56-1.25 1.25-1.25Zm2.97 5.47a.75.75 0 0 1 1.06 0l1.72 1.72 3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06Z" />
                </svg>
            </span>
            <span>انتخاب</span>
        </button>
        <button type="button" id="chatContextRenameButton" class="context-menu__item">
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M15.12 4.47a2.25 2.25 0 0 1 3.18 3.18L9.56 16.39l-3.98.8.8-3.98 8.74-8.74Zm1.06 1.06-8.39 8.39-.37 1.83 1.83-.37 8.39-8.39a.75.75 0 1 0-1.06-1.06Z" />
                </svg>
            </span>
            <span>تغییر نام</span>
        </button>
        <button type="button" id="chatContextCopyLinkButton" class="context-menu__item">
            <span class="context-menu__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.25 4A2.25 2.25 0 0 0 7 6.25v8.5A2.25 2.25 0 0 0 9.25 17h8.5A2.25 2.25 0 0 0 20 14.75v-8.5A2.25 2.25 0 0 0 17.75 4h-8.5Zm-4 3A2.25 2.25 0 0 0 3 9.25v8.5A2.25 2.25 0 0 0 5.25 20h8.5A2.25 2.25 0 0 0 16 17.75v-.5h-1.5v.5a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5a.75.75 0 0 1 .75-.75h.5V7h-.5Z" />
                </svg>
            </span>
            <span>کپی لینک</span>
        </button>
        <button type="button" id="chatContextDeleteButton" class="context-menu__item context-menu__item--danger">
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
            initialRoom: <?= json_encode($initialRoom, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            assets: {
                serviceWorker: <?= json_encode(asset_url('sw.js'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>
            }
        };
    </script>
    <script src="<?= htmlspecialchars(asset_url('assets/app.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
</body>
</html>
