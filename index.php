<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$initialRoom = trim((string) ($_GET['room'] ?? ''));
$basePath = app_base_path();
?>
<!DOCTYPE html>
<html lang="fa-IR" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>اوتا</title>
    <meta name="theme-color" content="#1b4d3e">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="manifest" href="<?= htmlspecialchars(asset_url('manifest.webmanifest'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="icon" href="<?= htmlspecialchars(asset_url('public/Logo/app-icon.svg'), ENT_QUOTES, 'UTF-8') ?>" type="image/svg+xml">
    <link rel="shortcut icon" href="<?= htmlspecialchars(asset_url('public/Logo/app-icon.svg'), ENT_QUOTES, 'UTF-8') ?>" type="image/svg+xml">
    <link rel="apple-touch-icon" href="<?= htmlspecialchars(asset_url('public/Logo/app-icon.svg'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="preload" href="<?= htmlspecialchars(asset_url('public/fonts/NeueKabel-Book.otf'), ENT_QUOTES, 'UTF-8') ?>" as="font" type="font/otf" crossorigin>
    <link rel="preload" href="<?= htmlspecialchars(asset_url('public/fonts/Vazir-Regular-FD.woff2'), ENT_QUOTES, 'UTF-8') ?>" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('assets/style.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
    <div class="page-shell">
        <section id="authScreen" class="auth-screen">
            <div class="auth-card">
                <div class="auth-hero">
                    <span class="auth-kicker">اوتا</span>
                    <h1>ootaa.ir</h1>
                </div>

                <div class="auth-tabs" role="tablist" aria-label="ورود و ثبت‌نام">
                    <button type="button" id="loginTabButton" class="auth-tab is-active" data-auth-mode="login">ورود</button>
                    <button type="button" id="registerTabButton" class="auth-tab" data-auth-mode="register">ثبت‌نام</button>
                </div>

                <form id="loginForm" class="auth-form">
                    <label class="field">
                        <span>شماره موبایل</span>
                        <input id="loginMobileInput" name="mobile" type="tel" inputmode="numeric" autocomplete="username" placeholder="مثلاً 09123456789">
                    </label>
                    <label class="field">
                        <span>رمز</span>
                        <input id="loginPasswordInput" name="password" type="password" autocomplete="current-password" placeholder="رمز حساب">
                    </label>
                    <button id="loginSubmitButton" type="submit" class="primary-button">ورود با رمز</button>
                    <div class="auth-inline-actions">
                        <button id="loginOtpButton" type="button" class="auth-link-button">ورود / ثبت‌نام با کد تایید</button>
                        <button id="forgotPasswordButton" type="button" class="auth-link-button">فراموشی رمز</button>
                    </div>
                </form>

                <form id="registerForm" class="auth-form" hidden>
                    <label class="field">
                        <span>شماره موبایل</span>
                        <input id="registerMobileInput" name="mobile" type="tel" inputmode="numeric" autocomplete="username" placeholder="مثلاً 09123456789">
                    </label>
                    <input id="registerNameInput" name="displayName" type="hidden">
                    <label class="field">
                        <span>رمز</span>
                        <input id="registerPasswordInput" name="password" type="password" autocomplete="new-password" placeholder="حداقل 8 کاراکتر">
                    </label>
                    <button id="registerSubmitButton" type="submit" class="primary-button">ساخت حساب</button>
                </form>

                <div id="authStatus" class="inline-status" hidden></div>
            </div>

            <form id="authGuestForm" class="auth-guest-card">
                <label class="field">
                    <span>کد اتاق</span>
                    <div class="room-code-digits" dir="ltr" aria-label="کد ۴ رقمی اتاق">
                        <input class="room-code-digit" name="roomCodeDigit1" type="text" inputmode="numeric" maxlength="1" pattern="\d" autocomplete="off" aria-label="رقم اول کد اتاق">
                        <input class="room-code-digit" name="roomCodeDigit2" type="text" inputmode="numeric" maxlength="1" pattern="\d" autocomplete="off" aria-label="رقم دوم کد اتاق">
                        <input class="room-code-digit" name="roomCodeDigit3" type="text" inputmode="numeric" maxlength="1" pattern="\d" autocomplete="off" aria-label="رقم سوم کد اتاق">
                        <input class="room-code-digit" name="roomCodeDigit4" type="text" inputmode="numeric" maxlength="1" pattern="\d" autocomplete="off" aria-label="رقم چهارم کد اتاق">
                    </div>
                </label>
                <button type="submit" id="authGuestButton" class="guest-entry-button">ورود مهمان با کد اتاق</button>
                <div id="authGuestStatus" class="inline-status" hidden></div>
            </form>
        </section>

        <section id="appScreen" class="app-screen" hidden>
            <aside class="sidebar">
                <div class="brand-card">
                    <button type="button" id="openAccountMenuButton" class="icon-button burger-button" aria-label="تنظیمات حساب"><span></span></button>
                    <div class="brand-card__identity">
                        <div id="accountName" class="brand-card__title">-</div>
                        <div id="accountMobile" class="brand-card__meta">-</div>
                    </div>
                </div>

                <div class="sidebar-section">
                    <form id="quickRoomForm" class="quick-room-form">
                        <button type="button" id="toggleContactSearchButton" class="icon-button search-button" aria-label="جستجوی مخاطب"></button>
                        <div class="quick-room-field-stack">
                            <input id="quickRoomCodeInput" class="quick-room-code-input" name="roomCode" type="text" inputmode="numeric" maxlength="4" pattern="\d{4}" placeholder="کد ۴ رقمی اتاق" aria-label="کد اتاق">
                            <input id="contactSearchInput" class="quick-contact-search-input" type="search" autocomplete="off" placeholder="نام یا شماره موبایل" aria-label="جستجوی مخاطب">
                        </div>
                        <button type="submit" id="quickJoinRoomButton" class="icon-button join-button" aria-label="ورود به اتاق"></button>
                        <button type="button" id="quickCreateRoomButton" class="icon-button add-chat-button" aria-label="اتاق جدید"></button>
                    </form>
                    <div id="contactSearchPanel" class="contact-search-panel" hidden>
                        <div id="contactSearchResults" class="contact-search-results"></div>
                    </div>
                    <div id="roomSelectionBar" class="room-selection-bar" hidden>
                        <span id="roomSelectionCount">۰ انتخاب</span>
                        <div class="room-selection-bar__actions">
                            <button type="button" id="deleteSelectedRoomsButton" class="icon-button delete-room-button" aria-label="حذف انتخاب‌شده‌ها"></button>
                            <button type="button" id="cancelRoomSelectionButton" class="icon-button close-button" aria-label="لغو انتخاب"></button>
                        </div>
                    </div>
                    <div id="recentRoomsList" class="recent-rooms"></div>
                </div>
            </aside>

            <main class="workspace">
                <section id="welcomePanel" class="welcome-panel">
                    <div class="welcome-card">
                        <span class="welcome-card__eyebrow">شروع</span>
                        <h2>اتاقی انتخاب نشده</h2>
                    </div>
                </section>

                <section id="chatPanel" class="chat-panel" hidden>
                    <header class="chat-header">
                        <button type="button" id="leaveRoomButton" class="icon-button back-button" aria-label="بازگشت"></button>
                        <div class="chat-header__meta">
                            <div class="chat-header__title-row">
                                <h2 id="roomTitle">اتاق</h2>
                            </div>
                            <div id="roomSubtitle" class="chat-header__subtitle">-</div>
                        </div>
                        <div class="chat-header__actions">
                            <button type="button" id="openRoomMenuButton" class="icon-button dots-button" aria-label="گزینه‌های اتاق"></button>
                        </div>
                    </header>

                    <section class="presence-panel" hidden>
                        <div class="presence-panel__summary">
                            <strong id="presenceCount">0 نفر آنلاین</strong>
                            <span id="presenceHint">اعضای فعال این اتاق</span>
                        </div>
                        <div id="presenceList" class="presence-list"></div>
                    </section>

                    <div id="chatStatus" class="inline-status" hidden></div>

                    <div id="messageSelectionBar" class="message-selection-bar" hidden>
                        <span id="messageSelectionCount">۰ انتخاب</span>
                        <div class="message-selection-bar__actions">
                            <button type="button" id="copySelectedMessagesButton" class="icon-button copy-button" aria-label="کپی انتخاب‌شده‌ها"></button>
                            <button type="button" id="forwardSelectedMessagesButton" class="icon-button forward-button" aria-label="فوروارد انتخاب‌شده‌ها"></button>
                            <button type="button" id="deleteSelectedMessagesButton" class="icon-button delete-room-button" aria-label="حذف انتخاب‌شده‌ها"></button>
                            <button type="button" id="cancelMessageSelectionButton" class="icon-button close-button" aria-label="لغو انتخاب"></button>
                        </div>
                    </div>

                    <section id="messagesList" class="messages-list"></section>
                    <div id="chatDropOverlay" class="chat-drop-overlay" hidden aria-hidden="true">
                        <div class="chat-drop-overlay__card">
                            <span class="chat-drop-overlay__icon" aria-hidden="true"></span>
                            <strong>&#1585;&#1607;&#1575; &#1705;&#1585;&#1583;&#1606; &#1601;&#1575;&#1740;&#1604; &#1576;&#1585;&#1575;&#1740; &#1575;&#1585;&#1587;&#1575;&#1604;</strong>
                        </div>
                    </div>

                    <form id="composerForm" class="composer" enctype="multipart/form-data">
                        <div id="replyBanner" class="context-banner" hidden>
                            <div>
                                <strong>در حال پاسخ</strong>
                                <span id="replyBannerText"></span>
                            </div>
                            <button type="button" id="cancelReplyButton" class="icon-button close-button" aria-label="لغو"></button>
                        </div>

                        <div id="editBanner" class="context-banner" hidden>
                            <div>
                                <strong>ویرایش پیام</strong>
                                <span id="editBannerText"></span>
                            </div>
                            <button type="button" id="cancelEditButton" class="icon-button close-button" aria-label="لغو"></button>
                        </div>

                        <div id="selectedFilesList" class="selected-files" hidden></div>
                        <div id="uploadProgress" class="upload-progress" hidden aria-live="polite">
                            <div class="upload-progress__meta">
                                <span>Uploading</span>
                                <strong id="uploadProgressText">0%</strong>
                            </div>
                            <div class="upload-progress__track">
                                <span id="uploadProgressBar"></span>
                            </div>
                        </div>

                        <div class="composer-row">
                            <label class="file-button">
                                <input id="fileInput" name="files[]" type="file" multiple>
                                <span aria-hidden="true"></span>
                            </label>
                            <textarea id="messageInput" name="text" rows="1" maxlength="4000" placeholder="پیام بنویسید"></textarea>
                            <button id="emojiButton" type="button" class="emoji-button" aria-label="Emoji" aria-expanded="false" aria-controls="emojiPicker"></button>
                            <button id="sendButton" type="submit" class="send-button" aria-label="ارسال"></button>
                        </div>
                        <div id="emojiPicker" class="emoji-picker" hidden></div>
                    </form>
                </section>
            </main>
        </section>
    </div>

    <dialog id="imagePreviewDialog" class="modal image-preview-dialog">
        <form method="dialog" class="image-preview-card" id="imagePreviewForm">
            <div class="image-preview-card__head">
                <strong id="imagePreviewTitle">ارسال فایل</strong>
                <button type="button" id="closeImagePreviewButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <div id="imagePreviewStage" class="image-preview-stage"></div>
            <textarea id="imageCaptionInput" rows="1" maxlength="4000" placeholder="کپشن"></textarea>
            <div id="imageUploadProgress" class="upload-progress upload-progress--dialog" hidden aria-live="polite">
                <div class="upload-progress__meta">
                    <span>Uploading</span>
                    <strong id="imageUploadProgressText">0%</strong>
                </div>
                <div class="upload-progress__track">
                    <span id="imageUploadProgressBar"></span>
                </div>
            </div>
            <div id="imagePreviewThumbs" class="image-preview-thumbs" hidden></div>
            <div class="image-preview-card__actions">
                <button type="button" id="cancelImagePreviewButton" class="ghost-button">لغو</button>
                <button type="submit" id="sendImagePreviewButton" class="send-button image-preview-send-button" aria-label="ارسال"></button>
            </div>
        </form>
    </dialog>

    <dialog id="photoViewerDialog" class="modal photo-viewer-dialog">
        <div class="photo-viewer">
            <button type="button" id="closePhotoViewerButton" class="icon-button close-button photo-viewer__close" aria-label="بستن"></button>
            <img id="photoViewerImage" src="" alt="">
        </div>
    </dialog>

    <dialog id="accountMenuDialog" class="modal">
        <div class="menu-card">
            <div class="menu-card__head">
                <strong>حساب</strong>
                <button type="button" id="closeAccountMenuButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <button type="button" id="openProfileButton" class="menu-item">
                <span class="menu-icon user-icon" aria-hidden="true"></span>
                <span>نام</span>
            </button>
            <button type="button" id="openPasswordButton" class="menu-item">
                <span class="menu-icon lock-icon" aria-hidden="true"></span>
                <span>رمز</span>
            </button>
            <button type="button" id="guestRegisterButton" class="menu-item" hidden>
                <span class="menu-icon user-icon" aria-hidden="true"></span>
                <span>ثبت‌نام</span>
            </button>
            <button type="button" id="guestLoginButton" class="menu-item" hidden>
                <span class="menu-icon lock-icon" aria-hidden="true"></span>
                <span>ورود</span>
            </button>
            <button type="button" id="logoutButton" class="menu-item danger-text">
                <span class="menu-icon logout-icon" aria-hidden="true"></span>
                <span>خروج</span>
            </button>
        </div>
    </dialog>

    <dialog id="roomMenuDialog" class="modal">
        <div class="menu-card">
            <div class="menu-card__head">
                <strong>اتاق</strong>
                <button type="button" id="closeRoomMenuButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <button type="button" id="copyRoomLinkButton" class="menu-item">
                <span class="menu-icon link-icon" aria-hidden="true"></span>
                <span>کپی لینک</span>
            </button>
            <button type="button" id="openRoomNameButton" class="menu-item" hidden>
                <span class="menu-icon edit-icon" aria-hidden="true"></span>
                <span>نام اتاق</span>
            </button>
        </div>
    </dialog>

    <dialog id="messageMenuDialog" class="modal">
        <div class="menu-card">
            <div class="menu-card__head">
                <strong>پیام</strong>
                <button type="button" id="closeMessageMenuButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <button type="button" id="messageReplyButton" class="menu-item">
                <span class="menu-icon reply-icon" aria-hidden="true"></span>
                <span>پاسخ</span>
            </button>
            <button type="button" id="messageSelectButton" class="menu-item">
                <span class="menu-icon select-icon" aria-hidden="true"></span>
                <span>انتخاب</span>
            </button>
            <button type="button" id="messageCopyButton" class="menu-item">
                <span class="menu-icon copy-icon" aria-hidden="true"></span>
                <span>کپی</span>
            </button>
            <button type="button" id="messageForwardButton" class="menu-item">
                <span class="menu-icon forward-icon" aria-hidden="true"></span>
                <span>فوروارد</span>
            </button>
            <button type="button" id="messageEditButton" class="menu-item">
                <span class="menu-icon edit-icon" aria-hidden="true"></span>
                <span>ویرایش</span>
            </button>
            <button type="button" id="messageDeleteButton" class="menu-item danger-text">
                <span class="menu-icon delete-icon" aria-hidden="true"></span>
                <span>حذف</span>
            </button>
        </div>
    </dialog>

    <dialog id="attachmentMenuDialog" class="modal">
        <div class="menu-card">
            <div class="menu-card__head">
                <strong>فایل</strong>
                <button type="button" id="closeAttachmentMenuButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <button type="button" id="attachmentOpenButton" class="menu-item">
                <span class="menu-icon view-icon" aria-hidden="true"></span>
                <span>نمایش</span>
            </button>
            <button type="button" id="attachmentDownloadButton" class="menu-item">
                <span class="menu-icon download-icon" aria-hidden="true"></span>
                <span>دانلود</span>
            </button>
            <button type="button" id="attachmentCopyButton" class="menu-item">
                <span class="menu-icon link-icon" aria-hidden="true"></span>
                <span>کپی لینک</span>
            </button>
            <button type="button" id="attachmentReplyButton" class="menu-item">
                <span class="menu-icon reply-icon" aria-hidden="true"></span>
                <span>پاسخ</span>
            </button>
            <button type="button" id="attachmentSelectButton" class="menu-item">
                <span class="menu-icon select-icon" aria-hidden="true"></span>
                <span>انتخاب</span>
            </button>
            <button type="button" id="attachmentDeleteButton" class="menu-item danger-text">
                <span class="menu-icon delete-icon" aria-hidden="true"></span>
                <span>حذف پیام</span>
            </button>
        </div>
    </dialog>

    <dialog id="roomContextMenuDialog" class="modal">
        <div class="menu-card">
            <div class="menu-card__head">
                <strong>چت</strong>
                <button type="button" id="closeRoomContextMenuButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <button type="button" id="roomContextSelectButton" class="menu-item">
                <span class="menu-icon select-icon" aria-hidden="true"></span>
                <span>انتخاب</span>
            </button>
            <button type="button" id="roomContextRenameButton" class="menu-item">
                <span class="menu-icon edit-icon" aria-hidden="true"></span>
                <span>ویرایش نام</span>
            </button>
            <button type="button" id="roomContextDeleteButton" class="menu-item danger-text">
                <span class="menu-icon delete-icon" aria-hidden="true"></span>
                <span>حذف</span>
            </button>
            <button type="button" id="roomContextCopyButton" class="menu-item">
                <span class="menu-icon link-icon" aria-hidden="true"></span>
                <span>کپی لینک</span>
            </button>
        </div>
    </dialog>

    <dialog id="confirmDialog" class="modal">
        <form method="dialog" class="modal-card confirm-card" id="confirmDialogForm">
            <div class="modal-card__head">
                <h3 id="confirmDialogTitle">تایید</h3>
                <button type="button" id="cancelConfirmDialogButton" class="icon-button close-button" aria-label="لغو"></button>
            </div>
            <p id="confirmDialogMessage" class="modal-card__copy"></p>
            <div class="modal-card__actions">
                <button type="button" id="rejectConfirmDialogButton" class="secondary-button">لغو</button>
                <button type="submit" id="acceptConfirmDialogButton" class="primary-button danger-button">حذف</button>
            </div>
        </form>
    </dialog>

    <dialog id="registerNameDialog" class="modal">
        <form method="dialog" class="modal-card" id="registerNameForm">
            <div class="modal-card__head">
                <h3>نام</h3>
                <button type="button" id="closeRegisterNameDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <label class="field">
                <span>نام</span>
                <input id="registerDialogNameInput" name="displayName" type="text" maxlength="40" autocomplete="name" placeholder="نام شما">
            </label>
            <div id="registerNameStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="submitRegisterNameButton" class="primary-button">ادامه</button>
            </div>
        </form>
    </dialog>

    <dialog id="guestNameDialog" class="modal">
        <form method="dialog" class="modal-card guest-name-card" id="guestNameForm">
            <div class="modal-card__head">
                <button type="button" id="closeGuestNameDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <label class="field">
                <span>نام</span>
                <input id="guestNameInput" name="displayName" type="text" maxlength="40" autocomplete="name" placeholder="نام شما">
            </label>
            <div id="guestNameStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="submitGuestNameButton" class="primary-button">ورود به اتاق</button>
            </div>
        </form>
    </dialog>

    <dialog id="guestAuthDialog" class="modal">
        <form method="dialog" class="modal-card" id="guestAuthForm">
            <div class="modal-card__head">
                <h3 id="guestAuthTitle">ثبت‌نام</h3>
                <button type="button" id="closeGuestAuthDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <label class="field">
                <span>شماره موبایل</span>
                <input id="guestAuthMobileInput" name="mobile" type="tel" inputmode="numeric" autocomplete="username" placeholder="مثلاً 09123456789">
            </label>
            <label class="field">
                <span>رمز</span>
                <input id="guestAuthPasswordInput" name="password" type="password" autocomplete="current-password" placeholder="حداقل 8 کاراکتر">
            </label>
            <div id="guestAuthStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="submitGuestAuthButton" class="primary-button">ادامه</button>
            </div>
        </form>
    </dialog>

    <dialog id="authOtpDialog" class="modal">
        <form method="dialog" class="modal-card" id="authOtpForm">
            <div class="modal-card__head">
                <h3 id="authOtpTitle">ورود با کد</h3>
                <button type="button" id="closeAuthOtpDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <p id="authOtpDescription" class="modal-card__copy"></p>
            <label class="field" id="authOtpMobileField">
                <span>شماره موبایل</span>
                <input id="authOtpMobileInput" name="mobile" type="tel" inputmode="numeric" autocomplete="username" placeholder="مثلاً 09123456789">
            </label>
            <label class="field" id="authOtpCodeField" hidden>
                <span>کد تایید</span>
                <input id="authOtpCodeInput" name="code" type="text" inputmode="numeric" maxlength="5" autocomplete="one-time-code" placeholder="کد ۵ رقمی">
            </label>
            <label class="field" id="authOtpDisplayNameField" hidden>
                <span>نام</span>
                <input id="authOtpDisplayNameInput" name="displayName" type="text" maxlength="40" autocomplete="name" placeholder="نام شما">
            </label>
            <label class="field" id="authOtpPasswordField" hidden>
                <span>رمز جدید</span>
                <input id="authOtpPasswordInput" name="newPassword" type="password" autocomplete="new-password" placeholder="حداقل 8 کاراکتر">
            </label>
            <div id="authOtpStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions modal-card__actions--spread">
                <button type="button" id="authOtpResendButton" class="secondary-button" hidden>ارسال مجدد</button>
                <button type="submit" id="submitAuthOtpButton" class="primary-button">ادامه</button>
            </div>
        </form>
    </dialog>

    <dialog id="roomDialog" class="modal">
        <form method="dialog" class="modal-card" id="roomDialogForm">
            <div class="modal-card__head">
                <h3 id="roomDialogTitle">ورود به اتاق</h3>
                <button type="button" id="closeRoomDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <p id="roomDialogDescription" class="modal-card__copy"></p>
            <label class="field">
                <span>کد اتاق</span>
                <input id="roomCodeInput" name="roomCode" type="text" inputmode="numeric" maxlength="4" pattern="\d{4}" placeholder="کد ۴ رقمی اتاق">
            </label>
            <div id="roomDialogStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="submitRoomDialogButton" class="primary-button">ادامه</button>
            </div>
        </form>
    </dialog>

    <dialog id="profileDialog" class="modal">
        <form method="dialog" class="modal-card" id="profileForm">
            <div class="modal-card__head">
                <h3>ویرایش نام</h3>
                <button type="button" id="closeProfileDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <label class="field">
                <span>شماره موبایل</span>
                <input id="profileMobileInput" type="text" readonly>
            </label>
            <label class="field">
                <span>نام</span>
                <input id="profileNameInput" name="displayName" type="text" maxlength="40" autocomplete="name">
            </label>
            <div id="profileStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="saveProfileButton" class="primary-button">ذخیره نام</button>
            </div>
        </form>
    </dialog>

    <dialog id="passwordDialog" class="modal">
        <form method="dialog" class="modal-card" id="passwordForm">
            <div class="modal-card__head">
                <h3>تغییر رمز</h3>
                <button type="button" id="closePasswordDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <label class="field">
                <span>رمز فعلی</span>
                <input id="currentPasswordInput" name="currentPassword" type="password" autocomplete="current-password">
            </label>
            <label class="field">
                <span>رمز جدید</span>
                <input id="newPasswordInput" name="newPassword" type="password" autocomplete="new-password">
            </label>
            <div id="passwordStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="savePasswordButton" class="primary-button">ثبت رمز جدید</button>
            </div>
        </form>
    </dialog>

    <dialog id="roomNameDialog" class="modal">
        <form method="dialog" class="modal-card" id="roomNameForm">
            <div class="modal-card__head">
                <h3>تغییر نام اتاق</h3>
                <button type="button" id="closeRoomNameDialogButton" class="icon-button close-button" aria-label="بستن"></button>
            </div>
            <label class="field">
                <span>نام اتاق</span>
                <input id="roomNameInput" name="name" type="text" maxlength="80">
            </label>
            <div id="roomNameStatus" class="inline-status" hidden></div>
            <div class="modal-card__actions">
                <button type="submit" id="saveRoomNameButton" class="primary-button">ذخیره</button>
            </div>
        </form>
    </dialog>

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
