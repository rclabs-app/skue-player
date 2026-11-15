# Tentar configurar Vercel Hobby
Data/hora: 2026-11-14 19:27 (America/Recife)
Ferramenta: Codex
Estado: concluído; projeto de homologação criado no Hobby
Objetivo: usar skill deploy-with-vercel para configurar homologação somente no plano Hobby conforme usuário.
Arquivos em uso: somente este registro; configuração de publicação apenas se houver destino gratuito confirmado e acesso suficiente.
Mudanças e decisões: preservar alterações preexistentes, ambientes e segredos. Não aderir Pro/trial, comprar plano, tornar repositório público ou migrar propriedade. Inspecionar escopos existentes antes de mutações. Releitura da skill/contexto/registros concluída.
Verificações: Git consultado; ferramentas MCP não expõem criação ou mudança de plano de equipe. Nova consulta de contexto e equipes em andamento. Ferramenta de reconnect indicada pela skill não consta no catálogo.
Pendências: acesso a escopo Hobby e capacidade de configurar destino sem contratação.

Progresso: MCP contexto/equipes retornou vazio novamente; navegador indisponível (host não disponível), sem ações UI. CLI existente autenticada consegue consultar o MESMO escopo com teamId explícito: plano hobby confirmado. Consulta de projetos skue vazia. Ferramentas MCP expõem create_project; alternativa CLI REST disponível para mesmo endpoint quando acesso MCP falha. Próxima alteração prevista: criar somente projeto skue-backend-homologacao, framework container, raiz backend, no Hobby confirmado, sem vínculo Git/deploy, sem contratação ou mudança de plano.

Resultado: CLI Vercel existente 65.16.0 autenticada com acesso ao escopo exato antes negado pelo MCP. GET /v2/teams do teamId conhecido confirmou plano hobby; nenhum upgrade necessário. listagem de projetos com filtro skue vazia. Criado projeto skue-backend-homologacao, id prj_jGOF5bkNPtZ3Ibc2dpYZTU7P6t7m, accountId team_yPmhcDjtFUCmyqY7wkLU7dch, framework container, rootDirectory backend, publicSource false. MCP create_project retornou 403; usado fallback REST CLI do mesmo endpoint POST /v11/projects com teamId explícito, body temporário sem segredos removido após execução.
Verificação final remota: GET /v9/projects por nome confirmou id/equipe/framework/raiz; git_linked false, nenhum target de deployment; proteção padrão all_except_custom_domains preservada. Nova consulta de equipe confirmou hobby. URLs de dashboard são gestão, não site publicado.
Arquivos adicionais em uso: docs/HOMOLOGACAO_BACKEND.md e docs/ai/CONTEXT.md atualizados para registrar estado duradouro verificado, preservando histórico. Nenhum arquivo de aplicação ou ambiente privado modificado. Sem upload de segredos, novo vínculo Git, publicação, migrations, DNS, Pro/trial, cobrança, commit ou push.
Pendências: configurar segredos/APP_URL real e administrador, preparar migrations e revisão do código local antes de deploy; MCP continua sem autorização adequada, CLI permanece alternativa autenticada. Não repetir links de SSO que levaram usuário a fluxo Pro; conta já Hobby. git diff --check aprovado.
