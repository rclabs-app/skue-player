# Commits e push da adequação do produto
Data/hora: 2026-11-12 15:32 (America/Recife)
Ferramenta: Codex
Estado: alterações enviadas; registro final preparado para versionamento
Objetivo: revisar, preparar commits individuais e enviar a origin/main conforme pedido explícito do usuário.
Arquivos em uso: todos os arquivos alterados/não rastreados exibidos pelo Git nesta sessão, incluindo este registro; sem mudanças funcionais adicionais planejadas.
Mudanças e decisões: preservar um commit por arquivo lógico com título/corpo em português; agrupar os dois caminhos da mudança da fixture em um único commit. Nenhuma exclusão adicional solicitada; arquivos ignorados, ambientes, bancos e binários fora do escopo. Pedido atual inclui execução e push; não é somente planejamento. Skills prepare-commit/make-commit usadas para revisão, mensagens e isolamento por caminho.
Verificações executadas e resultados: branch main, HEAD base e46d855; remoto origin conferido; índice sem alterações preexistentes. Contexto/registros recentes/status/diff consultados. Código já validado na tarefa anterior com 98 testes aprovados, um diagnóstico opcional pulado e build web; sem nova execução de testes nesta tarefa Git.
Resultado: 39 commits individuais das alterações revisadas criados e enviados a origin/main. Cada commit teve caminhos, mensagem e conteúdo conferidos; renomeação lógica da fixture reuniu somente os dois caminhos correspondentes. Após o primeiro push, HEAD e origin/main ficaram sincronizados (0 0). Este registro constitui o 40º commit previsto e será enviado em seguida; sua confirmação final fica na resposta da tarefa.
Verificação final do conjunto: git diff --check aprovado; somente este registro permaneceu não rastreado antes do commit final. Nenhum teste/build foi repetido nesta tarefa Git; verificações de 98 testes e build são da tarefa anterior, sem alteração funcional posterior. Sem force-push, bypass de hooks ou alteração de pagamentos/assinatura.
Pendências funcionais preservadas: validação visual/dispositivo, novo APK e futura restrição do proxy de listas permanecem fora desta tarefa.

## Commits das alterações enviados no primeiro push

1. `3ef3fe3` — `backend/resources/views/layouts/app.blade.php` — Esclarece a licença de uso no rodapé institucional
2. `37ea72d` — `backend/resources/views/welcome.blade.php` — Ajusta a apresentação institucional e remove a oferta vitalícia
3. `87aa422` — `web/public/test.m3u` → `web/src/lib/__fixtures__/sample-playlist.m3u` — Move a playlist fictícia para fora da distribuição pública
4. `47a818c` — `web/src/types/m3u.ts` — Identifica canais com metadado tvgId
5. `41eced7` — `web/src/lib/playlistUserData.ts` — Descarta configuração antiga de programação nas importações
6. `3d01f6f` — `web/src/lib/sqlite.ts` — Migra o SQLite para remover dados de programação
7. `79f5a85` — `web/src/lib/indexeddb.ts` — Remove programação do armazenamento IndexedDB
8. `bc30e3e` — `web/src/lib/m3u-parser.ts` — Simplifica o parser M3U sem extração de programação
9. `8224a8e` — `web/src/workers/m3u-parser.worker.ts` — Remove extração de programação do worker de listas
10. `a833d72` — `web/src/stores/playlist.ts` — Remove sincronização automática de programação
11. `3c867b2` — `web/src/views/HomeView.vue` — Remove programação dos destaques da página inicial
12. `a003c5d` — `web/src/views/LiveView.vue` — Simplifica o destaque de canais sem programação
13. `fe7425b` — `web/src/views/SettingsView.vue` — Retira configurações de programação e rótulo vitalício
14. `23a06f3` — `web/src/App.vue` — Remove o atalho comentado do guia de programação
15. `3d4b22c` — `web/src/router/index.ts` — Remove a rota obsoleta do guia
16. `57d8093` — `web/src/composables/useTvRemote.ts` — Remove a ação de guia sem consumidor
17. `49a681e` — `web/src/services/epg.service.ts` — Remove o serviço de programação
18. `0204e03` — `web/src/types/epg.ts` — Remove o tipo de programas da grade
19. `c5f26a4` — `web/src/workers/epg-parser.worker.ts` — Remove o worker de leitura XMLTV
20. `379b6ab` — `web/src/views/GuideView.vue` — Remove a tela de guia de programação
21. `b988040` — `web/src/lib/deviceContent.spec.ts` — Valida migração do banco sem perder dados do dispositivo
22. `98fdf56` — `web/src/lib/playlistImport.spec.ts` — Valida importação de listas sem programação
23. `25c094e` — `web/src/stores/playlistRemoval.spec.ts` — Atualiza os testes de remoção de dispositivo sem programação
24. `5a35fad` — `web/src/views/catalogHero.spec.ts` — Valida os destaques sem dependência de programação
25. `5d5a039` — `README.md` — Atualiza a documentação para o produto sem programação
26. `f18b440` — `GUIDELINES.md` — Atualiza diretrizes para o escopo sem programação
27. `2abd953` — `docs/ai/ANALISE_LANCAMENTO_2026-11-12.md` — Documenta a análise técnica das condições de lançamento
28. `96c6b85` — `docs/ai/PLANO_ADEQUACAO_LANCAMENTO.md` — Documenta as etapas de adequação e o escopo sem pagamentos
29. `5d361a7` — `docs/ai/CONTEXT.md` — Consolida decisões e estado verificado da adequação
30. `4ed6d4b` — `docs/ai/sessions/2026-11-11-1506-codex-executar-apps.md` — Registra a execução local das aplicações em 11 de novembro
31. `30f0fe3` — `docs/ai/sessions/2026-11-12-1310-codex-organizacao-publicacao.md` — Registra a análise de organização da publicação
32. `9709edf` — `docs/ai/sessions/2026-11-12-1317-codex-executar-apps.md` — Registra a execução local das aplicações em 12 de novembro
33. `10dbcf3` — `docs/ai/sessions/2026-11-12-1321-codex-dominio-site-publico.md` — Registra o destino institucional do domínio Skue
34. `5a43875` — `docs/ai/sessions/2026-11-12-1338-codex-frentes-player-web.md` — Registra as frentes do produto e avaliação do player web
35. `fc645a6` — `docs/ai/sessions/2026-11-12-1350-codex-analise-lancamento.md` — Registra a sessão de análise das condições de lançamento
36. `db44d97` — `docs/ai/sessions/2026-11-12-1418-codex-planejamento-pendencias.md` — Registra o planejamento de adequação sem pagamentos
37. `04e73c9` — `docs/ai/sessions/2026-11-12-1432-codex-etapa1-apresentacao.md` — Registra a aplicação da primeira etapa de apresentação
38. `8102024` — `docs/ai/sessions/2026-11-12-1508-codex-textos-recursos.md` — Registra o ajuste dos textos institucionais de recursos
39. `2ee82cc` — `docs/ai/sessions/2026-11-12-1523-codex-remover-epg.md` — Registra a remoção de programação e riscos do proxy

40. Este registro: Registra os commits e o envio da adequação do produto. O hash é consultável pelo histórico Git do próprio arquivo.
