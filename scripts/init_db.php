<?php

declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

use App\Support\Database;

$schema = file_get_contents(base_path('database/schema.sql'));

if ($schema === false) {
    fwrite(STDERR, "schema.sql could not be read.\n");
    exit(1);
}

Database::connection()->exec($schema);

fwrite(STDOUT, "Database schema is ready.\n");

