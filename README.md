# Ootaa

Ootaa is a lightweight private chat app for small groups. A user only needs a display name. They can either join an existing room with a 4-digit code or leave the code empty to create a new room.

## Current Features

- Persian RTL interface
- No signup and no admin panel
- Message ownership is tied to the same browser after refresh
- Send text and multiple files in one message
- Inline preview for images, audio, and video when possible
- Secure download flow for non-inline files
- Edit and delete only your own messages
- Upload progress for media and file sends
- Lightweight presence indicator in the room header
- Rooms and files expire after 3 days
- Installable PWA with a cached app shell

When a message is deleted, it is removed from the visible chat timeline for participants.

## Stack

- Backend: `PHP 8.3`
- Database: `MariaDB / MySQL`
- Frontend: `HTML + CSS + vanilla JavaScript`
- File storage: `storage/uploads`
- File protection: attachments are not public; they are served through `GET /file/{id}` after room membership is checked
- Message sync: simple polling

## Main Files

- [index.php](/c:/xampp/htdocs/ootaa2/index.php): main page and UI shell
- [api.php](/c:/xampp/htdocs/ootaa2/api.php): API router
- [download.php](/c:/xampp/htdocs/ootaa2/download.php): secure attachment download
- [src/Support/RoomService.php](/c:/xampp/htdocs/ootaa2/src/Support/RoomService.php): room, message, file, presence, and cleanup logic
- [database/schema.sql](/c:/xampp/htdocs/ootaa2/database/schema.sql): database schema
- [scripts/init_db.php](/c:/xampp/htdocs/ootaa2/scripts/init_db.php): schema bootstrap script
- [scripts/cleanup.php](/c:/xampp/htdocs/ootaa2/scripts/cleanup.php): expired room and file cleanup
- [scripts/smoke_test.php](/c:/xampp/htdocs/ootaa2/scripts/smoke_test.php): end-to-end smoke test
- [manifest.webmanifest](/c:/xampp/htdocs/ootaa2/manifest.webmanifest): PWA manifest
- [sw.js](/c:/xampp/htdocs/ootaa2/sw.js): service worker for app-shell caching

## Local Setup

Run the following steps in PowerShell.

### 1. Start Apache

```powershell
C:\xampp\apache_start.bat
```

Expected result:

- If Apache is stopped, it starts.
- If it is already running, you may see a startup message or a port warning. If `httpd.exe` is already active, Apache is available.

### 2. Start MariaDB / MySQL

```powershell
C:\xampp\mysql_start.bat
```

Expected result:

- If MySQL is stopped, it starts.
- If it is already running, a warning is acceptable as long as `mysqld.exe` is active.

### 3. Create the database

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS ootaa2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Expected result:

- Usually no output if the command succeeds.

### 4. Create the tables

Run this inside the project directory `C:\xampp\htdocs\ootaa2`:

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

## Important PHP Note

On this machine, the plain `php` command may point to a different configuration. For all CLI work in this project, prefer:

```powershell
C:\xampp\php\php.exe
```

## Database Configuration

Local defaults are defined in [config/app.php](/c:/xampp/htdocs/ootaa2/config/app.php):

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_DATABASE=ootaa2`
- `DB_USERNAME=root`
- `DB_PASSWORD=` empty

For a real server, set environment variables or adjust the config to match your deployment environment.

## Smoke Test

This checks the core flow:

- create a room
- join from a second browser session
- send text plus two attachments
- edit a message
- block deletion from a different browser
- delete as the owner
- verify attachment access control
- clean up an expired room

Run:

```powershell
C:\xampp\php\php.exe scripts\smoke_test.php
```

Expected result:

```json
{"ok":true,"roomCode":"1419","messageId":3,"attachmentCount":2,"secondParticipantMessages":1,"presenceCount":2,"cleanupRemovedRooms":1}
```

## Manual QA Checklist

### Create a new room

1. Open `http://localhost/ootaa2/`
2. Enter a display name
3. Leave the room code empty
4. Submit the form

Expected result:

- You enter the chat screen
- A 4-digit room code is shown

### Join an existing room

1. Open the same room code in another browser or private window
2. Enter a different display name
3. Submit the form

Expected result:

- You enter the same room immediately

### Keep ownership after refresh

1. Send a message
2. Refresh the page

Expected result:

- The same browser can still edit and delete its own message

### Upload multiple files

1. Choose two files
2. Optionally add text
3. Send the message

Expected result:

- Both files appear in the same message
- Images, audio, and video preview inline when supported
- Other files show a download button
- Upload progress is visible during the send

### Edit and delete

1. Edit one of your own messages
2. Delete one of your own messages

Expected result:

- Edit works only for your own messages
- Delete removes the message from the visible chat timeline

### Scroll behavior

1. Scroll upward in a busy room
2. Receive a new message from another participant

Expected result:

- The list should not jump unexpectedly
- A jump-to-latest control should appear

### File protection

1. Open an attachment while you are inside the room
2. Open the same attachment URL in a browser that is not a room member

Expected result:

- A room member can access the file
- A non-member receives an access error

### PWA install

1. Open the app in a Chromium-based browser
2. Check installability
3. Install the app
4. Reload once or twice

Expected result:

- The app is installable
- The installed app opens correctly
- Repeat loads feel faster because the shell is cached

## Cleanup Expired Rooms and Files

Rooms and files expire after 3 days. To remove expired data from disk and the database:

```powershell
C:\xampp\php\php.exe scripts\cleanup.php
```

Expected result:

```text
Expired rooms removed: 0
```

If expired rooms exist, the number will be greater than zero.

### Suggested Windows Task Scheduler job

Create a daily scheduled task that runs:

```powershell
C:\xampp\php\php.exe C:\xampp\htdocs\ootaa2\scripts\cleanup.php
```

## Increasing Upload Limits

If you want to allow larger files, review and adjust:

- `upload_max_filesize`
- `post_max_size`
- `max_file_uploads`
- `max_execution_time`

These are usually configured in `php.ini`.
