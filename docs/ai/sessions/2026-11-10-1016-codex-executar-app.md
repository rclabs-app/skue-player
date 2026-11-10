# Executar aplicação para teste na TV
Data/hora: 2026-11-10 10:16 (America/Recife)
Ferramenta: Codex
Estado: concluído; frontend em execução para testes
Objetivo: iniciar backend e frontend com `npm run dev -- --host` para testes na rede local.
Arquivos em uso: somente este registro; leitura de web/package.json, web/vite.config.ts, backend/composer.json e documentação.
Mudanças e decisões: sem mudanças de código ou configuração; preservar visual e pausa de assinatura. Frontend Vite encaminha /api ao backend localhost:8000.
Verificações executadas e resultados: contexto e registros recentes lidos; árvore Git inicialmente limpa; dependências e execução em verificação.
Pendências e próximo passo: iniciar serviços e verificar HTTP e endereço de acesso.

## Resultado
- Frontend iniciado com `npm run dev -- --host`, porta 5173 (sessão de execução 40825).
- A tentativa inicial no sandbox não pôde abrir sockets; execução ampliada iniciou Vite normalmente.
- Porta 8000 já ocupada por backend funcional; não foi iniciada uma segunda instância.
- HTTP 200 no frontend local, no endereço LAN http://192.168.0.27:5173/ e em /api/v1/health via proxy do Vite, com status ok de Skue API.
- Nenhuma alteração de código/configuração. Somente este registro foi criado.
- Pendente: acesso e reprodução na TV, na mesma rede local; não verificados nesta sessão.
