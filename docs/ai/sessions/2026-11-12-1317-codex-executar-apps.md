# Executar aplicações locais
Data/hora: 2026-11-12 13:17 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: disponibilizar player e backend/portal locais conforme pedido do usuário.
Arquivos em uso: apenas este registro; sem edições de código planejadas.
Mudanças e decisões: contexto e registros recentes relidos; configuração Vite usa porta 5173 e proxy /api para Laravel em 8000. Preservar processos existentes quando estiverem operacionais e todos os registros preexistentes.
Verificações executadas e resultados: git status e configuração de execução consultados.
Resultado: player iniciado com npm run dev -- --host, sessão 90816, em localhost:5173 e endereço LAN 192.168.0.27:5173. Backend já ocupava a porta 8000 e foi reutilizado, sem encerrar processos.
Verificação final: HTTP 200 no player, portal Laravel em localhost:8000/portal, API em localhost:8000/api/v1/health e API pelo proxy do Vite; respostas health identificaram Skue API com status ok. Sandbox bloqueou inicialmente portas e acesso HTTP local; execuções necessárias fora dele aprovadas pela revisão automática. Git status e diff conferidos; nenhum código alterado.
Pendências e próximo passo: aplicações disponíveis para teste. Reprodução, acesso por outro dispositivo e fluxos autenticados não foram testados nesta tarefa.
