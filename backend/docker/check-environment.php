<?php

// No Laravel bootstrap and no database connection: fail before starting HTTP.
$fail = static function (string $message): never {
    fwrite(STDERR, "Homologação: {$message}\n");
    exit(1);
};
if (getenv('APP_ENV') !== 'production' || ! in_array(strtolower(getenv('APP_DEBUG') ?: ''), ['false', '(false)', '0'], true)) {
    $fail('use APP_ENV=production e APP_DEBUG=false.');
}
$appUrl = getenv('APP_URL') ?: '';
if (! filter_var($appUrl, FILTER_VALIDATE_URL) || parse_url($appUrl, PHP_URL_SCHEME) !== 'https') {
    $fail('configure APP_URL com o endereço HTTPS da homologação.');
}
$key = getenv('APP_KEY') ?: '';
$key = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
if (! is_string($key) || strlen($key) !== 32) {
    $fail('forneça uma APP_KEY válida e estável; ela não será gerada no início.');
}
if (getenv('DB_CONNECTION') !== 'pgsql') {
    $fail('esta imagem exige DB_CONNECTION=pgsql.');
}
$url = getenv('DB_URL') ?: getenv('DATABASE_URL') ?: '';
$parts = $url ? parse_url($url) : [];
if ($parts === false || ($url && ! in_array($parts['scheme'] ?? '', ['postgres', 'postgresql', 'pgsql'], true))) {
    $fail('DB_URL deve ser uma conexão PostgreSQL válida.');
}
$host = $parts['host'] ?? getenv('DB_HOST');
$database = isset($parts['path']) ? ltrim($parts['path'], '/') : getenv('DB_DATABASE');
if (! $host || ! $database) {
    $fail('configure host e banco PostgreSQL externos.');
}
parse_str($parts['query'] ?? '', $query);
$sslmode = $query['sslmode'] ?? getenv('DB_SSLMODE');
if (! in_array($sslmode, ['require', 'verify-ca', 'verify-full'], true)) {
    $fail('a conexão PostgreSQL deve exigir TLS.');
}
