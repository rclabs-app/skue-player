# Contexto atual compartilhado — Skue

Consolidação inicial: 9 de novembro de 2026, America/Recife.
Escopo: este repositório. Leia também os registros recentes em `sessions/`.

## Projeto e fontes

- Player IPTV/VOD para Web e Smart TVs, com processamento local de listas e dados de uso.
- Frontend: Vue 3, TypeScript, Pinia e Vite em `web/`; Android/Capacitor em `web/android/`.
- Backend Laravel em `backend/`; rotas em `backend/routes/api.php`.
- Referências existentes: `GUIDELINES.md`, `README.md`, `docs/DOCUMENTACAO_SISTEMA.md`, `docs/CHANGELOG_WEB.md`, `docs/ANALISE_MVP.md` e `docs/PLANO_CONTINUIDADE_MVP.md`.
- Documentos de planejamento são registros históricos. Seus relatos de testes, infraestrutura ou pendências precisam ser conferidos antes de serem apresentados como atuais.

## Pedidos recuperados do Antigravity

Fonte: sessão local `4d7b92d8-0989-4167-95d2-1d9fd7eb6ac5`, vinculada exatamente a este workspace. Detalhes em `sessions/2026-11-09-antigravity-import.md`.

- Analisar o que falta para publicar o projeto.
- Executar backend e frontend para testes, usando `-- --host` no frontend.
- Reduzir o excesso de neon da interface.
- Pausar a funcionalidade de assinatura para permitir testes no aplicativo.
- Corrigir o travamento de canais de Live TV após ~10 segundos de reprodução no navegador (registrado em `sessions/2026-11-09-2042-antigravity-live-tv-freeze.md`).

Os pedidos de redução de neon e pausa da assinatura no app definem o estado de trabalho que deve ser preservado até nova orientação. Isso não comprova que toda a funcionalidade de assinatura foi desativada nem autoriza publicar esse estado de testes.

## Estado observado na configuração do compartilhamento

- Branch: `main`; HEAD observado: `27300f5` (refinamento de títulos e altura do hero).
- Já existiam alterações locais em 11 arquivos do frontend e uma pasta `.vscode/` não rastreada. A autoria individual não foi presumida e essas alterações foram preservadas.
- Arquivos modificados: `web/index.html`, `web/public/skue-logo.svg`, `web/src/App.vue`, `web/src/style.css`, `web/src/components/LicenseExpiredModal.vue`, `web/src/components/TermsModal.vue`, `web/src/components/VideoPlayer.vue`, `web/src/views/OnboardingView.vue`, `web/src/views/PairView.vue`, `web/src/views/PortalLoginView.vue` e `web/src/views/SettingsView.vue`.
- O diff de `web/src/App.vue` mostra importação e montagem de `LicenseExpiredModal` comentadas para testes. A suspensão completa de assinatura/backend não foi verificada nesta tarefa.
- O diff inclui simplificações visuais na marca, carregamento e erro do player, coerentes com o pedido de reduzir neon.
- Não foram executados build, testes de aplicação, inicialização de serviços ou publicação nesta tarefa de documentação/configuração.

## Continuidade

