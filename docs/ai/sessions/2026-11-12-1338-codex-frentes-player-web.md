# Frentes do produto e player web
Data/hora: 2026-11-12 13:38 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: esclarecer as quatro frentes descritas pelo usuário e orientar sobre manutenção do player web, considerando riscos técnicos e jurídicos no Brasil.
Arquivos em uso: este registro e docs/ai/CONTEXT.md. Sem alterações de código planejadas.
Mudanças e decisões: usuário descreveu site institucional com acesso ao portal, administrativo Filament, apps Android/Tizen/WebOS e player Vue no navegador. Isso descreve escopo do produto; não comprova distribuição pronta em todas as plataformas. Decisão de publicar player web ainda não tomada.
Verificações executadas e resultados: Git, contexto recente, rotas do backend e serviço de playlists consultados. Backend persiste URL das listas por DevicePlaylistService e possui proxy autenticado que busca e devolve corpo HTTP; chamadas encontradas no store de playlists e serviço EPG. Nenhum tráfego de usuário ou credencial consultado. Fontes oficiais brasileiras consultadas sobre direitos autorais e responsabilidade de intermediários.
Resultado: organização registrada no contexto. Recomendação preparada: manter código Vue compartilhado, priorizar apps e liberar player web inicialmente de forma restrita, com avaliação do proxy e revisão jurídica antes de lançamento comercial aberto. Recomendação não aplicada como decisão do usuário.
Pendências e próximo passo: usuário decidir prioridade de publicação e realizar revisão técnica/jurídica específica. Sem alterações funcionais, testes, deploy ou DNS nesta tarefa; leitura estática não comprova reprodução nem legalidade do serviço.
