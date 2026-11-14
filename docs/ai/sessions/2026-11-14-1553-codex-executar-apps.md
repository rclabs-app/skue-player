# Executar aplicações locais
Data/hora: 2026-11-14 15:53 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: iniciar ou reutilizar Laravel e player Vite para testes locais do Skue.
Arquivos em uso: somente este registro; nenhuma alteração funcional prevista.
Mudanças e decisões: contexto, README, diretrizes e registros recentes consultados; Git inicialmente limpo. Reutilizar processos saudáveis e iniciar o necessário; frontend com -- --host. Não alterar ambientes, dados ou migrations.
Verificações executadas e resultados: configuração e instruções de inicialização consultadas; inspeção de sockets restrita pelo sandbox. Saúde HTTP será conferida em contexto permitido.
Pendências e próximo passo: verificar portas, iniciar serviços ausentes e retornar URLs verificadas.

Resultado: backend saudável existente reutilizado. Player iniciado com npm run dev -- --host, sessão 92345; Vite informou porta 5173 ocupada e selecionou 5174. URLs efetivas: localhost:5174 e 192.168.0.13:5174. HTTP 200 no site localhost:8000, portal /portal, administrativo /admin (redireciona a /admin/login), player e API via proxy 5174. Player também retornou 200 pelo endereço LAN a partir deste computador.
Pendências finais: reprodução, login e acesso por outro aparelho não testados. Sem alteração funcional, ambiente, migration, build, commit ou push. Somente este registro criado.
