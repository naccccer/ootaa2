<?php

declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

use App\Support\RoomService;

$service = RoomService::make();
$count = $service->purgeExpiredRooms();

fwrite(STDOUT, "Expired rooms removed: {$count}\n");
