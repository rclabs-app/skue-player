<?php

namespace Tests\Feature;

use Symfony\Component\Process\Process;
use Tests\TestCase;

class HomologationEnvironmentTest extends TestCase
{
    private function check(array $overrides = []): Process
    {
        $process = new Process([PHP_BINARY, base_path('docker/check-environment.php')], base_path(), array_replace([
            'APP_ENV' => 'production', 'APP_DEBUG' => 'false',
            'APP_URL' => 'https://homologation.example.invalid',
            'APP_KEY' => 'base64:'.base64_encode(str_repeat('x', 32)),
            'DB_CONNECTION' => 'pgsql', 'DB_HOST' => 'database.example.invalid',
            'DB_DATABASE' => 'synthetic_database', 'DB_URL' => '', 'DATABASE_URL' => '', 'DB_SSLMODE' => 'require',
        ], $overrides));
        $process->run();

        return $process;
    }

    public function test_valid_external_postgres_environment_does_not_connect_or_generate_a_key(): void
    {
        $process = $this->check();
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
        $this->assertSame('', $process->getOutput());
    }

    public function test_invalid_environment_is_rejected_without_disclosing_values(): void
    {
        foreach ([
            ['APP_KEY' => ''], ['APP_KEY' => 'synthetic-invalid-secret'],
            ['DB_CONNECTION' => 'sqlite'], ['DB_SSLMODE' => 'disable'],
            ['APP_ENV' => 'local'], ['APP_DEBUG' => 'true'], ['DB_HOST' => ''],
            ['APP_URL' => 'http://localhost'],
            ['APP_DEBUG' => 'unexpected-value'], ['APP_DEBUG' => 'off'],
            ['DB_URL' => 'not-a-postgres-url'],
            ['DB_URL' => 'postgresql://synthetic:synthetic-secret@db.example.invalid/test?sslmode=disable'],
        ] as $overrides) {
            $process = $this->check($overrides);
            $this->assertFalse($process->isSuccessful());
            $this->assertStringContainsString('Homologação:', $process->getErrorOutput());
            $this->assertStringNotContainsString('synthetic-secret', $process->getErrorOutput());
            $this->assertStringNotContainsString('synthetic-invalid-secret', $process->getErrorOutput());
        }
    }

    public function test_neon_style_url_with_tls_is_accepted_without_accessing_it(): void
    {
        $this->assertTrue($this->check([
            'DB_HOST' => '', 'DB_DATABASE' => '',
            'DB_URL' => 'postgresql://synthetic:synthetic-secret@db.example.invalid/test?sslmode=require',
        ])->isSuccessful());
    }

    public function test_neon_integration_url_is_accepted_and_insecure_tls_is_rejected(): void
    {
        $environment = [
            'DB_HOST' => '', 'DB_DATABASE' => '',
            'DATABASE_URL' => 'postgresql://synthetic:synthetic-secret@db.example.invalid/test?sslmode=require',
        ];
        $this->assertTrue($this->check($environment)->isSuccessful());

        $process = $this->check(array_replace($environment, [
            'DATABASE_URL' => 'postgresql://synthetic:synthetic-secret@db.example.invalid/test?sslmode=disable',
        ]));
        $this->assertFalse($process->isSuccessful());
        $this->assertStringNotContainsString('synthetic-secret', $process->getErrorOutput());
    }

    public function test_explicit_db_url_takes_precedence_over_integration_url(): void
    {
        $this->assertFalse($this->check([
            'DB_URL' => 'postgresql://synthetic:synthetic-secret@db.example.invalid/test?sslmode=disable',
            'DATABASE_URL' => 'postgresql://synthetic:synthetic-secret@other.example.invalid/test?sslmode=require',
        ])->isSuccessful());
    }

    public function test_laravel_uses_integration_url_when_explicit_url_is_missing_or_empty(): void
    {
        $script = <<<'PHP'
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo json_encode([
    'pgsql' => config('database.connections.pgsql.url'),
    'sqlite' => config('database.connections.sqlite.url'),
]);
PHP;
        $integration = 'postgresql://synthetic:synthetic-secret@db.example.invalid/test?sslmode=require';
        $explicit = 'postgresql://synthetic:synthetic-secret@explicit.example.invalid/test?sslmode=require';
        foreach ([false, '', $explicit] as $dbUrl) {
            $process = new Process([PHP_BINARY, '-r', $script], base_path(), [
                'APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql',
                'DB_URL' => $dbUrl, 'DATABASE_URL' => $integration,
            ]);
            $process->mustRun();
            $result = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame($dbUrl ?: $integration, $result['pgsql']);
            $this->assertNotSame($integration, $result['sqlite']);
        }
    }
}
