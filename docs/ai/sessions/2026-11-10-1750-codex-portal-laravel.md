# Consolidar gerenciamento no portal Laravel
Data/hora: 2026-11-10 17:50 (America/Recife)
Ferramenta: Codex
Estado: implementação concluída e verificações aprovadas; validação visual pendente
Objetivo: completar edição, ativação/desativação e principal no Blade; compartilhar regras de listas com a API; remover telas do portal Vue e encaminhar links ao Laravel.
Arquivos em uso: controllers Portal web/API; serviço compartilhado de listas; routes/web.php; templates portal/dashboard e formulário novo; testes de portal; web/src/router/index.ts, views PortalLogin/PortalDashboard (remoção), utils/portal.ts (novo), OnboardingView, SettingsView, LicenseExpiredModal, vite.config.ts; README e docs/ai/CONTEXT.md; este registro.
Mudanças e decisões: preservar alterações preexistentes em README/contexto/onboarding e demais registros. API do player mantida; sem reativação de cobrança ou mudanças de licença. Registros recentes concluídos relidos; sem sobreposição ativa identificada.
Verificações executadas e resultados: estado Git e diffs conferidos; rastreados fluxos Blade por sessão e API por token, seleção principal pelo app, QR e proxy do Vite.
Pendências e próximo passo: implementar, testar isolamento entre aparelhos e regras compartilhadas, compilar frontend e documentar roteamento.

Escopo complementar: seleção principal do player usa token de dispositivo, diferente do token do antigo portal. Será criada rota autenticada de dispositivo para essa ação, mantendo o serviço compartilhado e a compatibilidade das rotas API antigas. Arquivos adicionais: Api/DeviceController.php, routes/api.php e web/src/stores/playlist.ts.

## Resultado
- Serviço DevicePlaylistService compartilha validação/persistência, senha opcional na edição Xtream, isolamento por dispositivo e escolha única de principal ativa. Operações transacionais; desativação/exclusão promovem outra ativa; todas inativas deixam nenhuma principal.
- Portal Blade ganhou formulário compartilhado, página de edição, controle ativo/inativo e ação principal. URLs privadas não são mais mostradas no resumo; senha existente nunca é preenchida no HTML.
- Telas PortalLoginView/PortalDashboardView e rotas Vue removidas. API antiga preservada por compatibilidade; player usa rota de dispositivo com seu token próprio para principal.
- getPortalUrl centraliza VITE_PORTAL_URL e evita host interno do WebView no fallback nativo. Onboarding, configurações e QR do modal usam esse helper; App.vue não foi alterado e modal segue pausado.
- Vite encaminha /portal e /build ao backend preservando Host para redirects LAN. README explica build dos assets Blade e roteamento de produção; contexto atualizado após releitura.
- Backend: 33 testes/173 asserções passaram em SQLite em memória; oito testes novos cobrem sessão, guests, validação comum, senha, principal, ativos, isolamento e token do player. PHPUnit executado sem cache de resultados após aviso de permissão no cache da rodada inicial.
- Frontend: 65 testes passaram; um diagnóstico HTTP opcional pulado. Três novos testes verificam URL configurada, web e nativa. Build vue-tsc/Vite passou; build dos assets Laravel passou (aviso opcional do plugin de fontes sobre fontaine, sem falha).
- HTTP real somente leitura via http://192.168.0.27:5173: /portal respondeu 200 com Blade; action do formulário preservou IP/porta LAN; CSS/JS do Laravel responderam 200; /portal/dashboard sem sessão redirecionou ao login na mesma origem. Nenhuma conta ou playlist real criada/alterada nas verificações HTTP.
- Sem novo APK, commits, push ou publicação. Build web normal usa ambiente de produção existente; para APK local, usar as variáveis documentadas. Autenticação/handshake e preços apontados no relatório competitivo não foram reestruturados neste escopo.
- Pendências: validação visual/manual no navegador/celular e novo APK para incorporar mudanças do player. A suíte e o HTTP não comprovam aparência nem funcionamento fora da rede local.
