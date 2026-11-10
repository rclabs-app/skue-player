# Respeitar exclusão administrativa no aplicativo
Data/hora: 2026-11-10 18:34 (America/Recife)
Ferramenta: Codex
Estado: concluído; validação manual no dispositivo pendente
Objetivo: impedir recadastro automático de dispositivo removido no Filament e limpar conteúdo local após confirmação do servidor.
Arquivos em uso: Device.php; migration de identificadores removidos; Api/DeviceController.php; VerifyDeviceToken.php; testes backend; playlist.ts; sqlite.ts; App.vue; OnboardingView.vue; testes frontend; contexto e este registro.
Mudanças e decisões: manter remoção física do dispositivo e cascade existentes; guardar somente hash do identificador em registro interno para não recriar via handshake. Limpar conteúdo somente com resposta explícita DEVICE_REMOVED, nunca em falha de rede. Preservar identidade do app para não contornar a remoção gerando novo identificador. Sem exclusão adicional de dispositivos reais nesta tarefa.
Verificações executadas e resultados: status/diffs, contexto e registros recentes lidos. Confirmado handshake find/create sem distinção de exclusão; initialize ignora erro remoto e carrega playlist_loaded local. Exclusão em lote Filament usa eventos dos modelos.
Pendências e próximo passo: implementar, testar exclusão individual/em lote e limpeza local, aplicar migration específica sem limpeza de dados reais.

## Resultado
- Device registra hash do identificador na exclusão (individual e lote Filament), mantendo deleção física e cascades. Handshake não recria identificador removido. Middleware retorna 410 DEVICE_REMOVED para token assinado de aparelho que não existe mais. Handshake também reconhece token antigo enviado pelo app atualizado quando não há mais registro, mesmo sem marcador histórico.
- App guarda flag de remoção, cancela importação, limpa conteúdo, séries, favoritos, histórico, EPG e cache TMDB no SQLite e persiste imediatamente. Identidade/token e preferências não relacionadas permanecem para não burlar remoção com novo identificador. Estado em memória limpo e player desmontado ao voltar para onboarding.
- Limpeza exige 410 com código DEVICE_REMOVED; offline, 401 ou 410 de outro motivo preservam conteúdo. Mensagem de cadastro removido substitui erro genérico e chave antiga/spinner no onboarding.
- Migration específica aplicada somente ao SQLite local previamente conferido; contagem de dispositivos preservada. Nenhum aparelho real excluído novamente nesta tarefa.
- Backend: 38 testes e 202 asserções passaram; cinco testes novos incluem DeleteBulkAction real via Livewire, cascade de listas, repetição de handshake, token legado, primeiro cadastro e recadastro explícito pelo admin.
- Frontend: suíte final 75 testes passou e um diagnóstico opcional ficou pulado; novos casos cobrem respostas de remoção, offline/401/410 não relacionado, persistência da revogação, recuperação por novo cadastro administrativo e cancelamento de importação. Teste SQLite real com persistência simulada confirma limpeza após recarregar o banco e retenção de preferências/token. Fixture inicial ajustada para respeitar campos NOT NULL do schema.
- Build vue-tsc/Vite e git diff --check passaram. Sem novo APK, commits, push ou publicação. Mudanças preexistentes e pausa da assinatura preservadas.
- Limites: exclusões anteriores à correção não têm marcador histórico se o dispositivo já foi recriado e recebeu novo token; não há evidência suficiente para apagar o registro atual automaticamente. Usuário deve excluí-lo novamente e recarregar/sincronizar o app atualizado. Não há comando remoto offline: limpeza ocorre no próximo contato que confirmar a exclusão. APK antigo requer nova compilação/instalação para limpar cache local.
