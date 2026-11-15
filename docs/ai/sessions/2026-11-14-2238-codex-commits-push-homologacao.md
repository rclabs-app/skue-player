# Commits e push da homologação
Data/hora: 2026-11-14 22:38 (America/Recife)
Ferramenta: Codex
Estado: em andamento
Objetivo: executar commits por arquivo e push das novas atualizações conforme pedido explícito atual.
Arquivos previstos: alterações locais da homologação, skills Neon instaladas pelo pedido anterior, documentação/registros e este registro. Excluídos ignorados, ambientes, credenciais, bancos e artefatos locais.
Fluxo: revisar conteúdo/diff/índice e remoto → fixar escopo/hashes/mensagens → commits isolados por caminho → push sem force → conferir remoto e automação Vercel. Pedido atual autoriza commit e push; não pressupor autorização para segredos nem reescrever histórico. Estado inicial main em 7af3a3f, índice sem mudanças staged.

Revisão: main remota confere com HEAD 7af3a3f; nenhuma mudança staged preexistente. Escopo de 72 arquivos (incluindo este registro), com 35 arquivos das skills oficiais Neon e referências solicitadas anteriormente, lock, configuração/testes de homologação e documentação. Varredura de chaves privadas/tokens conhecidos sem ocorrências. Ignorados permanecem excluídos. Plano de implantação ganhou nota de estado atual para distinguir análise histórica da publicação já validada.

Escopo fixado para execução: 71 arquivos mais este registro final. Cada arquivo terá commit próprio com título em português e corpo de atualizações. Conteúdos identificados por SHA256 no manifesto temporário de execução; mensagens geradas a partir dos arquivos revisados. O registro final será salvo após os commits de conteúdo, contendo hashes/caminhos/títulos.

Verificações antes dos commits: PHPUnit aprovado, 79 testes/598 asserções; Vitest aprovado, 117 testes/1 diagnóstico opcional pulado. git diff --check sem erros, índice ainda vazio. Nenhum ambiente ou arquivo ignorado incluído.

## Commits de conteúdo verificados

