# Executar aplicações locais
Data/hora: 2026-11-11 15:06 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: iniciar frontend com `npm run dev -- --host` e backend acessível pela rede para desenvolvimento.
Arquivos em uso: apenas este registro; nenhuma edição de código planejada.
Mudanças e decisões: contexto, instruções, manifests, configuração Vite e registros recentes consultados; alterações preexistentes preservadas. Frontend Vite na porta 5173 encaminha /api ao Laravel na porta 8000; portal direto no Laravel com assets já existentes.
Verificações executadas e resultados: dependências do frontend/backend e manifesto de assets presentes; git status e diff do contexto conferidos. Consulta de portas via ss indisponível no sandbox.
Resultado: frontend iniciado com `npm run dev -- --host`, porta 5173, sessão de execução 73469. Sandbox inicialmente impediu abertura das portas; execução fora do sandbox autorizada pela revisão automática. Laravel já ocupava a porta 8000 e foi reutilizado, sem encerrar ou substituir processos.
Verificação final: HTTP 200 no frontend, `/api/v1/health` do backend, `/portal` e `/api/v1/health` pelo proxy do Vite; API identificou serviço Skue API com status ok. Endereço LAN informado pelo Vite: 192.168.0.27. Nenhuma alteração no código ou nas configurações.
Pendências e próximo passo: aplicações disponíveis para continuar o desenvolvimento; acesso de outro dispositivo na rede e reprodução não foram testados nesta tarefa.
