# Executar aplicações locais
Data/hora: 2026-11-15 00:54 America/Recife
Ferramenta: Codex
Estado: concluído; serviços disponíveis
Objetivo: executar Laravel e Vue/Vite e verificar endereçosHTTP locais.
Arquivos previstos: somente este registro. Preservar alterações preexistentes e ambientes; sem migrations, seeds, dados, deploy ou APK. Conferir serviços existentes antes de iniciar e usar --host no player para rede local.

Backend existente na porta8000 saudável e reutilizado. Sandbox sem acesso à rede local deu falso negativo; verificação com permissão de rede retornou200 antes de iniciar serviços. Player iniciado emweb com npmrun dev -- --host0.0.0.0 --strictPort (sessão34383), porta5173. Overrides somente no processo: VITE_API_BASE_URL=/ paraAPI relativa, VITE_BACKEND_URL=http://127.0.0.1:8000 para proxy local, VITE_PORTAL_URL vazio para fallback desenvolvimento. Ambientes em disco/produção preservados.

VerificadoHTTP200:8000/,8000/portal,8000/admin/login,8000/api/v1/health,5173/,5173/api/v1/health. Saúde direta e viaVite identificaSkueAPI; módulo servido confirmaoverrideAPIrelativa. Vite anunciouLAN192.168.0.13:5173. Não comprovado acesso por outro aparelho nem importação/reprodução; não efetuado login, handshake ou mudança de dados. Sem testes/build/migration/deploy/commit/push; diffcheck aprovado e mudanças anteriores preservadas.
