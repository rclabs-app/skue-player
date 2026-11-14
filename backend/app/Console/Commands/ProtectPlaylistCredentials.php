<?php

namespace App\Console\Commands;

use App\Services\PlaylistCredentialMigration;
use Illuminate\Console\Command;

class ProtectPlaylistCredentials extends Command
{
    protected $signature = 'playlists:protect-credentials {--apply : Cria backup criptografado e converte os registros legados}';

    protected $description = 'Inspeciona ou protege as credenciais de playlists sem exibir seus valores';

    public function handle(PlaylistCredentialMigration $migration): int
    {
        try {
            if (! $this->option('apply')) {
                $this->info('Configurações pendentes de proteção: '.$migration->pendingCount());
                $this->comment('Somente inspeção. Use --apply durante manutenção, após conferir backup e chaves.');
            } else {
                $result = $migration->migrate();
                $this->info('Configurações protegidas: '.$result['count']);
                if ($result['backup']) {
                    $this->line('Backup criptografado: '.$result['backup']);
                }
            }
        } catch (\Throwable) {
            $this->error('Operação não concluída. Nenhum valor de credencial será exibido. Confira as chaves e o armazenamento protegido.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
