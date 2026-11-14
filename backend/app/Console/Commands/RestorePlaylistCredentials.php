<?php

namespace App\Console\Commands;

use App\Services\PlaylistCredentialMigration;
use Illuminate\Console\Command;

class RestorePlaylistCredentials extends Command
{
    protected $signature = 'playlists:restore-credentials {backup : Backup criptografado gerado pela migração} {--apply : Restaura somente os campos do backup}';

    protected $description = 'Verifica ou recupera um backup de credenciais, sem sobrescrever alterações posteriores';

    public function handle(PlaylistCredentialMigration $migration): int
    {
        try {
            $count = $migration->restore($this->argument('backup'), (bool) $this->option('apply'));
            $this->info(($this->option('apply') ? 'Configurações recuperadas: ' : 'Configurações recuperáveis: ').$count);
        } catch (\Throwable) {
            $this->error('Recuperação recusada. Confira backup, chaves, banco e alterações posteriores. Nenhuma credencial será exibida.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
