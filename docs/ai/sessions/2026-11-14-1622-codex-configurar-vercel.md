# Configurar Vercel para o agente
Data/hora: 2026-11-14 16:22 (America/Recife)
Ferramenta: Codex
Estado: configuração concluída — validação funcional das ferramentas pendente de recarga
Objetivo: seguir https://vercel.com/get-started.md para instalar CLI, orientação e MCP no escopo do usuário.
Arquivos em uso: este registro; instalações globais e configuração MCP do usuário conforme ferramentas oficiais, preservando configurações existentes. Nenhuma edição funcional ou vínculo de projeto previsto.
Mudanças e decisões: guia consultado; Node 22 disponível e Vercel CLI ausente do PATH. Plugin preferido, skills somente como alternativa. Autenticação depende do usuário.
Verificações executadas e resultados: status Git, sessões recentes e disponibilidade dos comandos conferidos.
Resultado: CLI Vercel 65.16.0 instalada globalmente; vercel whoami confirmou autenticação. Plugin oficial instalado via npx plugins add vercel/vercel-plugin --target codex --scope user --yes, habilitado como vercel@openai-curated; arquivos locais de comando status e skills conferidos. Não instalado pacote alternativo de skills.
MCP: entrada global vercel adicionada em ~/.codex/config.toml com endpoint https://mcp.vercel.com. OAuth iniciado pelo Codex; provedor rejeitou escopos descobertos e o cliente tentou novamente com escopos reduzidos. Usuário relatou concluir ambas autorizações, mas verificação posterior ainda mostrou auth_status=not_logged_in no MCP; login da CLI está confirmado separadamente. Link correto do segundo fluxo enviado ao usuário. Não registrar URLs temporárias de autorização aqui.
Atualização verificada: primeira tentativa expirou aguardando callback OAuth. Novo codex mcp login vercel foi concluído com mensagem Successfully logged in to MCP server 'vercel'. Consulta posterior confirmou enabled=true, auth_status=o_auth e endpoint oficial. Autenticação MCP agora comprovada, separadamente do login da CLI.
Limitações: ferramentas MCP novas e comandos do plugin ainda não carregados na sessão atual. Nenhum search_vercel_documentation ou list_teams executado. Instalador informa necessidade de reiniciar as ferramentas do agente.
Pendências e próximo passo: recarregar o agente e executar as duas consultas de leitura previstas no guia. Preservar confirmação humana para mutações via MCP. Nenhum vínculo de projeto, deploy, commit ou push executado; demais configurações e mudanças preexistentes preservadas.
