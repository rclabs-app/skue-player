# Executar aplicações locais
Data/hora: 2026-11-14 01:45 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: iniciar frontend e backend para testes locais.
Arquivos em uso: somente este registro; nenhuma edição funcional prevista.
Mudanças e decisões: contexto e sessões recentes consultados; alterações preexistentes preservadas. Frontend Vite em web, porta 5173, encaminha /api ao Laravel em 8000; portal servido pelo Laravel. Iniciar frontend com -- --host e reutilizar backend se saudável.
Verificações executadas e resultados: git status e configuração Vite consultados; consultas HTTP no sandbox sem conexão, exigindo verificação em contexto permitido.
Resultado: backend existente saudável reutilizado; frontend iniciado com npm run dev -- --host, sessão 37746, em localhost:5173 e LAN 192.168.0.8:5173. Verificações HTTP fora do sandbox retornaram 200 no player, site, portal e portal pelo endereço LAN; API direta e pelo proxy retornaram status ok e serviço Skue API.
Pendências e próximo passo: aplicações disponíveis para testes. Reprodução e acesso a partir de outro dispositivo não validados; nenhum teste/build, migration, commit ou push executado. Somente este registro foi criado.
