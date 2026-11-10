# Commits individuais e push
Data/hora: 2026-11-10 19:36 (America/Recife)
Ferramenta: Codex
Estado: alterações enviadas; registro desta execução finalizado
Objetivo: executar commits por arquivo e push, conforme autorização explícita do usuário.
Arquivos em uso: 45 arquivos alterados/novos/excluídos no estado inicial; somente este registro recebe edição adicional.
Decisões: preservar conteúdos atuais, mensagens em português com resumo das atualizações; branch main, destino origin/main. Nenhum arquivo ignorado incluído.
Verificações: status, diff e índice revisados; índice inicialmente vazio, sem conflitos. Resultado da tarefa imediatamente anterior: backend 40 testes/249 asserções, frontend 78 testes e um diagnóstico opcional pulado; build aprovado. Diff check aprovado nesta tarefa.
Resultado: 45 commits individuais criados e conferidos (um caminho e mensagem por commit). Push origin main concluído até 10b19a26, sem force. Este registro é salvo em commit separado e enviado em seguida. Testes não repetidos: nenhum código foi editado nesta tarefa.

## Commits das alterações

- e0cd973d — README.md — Documenta portal Laravel e build local do APK
- 8216bfb3 — backend/app/Http/Controllers/Api/DeviceController.php — Prepara ativação pendente no handshake
- 95ed5ab2 — backend/app/Http/Controllers/Api/PortalController.php — Compartilha regras de listas na API do portal
- e7fdde57 — backend/app/Http/Controllers/PortalController.php — Confirma dispositivos e gerencia listas no portal Laravel
- 53bf9f67 — backend/app/Http/Middleware/VerifyDeviceToken.php — Identifica tokens de dispositivos removidos
- 2f8bf38d — backend/app/Models/Device.php — Registra exclusão de dispositivos
- 34ba35e9 — backend/resources/views/portal/dashboard.blade.php — Amplia gestão de listas no painel Laravel
- 4c5ea672 — backend/routes/api.php — Expõe seleção de lista principal pelo dispositivo
- d87a5b8c — backend/routes/web.php — Adiciona rotas de edição de listas no portal
- b239507c — backend/tests/Feature/DeviceActivationTest.php — Testa handshake sem cadastro automático
- c1dbdee7 — docs/ai/CONTEXT.md — Atualiza contexto compartilhado do portal e ativação
- f686e31e — web/src/App.vue — Retorna ao onboarding após exclusão administrativa
- 85aba78d — web/src/components/LicenseExpiredModal.vue — Direciona QR de ativação ao portal Laravel
- b5767cdf — web/src/lib/sqlite.ts — Limpa conteúdo local de dispositivos removidos
- 7696d938 — web/src/router/index.ts — Remove rotas duplicadas do portal Vue
- 322cf612 — web/src/stores/playlist.ts — Sincroniza exclusão e ativação pendente no app
- 450d37a6 — web/src/views/OnboardingView.vue — Amplia onboarding e exibe ativação pendente
- a581648c — web/src/views/PortalDashboardView.vue — Remove painel duplicado do portal Vue
- e9a42db6 — web/src/views/PortalLoginView.vue — Remove login duplicado do portal Vue
- 7e4ebe44 — web/src/views/SettingsView.vue — Aponta configurações para o portal Laravel
- ee4d6380 — backend/app/Models/PendingDeviceRegistration.php — Modela inscrições pendentes de dispositivos
- b35e2626 — backend/app/Services/DevicePlaylistService.php — Centraliza validações e gravação de listas
- 79e96ce6 — backend/app/Services/DeviceRegistrationService.php — Confirma cadastro somente pelo portal
- d667e106 — backend/database/migrations/2026_11_10_183400_create_removed_devices_table.php — Cria registro de identificadores removidos
- 83773dc2 — backend/database/migrations/2026_11_10_190700_create_pending_device_registrations_table.php — Cria inscrições pendentes de dispositivos
- 7a7c0aa3 — backend/resources/views/portal/edit.blade.php — Adiciona edição de listas no portal
- c819062a — backend/resources/views/portal/playlist_form.blade.php — Compartilha formulário de listas M3U e Xtream
- 6e3be63e — backend/tests/Feature/DeviceRemovalTest.php — Testa exclusão e confirmação de novo acesso
- ae7e0767 — backend/tests/Feature/LaravelPortalTest.php — Testa gestão unificada de listas
- 2c7c22d4 — docs/ANALISE_COMPETITIVA_PORTAL.md — Documenta comparação dos portais concorrentes
- e87b86d5 — docs/ai/sessions/2026-11-10-1100-antigravity-gerar-apk.md — Registra sessão: Gerar APK Android TV
- 1193ad86 — docs/ai/sessions/2026-11-10-1111-codex-apk-api-local.md — Registra sessão: Falha de ativação no APK Android
- 68a68677 — docs/ai/sessions/2026-11-10-1651-codex-analise-portais.md — Registra sessão: Comparação de portais e oportunidades do Skue
- d5cb67f8 — docs/ai/sessions/2026-11-10-1750-codex-portal-laravel.md — Registra sessão: Consolidar gerenciamento no portal Laravel
- 5b55f1aa — docs/ai/sessions/2026-11-10-1810-codex-portal-direto.md — Registra sessão: Portal somente pelo Laravel
- f9a501a4 — docs/ai/sessions/2026-11-10-1817-codex-acesso-filament.md — Registra sessão: Acesso ao painel Filament
- 32f3af81 — docs/ai/sessions/2026-11-10-1819-codex-redefinir-acesso.md — Registra sessão: Redefinição de acesso administrativo local
- a84beb05 — docs/ai/sessions/2026-11-10-1834-codex-exclusao-dispositivo.md — Registra sessão: Respeitar exclusão administrativa no aplicativo
- 375c47a7 — docs/ai/sessions/2026-11-10-1847-codex-renovar-key.md — Registra sessão: Nova chave após remoção do acesso
- 2bc0df9e — docs/ai/sessions/2026-11-10-1853-codex-onboarding-maior.md — Registra sessão: Ampliar cartão de configuração
- f166b8b9 — docs/ai/sessions/2026-11-10-1907-codex-confirmacao-portal.md — Registra sessão: Cadastrar dispositivo somente após confirmação no portal
- 11532a26 — web/src/lib/deviceContent.spec.ts — Testa limpeza persistente do conteúdo local
- 9b0ab8c0 — web/src/stores/playlistRemoval.spec.ts — Testa remoção e espera por confirmação no app
- 8467e205 — web/src/utils/portal.spec.ts — Testa endereços do portal por ambiente
- 10b19a26 — web/src/utils/portal.ts — Centraliza endereço do portal Laravel

O push também incluiu commits anteriores que ainda estavam somente na branch local. Nenhum arquivo ignorado ou banco local foi adicionado.
