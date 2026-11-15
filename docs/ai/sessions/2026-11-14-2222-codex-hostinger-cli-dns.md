# Hostinger CLI para DNS
Data/hora: 2026-11-14 22:22 (America/Recife)
Ferramenta: Codex
Estado: DNS concluído; HTTPS e hosts finais pendentes
Objetivo: preparar alternativa oficial de CLI para configurar DNS skue.tv, a pedido do usuário.
Arquivos previstos: este registro; binário temporário em /tmp/skue-hostinger-cli e documentação operacional se necessário. Sem alterar skills/configurações existentes nem versionar credenciais.
Análise: CLI/skill Hostinger ausentes; variável de token e ~/.hostinger.yaml ausentes. Documentação oficial consultada em https://docs.hostinger.com/api-reference/cli; autenticação por navegador ou token com prompt oculto. Usuário autorizou alteração DNS do próprio domínio; ler zona e preservar registros alheios antes de qualquer mutação.

CLI oficial v5.0.0 preparada em /tmp, SHA256 conferido pelo manifesto do mesmo release. OAuth login concluído, auth status confirma acesso válido sem token manual; credenciais geridas pela CLI fora do repositório. Leitura autenticada da zona skue.tv retornou apenas @ A 2.57.91.91 e www CNAME skue.tv, backup JSON privado 0600 em /tmp. Plano de mutação: grupo @ A com dois IPs Vercel, www/api/player CNAME nos destinos já conferidos, TTL300; overwrite apenas grupos nome/tipo informados. Nenhum MX/TXT/NS encontrado na resposta; não alterar nameservers nem registros alheios.

Resultado: atualização aceita; releitura confirma @ A com ambos os IPs, www/api/player CNAME e TTL300, quatro grupos na zona. DNS público já propagado no resolvedor consultado; Vercel misconfigured=false nos quatro nomes. Consulta domains inspect confirma projetos corretos; nameservers Hostinger preservados (alerta visual de nameservers Vercel não implica obrigação de migração NS). HTTPS ainda falha com SSL_ERROR_SYSCALL, não validado; manter URLs temporárias e validar após reconhecimento/certificado. Sem bypass TLS, redeploy, segredos em logs, commit/push ou alteração da conta administrativa. Documentação operacional/contexto atualizados.

Verificação final de diff aprovada, alterações pré-existentes preservadas.