- Em 10/11 01:07, usuário solicitou commits individuais para cada arquivo com descrição de atualizações. Revisão inclui o estado local completo, a pausa do modal de licença para testes, visual, recuperação live, testes e contexto. Testes (62) e build passaram antes da execução. Registro da organização Git: `sessions/2026-11-10-0107-codex-commits-por-arquivo.md`; consultar os commits para hashes e mensagens. Sem autorização para push/publicação.
- Em 10/11 00:34, usuário informou nova falha após ~5 min; print chega a currentTime 328,529 s, velocidade zero e erro de três respostas sem avanço, sem HTTP 444 visível. Causa ainda não distinguida. Usuário não havia clicado em Tentar Novamente; não presumir retomada manual imediata.
- Novo tratamento limitado para falhas transitórias: até 30 s/oito tentativas com backoff 1/2/4/5 s para rede, respostas vazias ou somente tabelas TS. Mantidos três descartes de mídia repetida, 4xx permanente terminal, stash e latência restaurados. Pausa não consome a janela. Novo log `[Skue Live] HTTP recovery` registra motivo/status/bytes/PES/relógios rejeitados sem URLs.
- Verificação: 62 testes e build passaram; teste simulado de seis minutos recupera três falhas após 5m30 na mesma sessão. HTTP sintético real de 33,41 s com FFmpeg também passou. Isso não confirma a causa nem a reprodução prolongada no Firefox; nenhuma leitura da conta foi feita nesta rodada. Registro: `sessions/2026-11-10-0034-codex-long-live-recovery.md`.
- Estado atual em 10/11 00:20: usuário relatou “Quebrou tudo” após a otimização. Print mostra HTTP 444 e nenhum dado de vídeo antes da decodificação. Revertidas as três otimizações para a configuração confirmada como 90% melhor: stash ativo, reserva de 2 s e intervalo de 100 ms após EOF útil. Recuperação contínua por PES preservada. Não atribuir causa do 444 a um parâmetro específico sem comprovação.
- Verificação da reversão: 57 testes e build passaram; identificador do bundle principal voltou a `index-I_Zpmvjj.js`, igual ao log do build anterior à otimização. Sem leituras externas da conta. Retomada visual no Firefox ainda depende do usuário. Registro: `sessions/2026-11-10-0020-codex-revert-live-optimization.md`.
- As otimizações descritas nos dois itens seguintes foram **revertidas** após regressão; não reaplicá-las com base apenas no teste sintético.
- Em 10/11, usuário confirmou melhora de 90% no uso real, com preload ocasional. Ajuste adicional: customLoader sem IO stash duplicado, reconexão imediata após EOF com avanço e reserva de 6 s (antes 2) ao corrigir atraso acumulado; teto de latência 15 s mantido. Troca: até ~4 s adicionais de distância do ponto mais recente nessa correção. Não há espera inicial obrigatória de 6 s.
- Verificação de 10/11: 60 testes e build passaram; diagnóstico HTTP/FFmpeg de 33,21 s também passou, com três respostas sobrepostas, 28 fragmentos de cada trilha e >29 s entregues de uma entrada de 30 s (antes teste só exigia >27 s). Sem alteração do VOD ou leituras externas da conta nessa rodada. Preloads residuais e causa de rede ainda dependem de observação; registro: `sessions/2026-11-10-0015-codex-live-buffer-efficiency.md`.
- Implementação mais recente (22:51–23:03): live HTTP usa `liveTsLoader.ts` para reabrir respostas no EOF sem concluir o stream nem recriar MediaSource. `liveTsContinuity.ts` remove sobreposição por DTS/PTS de PES completos, preserva timestamps, descarta caudas truncadas e limita memória. Três respostas sem avanço ou 4xx permanente encerram a recuperação; pausa/fechamento cancelam leitura. Worker desativado somente para o customLoader live (funções não clonáveis); VOD conserva padrão/worker. Não há manipulação de campos privados.
- Verificação mais recente: 57 testes e build passaram; diagnóstico HTTP opcional executado separadamente passou em 33,4 s, com três respostas sobrepostas e áudio/vídeo decodificados pelo FFmpeg sem erros. Integração com o canal original também passou: três respostas sequenciais na mesma sessão, 27,9 s de mídia gerada, nenhum erro IO/demux, intervalo regressivo ou lacuna. Nenhum vídeo/credencial salvo. Isso comprova transporte e demux/remux, não renderização no Firefox. Registro: `sessions/2026-11-09-2251-codex-continuous-eof.md`.
- Próxima validação do produto: recarregar a aplicação e reproduzir no Firefox por mais tempo. A fonte continua encerrando conexões; a implementação recupera esse comportamento. Fonte repetida ou relógio reiniciado para valores antigos termina após três respostas sem avanço. Desempenho do processamento no thread principal em Smart TVs ainda não medido.
- Em 22:40, usuário confirmou todas as reproduções paradas e informou que o mesmo canal também para em outro player. Leitura isolada: original EOF em 7,47 s; TS explícito permaneceu ativo por 18,75 s, porém sua confirmação isolada terminou em 8,10 s. Fim HTTP reproduzido fora do Skue mesmo sem concorrência informada; não é falha exclusiva do Firefox. Ainda não distingue servidor/conta/caminho de rede. Nenhum código alterado. Registro: `sessions/2026-11-09-2240-codex-isolated-stream.md`.
- Para identificar por que a fonte encerra conexões, ainda falta comparação em outra rede ou diagnóstico do servidor/conta pelo responsável pela fonte. A recuperação de transporte implementada depois está descrita acima.
- Em 22:27–22:35, seis variantes de leitura autorizadas explicitamente foram comparadas. Original compacta e identificação VLC encerraram em ~7 s; TS explícito permaneceu ativo por 18,75 s no primeiro teste, mas encerrou em 6,13 s na confirmação. HLS retornou 404/405. A hipótese de corrigir apenas a URL foi descartada antes de editar. Não foi comprovada exclusividade da conta durante as leituras; não atribuir a causa ao provedor.
- Verificação adicional: HTTP local real por 31 segundos, processamento MPEG-TS com configuração atual e decodificação em memória passaram; 31 fragmentos de áudio e vídeo sem erros. Isso não cobre MediaSource/worker/renderização do Firefox. Suíte normal 41/41 e build passaram novamente. Nenhum código do produto foi alterado nesta rodada. Registro: `sessions/2026-11-09-2227-codex-live-end-to-end.md`.
- Medição direta autorizada pelo usuário com “Sim” e executada: HTTP 200, `video/mp2t`, 2.922.416 bytes recebidos, EOF após 7,6 segundos, fora do Firefox e do player web, sem salvar vídeo. O encerramento foi reproduzido no leitor HTTP, mas a causa ainda não está identificada. Registro: `sessions/2026-11-09-2221-codex-stream-measurement.md`.
- Última evidência: há reconexões sucessivas sempre como tentativa 1. Corrigida a regra que zerava o contador com três segundos de posição do vídeo; agora há no máximo três reconexões automáticas em uma janela móvel de 60 segundos. Ao exceder, encerra o ciclo e mostra “Conexão instável”, mantendo tentativa manual disponível. Isso limita o loop, mas não resolve a origem das respostas curtas.
- Última verificação de código: 41/41 testes e build passaram. A primeira leitura direta foi recusada pela revisão automática; depois o usuário autorizou explicitamente a medição curta, que foi executada conforme o registro acima. O histórico da restrição está em `sessions/2026-11-09-2211-codex-reconnect-loop.md`.
- Evidência mais recente: o candidato HLS recebeu HTTP 405 no Firefox. A existência de HLS nesse endpoint foi recusada; não inferir que todo HLS do provedor é indisponível.
- Antes de trocar o player, o candidato HLS agora é verificado com timeout de quatro segundos. Em 405, erro, timeout ou conteúdo inválido, mantém o buffer TS e reconecta a fonte original quando necessário. O encerramento do buffer durante a verificação é lembrado para que a reconexão ocorra mesmo sem outro evento `ended`.
- Na revisão da tentativa HLS recusada, 39/39 testes e build passaram. Registro histórico: `sessions/2026-11-09-2201-codex-hls-405.md`.
- Última evidência do Firefox: `Input ended` → `MediaSource onSourceEnded` → `Media ended unexpectedly`. Está confirmado o encerramento da entrada, ainda sem comprovar por que o servidor/conexão fornece uma resposta finita.
- Tratamento anterior (21:53), ainda disponível como fallback para loaders que reportem conclusão: tenta HLS e reabre TS quando o buffer termina, com limite de três reconexões por minuto. O novo loader HTTP live descrito acima não reporta conclusão em cada resposta e mantém o buffer.
- Na revisão de recuperação após EOF, 32/32 testes e build passaram. Casos cobrem a sequência EOF/ended do print, HLS/fallback, novas respostas após reprodução útil, limite de tentativas vazias, cancelamento e pause/play após EOF. Registro histórico: `sessions/2026-11-09-2153-codex-live-http-eof.md`.
- Em 09/11, o usuário informou que o travamento continuava no Firefox e que pause/play gerava uma Promise rejeitada (`AbortError`). A correção anterior ainda não está validada na reprodução real.
- A revisão com loader customizado passou em 21 testes, mas o usuário confirmou que o travamento persistia; não considerar essa revisão uma solução validada. Registro histórico: `sessions/2026-11-09-2126-codex-live-playback.md`.
- Estado histórico da revisão de 21:39: removidos o loader experimental e as intervenções privadas no demuxer/remuxer, restaurando o padrão. A implementação nova de 22:51 usa customLoader público com filtragem de PES, sem recuperar aquelas intervenções privadas. As correções de Promise de play e limpeza de recursos foram mantidas.
- Adicionado diagnóstico numérico sem URLs em `web/src/lib/livePlaybackMonitor.ts`: console `[Skue Live] Standard MPEG-TS pipeline active`, `[Skue Live] Playback stalled` com posição/buffer/quadros/velocidade e `[Skue Live] Input ended` quando a resposta HTTP termina.
- Na revisão de restauração do processamento padrão, 17/17 testes e build passaram. Um teste exercita o loader/demuxer/remuxer reais com 30 segundos de MPEG-TS sintético H.264/AAC; não verifica decodificação nem reprodução real no Firefox. Registro histórico: `sessions/2026-11-09-2139-codex-live-regression.md`.
- Codex e Antigravity devem ler este contexto e registrar o progresso em arquivos de sessão próprios.
- Complemento do usuário: alguns canais travam e outros fecham e voltam à lista; ele não lembra quando começou. O término de live agora mantém o player aberto com mensagem e botão para tentar novamente; no nativo, antes emitia `close`. O HTML5 também passou a tratar `ended`. Verificados 20/20 testes e build; a causa específica no Firefox ainda depende dos logs `[Skue Live]`. Registro: `sessions/2026-11-09-2148-codex-live-ended.md`.
- Antes de retomar a publicação, conferir a análise histórica, o código e a situação real do ambiente. Revisar a pausa da assinatura com o usuário no escopo dessa publicação.
- Para trabalhar simultaneamente, dividir arquivos entre as ferramentas ou usar worktrees separadas. Releia arquivos alterados pela outra ferramenta antes de continuar.
- A configuração compartilha contexto por arquivos. Os chats nativos continuam separados; novas mensagens não são importadas automaticamente.