- `f8278c8b` — `.gitignore` — Ignora o vínculo local do projeto Neon
- `e9378d60` — `backend/config/admin.php` — Configura a lista explícita de administradores
- `806ef0b8` — `backend/app/Models/User.php` — Restringe o acesso administrativo fora do ambiente local
- `4c722805` — `backend/config/database.php` — Compatibiliza PostgreSQL com a integração Neon e o pooler
- `278555e2` — `backend/config/cors.php` — Limita as origens de acesso à API
- `7c52f80f` — `backend/docker/check-environment.php` — Valida o ambiente antes de iniciar a homologação
- `1cc3ac32` — `backend/docker/start.sh` — Inicializa o runtime descartável de homologação
- `d4cce23c` — `backend/docker/apache.conf` — Configura Apache para o backend de homologação
- `4775e8c1` — `backend/docker/homologation.env.example` — Adiciona modelo de ambiente para homologação
- `e6669c00` — `backend/.dockerignore` — Restringe os arquivos enviados ao build do backend
- `09b9238c` — `backend/Dockerfile.vercel` — Prepara imagem Laravel para o runtime Container da Vercel
- `aca56a3e` — `.vercelignore` — Limita o pacote Vercel ao backend
- `064ac785` — `web/.vercelignore` — Filtra o pacote de publicação do player
- `5ddd528e` — `web/vercel.json` — Configura a publicação Vite do player na Vercel
- `77a6dfe8` — `backend/tests/Feature/AdminAccessTest.php` — Testa a autorização do painel administrativo
- `06578cf0` — `backend/tests/Feature/CorsTest.php` — Testa CORS e autenticação nas origens permitidas
- `23b71f9b` — `backend/tests/Feature/HomologationEnvironmentTest.php` — Testa a validação do ambiente de homologação
- `c0b4ad8a` — `backend/tests/Feature/DeviceRemovalTest.php` — Autoriza explicitamente os administradores dos testes de remoção
- `a562f965` — `skills-lock.json` — Registra as versões das skills oficiais Neon
- `a8145630` — `docs/HOMOLOGACAO_BACKEND.md` — Documenta a implantação e a operação da homologação
- `2f47b0f5` — `docs/ai/PLANO_ADEQUACAO_LANCAMENTO.md` — Atualiza o plano de implantação e domínios
- `a990c41a` — `.agents/skills/neon-ai-gateway/SKILL.md` — Adiciona a skill oficial neon-ai-gateway
- `254003a6` — `.agents/skills/neon-auth/SKILL.md` — Adiciona a skill oficial neon-auth
- `fa49b1c4` — `.agents/skills/neon-auth/references/managed-auth.md` — Adiciona referência Neon sobre autenticação gerenciada
- `8b24f7c0` — `.agents/skills/neon-auth/references/oauth-server.md` — Adiciona referência Neon sobre servidor OAuth
- `031ff52c` — `.agents/skills/neon-auth/references/self-managed.md` — Adiciona referência Neon sobre autenticação autogerida
- `ffb9ef80` — `.agents/skills/neon-functions/SKILL.md` — Adiciona a skill oficial neon-functions
- `ba93a909` — `.agents/skills/neon-functions/references/ai-sdk.md` — Adiciona referência Neon sobre AI SDK
- `f70d6827` — `.agents/skills/neon-functions/references/function-triggers.md` — Adiciona referência Neon sobre gatilhos de funções
- `c6980166` — `.agents/skills/neon-functions/references/mastra-studio.md` — Adiciona referência Neon sobre Mastra Studio
- `7ef87458` — `.agents/skills/neon-functions/references/mcp.md` — Adiciona referência Neon sobre servidores MCP
- `901bc85a` — `.agents/skills/neon-functions/references/native-binaries.md` — Adiciona referência Neon sobre binários nativos
- `783295ec` — `.agents/skills/neon-functions/references/production-hardening.md` — Adiciona referência Neon sobre proteção de funções em produção
- `41004bbd` — `.agents/skills/neon-functions/references/sentry.md` — Adiciona referência Neon sobre monitoramento com Sentry
- `2921c1be` — `.agents/skills/neon-functions/references/sse.md` — Adiciona referência Neon sobre eventos SSE
- `ea66b275` — `.agents/skills/neon-object-storage/SKILL.md` — Adiciona a skill oficial neon-object-storage
- `0b8a37e9` — `.agents/skills/neon-postgres/SKILL.md` — Adiciona a skill oficial neon-postgres
- `d2128f97` — `.agents/skills/neon-postgres/references/branching.md` — Adiciona referência Neon sobre branches PostgreSQL
- `9439b13c` — `.agents/skills/neon-postgres/references/egress-optimization.md` — Adiciona referência Neon sobre otimização de tráfego PostgreSQL
- `83bb103e` — `.agents/skills/neon-postgres/references/full-text-search.md` — Adiciona referência Neon sobre busca textual
- `5531795b` — `.agents/skills/neon-postgres/references/hybrid-search.md` — Adiciona referência Neon sobre busca híbrida
- `372ec7f8` — `.agents/skills/neon-postgres/references/lakebase-search-drizzle.md` — Adiciona referência Neon sobre Lakebase Search com Drizzle
- `cb36c920` — `.agents/skills/neon-postgres/references/vector-search.md` — Adiciona referência Neon sobre busca vetorial
- `db8513e5` — `.agents/skills/neon-realtime/SKILL.md` — Adiciona a skill oficial neon-realtime
- `7f6dfafd` — `.agents/skills/neon-realtime/references/mutations.md` — Adiciona referência Neon sobre mutações otimistas
- `e1b29f33` — `.agents/skills/neon-realtime/references/queries.md` — Adiciona referência Neon sobre consultas reativas
- `9498c253` — `.agents/skills/neon-realtime/references/reactivity.md` — Adiciona referência Neon sobre reatividade no cliente
- `533d9284` — `.agents/skills/neon-realtime/references/ssr.md` — Adiciona referência Neon sobre renderização no servidor
- `c2ad5f88` — `.agents/skills/neon-realtime/references/subscribing.md` — Adiciona referência Neon sobre assinatura de consultas
- `5b226fa7` — `.agents/skills/neon/SKILL.md` — Adiciona a skill oficial neon
- `f324da59` — `.agents/skills/neon/references/auth.md` — Adiciona referência Neon sobre autenticação Neon
- `8ff800af` — `.agents/skills/neon/references/claimable-neon.md` — Adiciona referência Neon sobre projetos Neon transferíveis
- `d8b33cf9` — `.agents/skills/neon/references/function-triggers.md` — Adiciona referência Neon sobre gatilhos de funções
- `747fd60e` — `.agents/skills/neon/references/logs-loki.md` — Adiciona referência Neon sobre logs Loki
- `2680b100` — `.agents/skills/neon/references/parse-env.md` — Adiciona referência Neon sobre validação de ambiente
- `31419db4` — `.agents/skills/neon/references/sdk.md` — Adiciona referência Neon sobre SDK Neon
- `6d030199` — `docs/ai/sessions/2026-11-14-1636-codex-skills-design.md` — Registra skills de design e animações
- `01c613d9` — `docs/ai/sessions/2026-11-14-1706-codex-planejar-implantacao.md` — Registra planejamento de domínios e implantação
- `120425e4` — `docs/ai/sessions/2026-11-14-1720-codex-backend-homologacao.md` — Registra backend para homologação gratuita
- `2808095b` — `docs/ai/sessions/2026-11-14-1755-codex-conectar-neon.md` — Registra conectar projeto Neon existente
- `f27a7329` — `docs/ai/sessions/2026-11-14-1807-codex-verificar-neon.md` — Registra verificar skills e MCP Neon
- `0c4b1a6b` — `docs/ai/sessions/2026-11-14-1906-codex-validar-homologacao.md` — Registra validar Neon e continuar homologação
- `2fe6134c` — `docs/ai/sessions/2026-11-14-1924-codex-analisar-cartao-vercel.md` — Registra analisar solicitação de cartão Vercel
- `eec034b9` — `docs/ai/sessions/2026-11-14-1927-codex-configurar-hobby.md` — Registra tentar configurar Vercel Hobby
- `28ab056c` — `docs/ai/sessions/2026-11-14-1938-codex-integrar-neon-vercel.md` — Registra continuar integração Neon e Vercel
- `2e983295` — `docs/ai/sessions/2026-11-14-1951-codex-analisar-publicacao-dns.md` — Registra analisar vínculos Vercel, Neon e domínio Hostinger
- `fe1c545f` — `docs/ai/sessions/2026-11-14-1956-codex-publicar-homologacao.md` — Registra atualizar e publicar homologação
- `a2fdbef5` — `docs/ai/sessions/2026-11-14-2132-codex-finalizar-homologacao.md` — Registra finalizar configuração da homologação
- `d7f1f25c` — `docs/ai/sessions/2026-11-14-2222-codex-hostinger-cli-dns.md` — Registra hostinger CLI para DNS
- `049c711e` — `docs/ai/sessions/2026-11-14-2230-codex-corrigir-https-player.md` — Registra corrigir HTTPS do player
- `486296a2` — `docs/ai/CONTEXT.md` — Consolida o contexto da homologação publicada

Cada commit foi conferido por caminho único, mensagem e hash SHA256 do conteúdo. Os 71 commits de conteúdo foram concluídos; este registro será versionado em commit próprio antes do push explícito origin/main. Nenhum hook ou verificação falhou.
