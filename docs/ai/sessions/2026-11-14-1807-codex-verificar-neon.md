# Verificar skills e MCP Neon
Data/hora: 2026-11-14 18:07 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: seguir skill oficial indicada pelo usuário, verificar instalação e instalar apenas componentes ausentes preservando configurações.
Arquivos em uso: este registro; skills/configuração Neon somente se houver ausência ou atualização necessária, após conferência.
Mudanças e decisões: preservadas alterações preexistentes. Não repetir neon init nem puxar variáveis de ambiente. Skill oficial obtida por HTTPS e idêntica à local. Sete skills e entradas no lock presentes. MCP global OAuth habilitado e limitado ao projeto informado; Vercel presente.
Verificações executadas e resultados: leitura de contexto e registros; Git/diff; inventário local e comparação byte a byte da skill oficial. Impressões digitais privadas dos arquivos de configuração, skills e ambientes para comparar preservação ao final.
Pendências e próximo passo: verificar atualização das skills e estado MCP; registrar apenas mudanças efetivamente realizadas, sem segredos.

Resultado final: todos os componentes já estavam instalados. Sete skills (35 arquivos) comparadas byte a byte com clone temporário do repositório oficial neondatabase/agent-skills; todas idênticas. A skill neon também é idêntica ao conteúdo HTTPS solicitado.
Inconsistência da ferramenta: neon skills status marcou as sete como outdated; neon skills update -y retornou zero e informou All project skills are up to date sem alterar arquivo algum; nova consulta status repetiu outdated. A comparação direta comprovou igualdade dos arquivos, portanto não foram feitas reinstalações nem alterações manuais no lock.
Preservação verificada por SHA-256: skills, skills-lock.json, configuração global MCP, .neon, .gitignore e três ambientes privados permanecem byte a byte iguais ao início desta tarefa. Nenhum componente novo necessário. Apenas este registro foi criado no projeto.
MCP: codex mcp list confirmou Neon habilitado com auth_status not_logged_in; Vercel permanece habilitado e autenticado. Autorização CLI anterior não autentica o MCP. Próximo passo humano: codex mcp login Neon e recarregar a sessão do agente. Nenhum login de navegador iniciado automaticamente; funcionamento de chamadas MCP não comprovado.
Nenhuma alteração de código, banco, conexão, segredo, dependência da aplicação, deploy, DNS, commit ou push. Downloads e clone oficiais apenas em /tmp para verificação. git diff --check aprovado.
Feedback: enviado um relato técnico sanitizado à Neon pela CLI, conforme seção When You Run Into Issues da skill oficial explicitamente solicitada. Nenhum identificador do projeto, segredo ou dado pessoal incluído.
