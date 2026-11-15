# Corrigir HTTPS do player
Data/hora: 2026-11-14 22:30 (America/Recife)
Ferramenta: Codex
Estado: concluído — HTTPS e hosts finais publicados
Objetivo: corrigir acesso player.skue.tv após PR_END_OF_FILE_ERROR relatado no Firefox.
Arquivos previstos: este registro, docs/HOMOLOGACAO_BACKEND.md e CONTEXT.md; configuração remota de domínio/certificado/alias e URLs se necessária. Preservar todas as mudanças locais e proteção Vercel.
Fluxo: DNS → TLS/SNI → alias de deployment → HTML/assets SPA → API. DNS configurado e conferido anteriormente; HTTPS ainda não comprovado. Não presumir problema do Vue nem erro local do usuário. Sem pagamentos/commit/push ou alteração de contas.

Diagnóstico: alias player.skue.tv vinculado ao deployment READY correto; domínio verified=true, DNS misconfigured=false, sem conflitos. Lista de certificados via API v8/certs contém skue.tv/api/www recém-emitidos, mas nenhum player.skue.tv. Solicitar certificado do player via CLI oficial, sem alterar DNS ou excluir certificados existentes.

Certificado do player emitido com sucesso via vercel certs issue. HTTP anônimo sem bypass e certificado válido: site 200, API health 200, player / e /live 200, ssl_verify_result=0. Etapa seguinte já prevista no planejamento: atualizar APP_URL para skue.tv e VITE_API_BASE_URL/PORTAL_URL para api.skue.tv e skue.tv/portal e redeploy dos pacotes locais revisados, preservando chave/banco/proteção. Código sem nova alteração funcional; filtros de upload reconferidos.

Resultados finais: backend dpl_CpVJaAE3TnmxGmgARrKzVpPWtkHA READY e player dpl_B2meP8ARahnBKLroEv2pyQVa2CuM READY. GET anônimo com TLS validado: site/portal/admin/saúde/player/live 200; saúde status ok; configuração sem token 401. CORS preflight 204 permite player.skue.tv e X-Device-Token. Verificados 18 assets JS publicados, URLs finais presentes e backend temporário ausente. Nenhum handshake/criação de dados nesta rodada. Sem código funcional alterado, nova suíte local, conta/segredo exposto, commit/push ou APK. Validação visual/login/reprodução/aparelho ainda pendente. Contexto/documentação atualizados; pacote temporário removido após validação; git diff --check aprovado.
