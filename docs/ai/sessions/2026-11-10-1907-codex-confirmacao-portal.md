# Cadastrar dispositivo somente após confirmação no portal
Data/hora: 2026-11-10 19:07 (America/Recife)
Ferramenta: Codex
Estado: concluído; validação visual pelo usuário pendente
Objetivo: onboarding gera apenas chave pendente; cadastro devices ocorre ao confirmar MAC/chave no portal Laravel.
Arquivos em uso: migration/model de inscrição pendente e serviço de confirmação; Api/DeviceController.php; PortalController.php web; modelos/testes relacionados; playlist.ts e testes; OnboardingView.vue; contexto e este registro.
Mudanças e decisões: pedido atual substitui criação automática no handshake. Inscrição pendente não aparece no Filament nem inicia trial. Portal valida MAC/chave e promove atomicamente. Identidade e chave pendente estáveis em atualizações; exclusão preserva limpeza local e invalidação dos acessos antigos. Demais alterações preservadas.
Verificações executadas e resultados: status/diffs e contexto relidos; fluxo atual cria devices imediatamente ao handshake, antes de qualquer confirmação web.
Pendências e próximo passo: implementar etapa pendente, confirmação web e polling; testar que abrir/atualizar app nunca cria devices.


## Resultado
- Implementados model/migration PendingDeviceRegistration e DeviceRegistrationService: handshake prepara chave estável, sem criar devices ou iniciar trial; POST do portal valida e confirma em transação.
- API de autenticação legada não promove pendências. Chave inválida/expirada não cria cadastro. Exclusão invalida pendência residual e mantém o fluxo de limpeza e chave nova.
- Store diferencia pendência de cadastro confirmado, não consulta configuração sem token e não carrega cache enquanto pendente, inclusive offline. Onboarding mostra espera pelo portal e acompanha chave atualizada.
- Testes executados: PHPUnit em SQLite isolado, 40 testes e 249 asserções; Vitest, 78 aprovados e um diagnóstico opcional pulado; vue-tsc/Vite build aprovado; git diff --check aprovado.
- Migration específica aplicada ao SQLite local com verificação de banco e contagem de dispositivos preservada. Nenhum dispositivo existente apagado.
- Para testar o registro que já retornou com o fluxo anterior, excluir novamente pelo ADMIN e recarregar onboarding. Deve aparecer no ADMIN somente após envio válido no portal. Validação visual/manual ainda pendente.
- Alterações anteriores preservadas. Sem commits, push ou novo APK.
