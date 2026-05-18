# Ootaa

Ootaa is a lightweight private chat app for small groups with account-based identity. Every user has a real account, and the unique identifier is their Iranian mobile number.

## Current Model

- Signup: `mobile + display name + password`
- Login: `mobile + password`
- Identity and message ownership are user-based, not browser-based
- The same account can join from multiple devices
- Chat UI shows both display name and mobile number
- Room access still works with a 4-digit room code

## Main Features

- Persian RTL interface
- Cookie-based authenticated sessions
- Create a new room or join by 4-digit code
- Send text and multiple files in one message
- Inline preview for images, audio, and video when possible
- Secure file download only for authenticated room members
- Reply, edit, and delete your own messages
- Room rename by the creator account
- Per-account recent rooms in local storage
- Installable PWA shell

## Stack

- Backend: `PHP 8.3`
- Database: `MariaDB / MySQL`
- Frontend: `HTML + CSS + vanilla JavaScript`
- File storage: `storage/uploads`
- Message sync: polling

## Main Files

- [index.php](/c:/xampp/htdocs/ootaa2/index.php): auth-first UI shell
- [api.php](/c:/xampp/htdocs/ootaa2/api.php): API router
- [download.php](/c:/xampp/htdocs/ootaa2/download.php): secure attachment download
- [src/Support/AuthService.php](/c:/xampp/htdocs/ootaa2/src/Support/AuthService.php): account auth and session management
- [src/Support/MobileNumber.php](/c:/xampp/htdocs/ootaa2/src/Support/MobileNumber.php): Iranian mobile normalization and display formatting
- [src/Support/RoomService.php](/c:/xampp/htdocs/ootaa2/src/Support/RoomService.php): room, message, file, and presence logic
- [database/schema.sql](/c:/xampp/htdocs/ootaa2/database/schema.sql): fresh schema for the new account-based model
- [scripts/init_db.php](/c:/xampp/htdocs/ootaa2/scripts/init_db.php): schema bootstrap script
- [scripts/smoke_test.php](/c:/xampp/htdocs/ootaa2/scripts/smoke_test.php): end-to-end smoke test

## Important Reset Note

`database/schema.sql` is intentionally a fresh-start schema. Running `scripts/init_db.php` drops and recreates the app tables:

- `users`
- `auth_sessions`
- `rooms`
- `participants`
- `messages`
- `attachments`

This is expected for the new clean-start model.

## Local Setup

Run these in PowerShell.

### 1. Start Apache

```powershell
C:\xampp\apache_start.bat
```

### 2. Start MariaDB / MySQL

```powershell
C:\xampp\mysql_start.bat
```

### 3. Create the database

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS ootaa2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 4. Recreate the schema

Run this inside `C:\xampp\htdocs\ootaa2`:

```powershell
C:\xampp\php\php.exe scripts\init_db.php
```

Expected result:

```text
Database schema is ready.
```

### 5. Open the app

```text
http://localhost/ootaa2/
```

## Database Configuration

Local defaults are defined in [config/app.php](/c:/xampp/htdocs/ootaa2/config/app.php):

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_DATABASE=ootaa2`
- `DB_USERNAME=root`
- `DB_PASSWORD=` empty

## OTP and SMS

- Local development defaults to fake SMS mode unless `SMSIR_FAKE=false` is provided.
- Real sms.ir settings are read from:
  - `SMSIR_API_KEY`
  - `SMSIR_VERIFY_URL`
  - `SMSIR_TEMPLATE_ID`
- OTP defaults are configurable with:
  - `OTP_LENGTH`
  - `OTP_TTL_SECONDS`
  - `OTP_MAX_ATTEMPTS`
  - `OTP_RESEND_COOLDOWN_SECONDS`

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/register/request-otp`
- `POST /api/auth/register/confirm`
- `POST /api/auth/login`
- `POST /api/auth/login/request-otp`
- `POST /api/auth/login/verify-otp`
- `POST /api/auth/login/complete-profile`
- `POST /api/auth/password/request-otp`
- `POST /api/auth/password/reset`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/account/profile`
- `PATCH /api/account/password`

### Rooms and messages

- `POST /api/room/enter`
- `GET /api/room/bootstrap?code=1234`
- `PATCH /api/room/name`
- `GET /api/room/messages?code=1234`
- `POST /api/room/messages`
- `PATCH /api/messages/{id}`
- `DELETE /api/messages/{id}`

All room and message routes require an authenticated account session.

## Smoke Test

The smoke test covers:

- anonymous `auth/me`
- signup and duplicate signup rejection
- login and wrong-password rejection
- same-account multi-device login
- room creation and room join
- same-account shared message ownership across devices
- room rename permissions
- message send, reply, edit, and delete
- secure attachment access
- profile update and password rotation
- revoked session access after password change
- expired room cleanup

Run:

```powershell
C:\xampp\php\php.exe scripts\init_db.php
C:\xampp\php\php.exe scripts\smoke_test.php
```

Expected result:

```json
{"ok":true,"roomCode":"9841","messageId":1,"attachmentCount":2,"presenceCount":2,"cleanupRemovedRooms":1}
```

## Cleanup Expired Rooms and Files

Rooms expire after 7 days. To purge expired rooms and their files:

```powershell
C:\xampp\php\php.exe scripts\cleanup.php
```

## Upload Limits

If you need larger files, review your `php.ini` values:

- `upload_max_filesize`
- `post_max_size`
- `max_file_uploads`
- `max_execution_time`
