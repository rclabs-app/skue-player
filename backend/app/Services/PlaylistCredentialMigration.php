<?php

namespace App\Services;

use App\Casts\ProtectedPlaylistValue;
use App\Exceptions\PlaylistProtectionException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/** Explicit offline maintenance; backups contain only affected credential columns. */
class PlaylistCredentialMigration
{
    private const TARGETS = [
        'device_playlists' => ['key' => 'id', 'owner' => 'device_id', 'fields' => ['url', 'username', 'password']],
        'pairing_codes' => ['key' => 'code', 'owner' => 'expires_at', 'fields' => ['payload']],
    ];

    public function pendingCount(): int
    {
        $pending = 0;
        foreach (self::TARGETS as $table => $target) {
            foreach (DB::table($table)->orderBy($target['key'])->cursor() as $row) {
                if ($this->needsEncryption((array) $row, $target['fields'])) {
                    $pending++;
                }
            }
        }

        return $pending;
    }

    /** @return array{count: int, backup: ?string} */
    public function migrate(): array
    {
        return DB::transaction(function () {
            $changes = [];
            foreach (self::TARGETS as $table => $target) {
                foreach (DB::table($table)->orderBy($target['key'])->lockForUpdate()->get() as $row) {
                    $raw = (array) $row;
                    if (! $this->needsEncryption($raw, $target['fields'])) {
                        continue;
                    }
                    $before = array_intersect_key($raw, array_flip($target['fields']));
                    $after = [];
                    foreach ($before as $field => $value) {
                        $after[$field] = $value === null || str_starts_with($value, ProtectedPlaylistValue::PREFIX)
                            ? $value : ProtectedPlaylistValue::encode($value);
                    }
                    $changes[] = ['table' => $table, 'key' => $raw[$target['key']], 'owner' => $raw[$target['owner']], 'before' => $before, 'after' => $after];
                }
            }
            if ($changes === []) {
                return ['count' => 0, 'backup' => null];
            }

            // Backup is authenticated, written exclusively and read back before mutation.
            $backup = $this->writeBackup([
                'format' => 'skue-playlist-credentials-v1',
                'database' => $this->databaseIdentity(),
                'rows' => array_map(fn ($row) => [
                    'table' => $row['table'], 'key' => $row['key'], 'owner' => $row['owner'],
                    'before' => $row['before'], 'expected' => $this->fingerprint($row['after'], self::TARGETS[$row['table']]['fields']),
                ], $changes),
            ]);
            foreach ($changes as $row) {
                $target = self::TARGETS[$row['table']];
                $query = DB::table($row['table'])->where($target['key'], $row['key'])->where($target['owner'], $row['owner']);
                $query->update($row['after']);
                $stored = (array) $query->first();
                foreach ($target['fields'] as $field) {
                    if (ProtectedPlaylistValue::decode($stored[$field]) !== ProtectedPlaylistValue::decode($row['before'][$field])) {
                        throw new PlaylistProtectionException;
                    }
                }
            }

            return ['count' => count($changes), 'backup' => $backup];
        });
    }

    /** Refuses to resurrect deleted rows or overwrite credentials changed after migration. */
    public function restore(string $path, bool $apply = false): int
    {
        try {
            $contents = file_get_contents($path);
            if ($contents === false) {
                throw new RuntimeException;
            }
            $data = json_decode(Crypt::decryptString($contents), true, flags: JSON_THROW_ON_ERROR);
            if (($data['format'] ?? null) !== 'skue-playlist-credentials-v1'
                || ($data['database'] ?? null) !== $this->databaseIdentity()
                || ! is_array($data['rows'] ?? null)) {
                throw new RuntimeException;
            }
        } catch (\Throwable) {
            throw new PlaylistProtectionException;
        }

        return DB::transaction(function () use ($data, $apply) {
            foreach ($data['rows'] as $row) {
                $target = self::TARGETS[$row['table']] ?? throw new PlaylistProtectionException;
                $current = DB::table($row['table'])->where($target['key'], $row['key'])->where($target['owner'], $row['owner'])->lockForUpdate()->first();
                if (! $current || ! hash_equals($row['expected'], $this->fingerprint((array) $current, $target['fields']))) {
                    throw new RuntimeException('Recuperação recusada: há registros removidos ou credenciais alteradas após o backup.');
                }
                foreach ($target['fields'] as $field) {
                    ProtectedPlaylistValue::decode($row['before'][$field]);
                }
            }
            if ($apply) {
                foreach ($data['rows'] as $row) {
                    $target = self::TARGETS[$row['table']];
                    DB::table($row['table'])->where($target['key'], $row['key'])->where($target['owner'], $row['owner'])->update($row['before']);
                }
            }

            return count($data['rows']);
        });
    }

    private function needsEncryption(array $row, array $fields): bool
    {
        $pending = false;
        foreach ($fields as $field) {
            $value = $row[$field];
            if ($value !== null && ! str_starts_with($value, ProtectedPlaylistValue::PREFIX)) {
                $pending = true;
            }
            ProtectedPlaylistValue::decode($value);
        }

        return $pending;
    }

    private function databaseIdentity(): string
    {
        return hash('sha256', DB::connection()->getDriverName().'|'.DB::connection()->getDatabaseName());
    }

    private function fingerprint(array $row, array $fields): string
    {
        return hash('sha256', json_encode(array_map(fn ($field) => $row[$field], $fields), JSON_THROW_ON_ERROR));
    }

    protected function writeBackup(array $data): string
    {
        $directory = storage_path('app/private/playlist-credential-backups');
        if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            throw new PlaylistProtectionException;
        }
        $path = $directory.'/'.Str::uuid().'.enc';
        $json = json_encode($data, JSON_THROW_ON_ERROR);
        $encrypted = Crypt::encryptString($json);
        $oldMask = umask(0077);
        try {
            $handle = fopen($path, 'x+b');
        } finally {
            umask($oldMask);
        }
        if ($handle === false) {
            throw new PlaylistProtectionException;
        }
        try {
            if (! chmod($path, 0600) || fwrite($handle, $encrypted) !== strlen($encrypted) || ! fflush($handle)) {
                throw new PlaylistProtectionException;
            }
            if (function_exists('fsync') && ! fsync($handle)) {
                throw new PlaylistProtectionException;
            }
            rewind($handle);
            $verified = stream_get_contents($handle);
            if ($verified === false || ! hash_equals($json, Crypt::decryptString($verified))) {
                throw new PlaylistProtectionException;
            }
        } finally {
            fclose($handle);
        }

        return $path;
    }
}
