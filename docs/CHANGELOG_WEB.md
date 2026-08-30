# Changelog - Desenvolvimento Web (Interface Premium)

Este documento sumariza as alterações, melhorias de UI/UX e refatorações arquiteturais implementadas no Frontend Web (RC Player) para atingir um padrão de qualidade de plataformas premium de streaming (ex: Netflix, Prime Video).

---

## 1. Nova Página de Detalhes (`DetailsView.vue`)
- **Fim da Reprodução Direta:** Ao clicar em um filme ou série, o usuário não é mais jogado diretamente para o player. Criou-se a página `DetailsView`, atuando como uma landing page ("Saiba Mais") imersiva.
- **Layout Imersivo:** O contêiner restrito (`max-w-5xl`) foi removido para que a página utilize toda a largura da tela (Edge-to-Edge). Background com poster em tela cheia, opacidade 60% e gradientes duplos (vertical + horizontal).
- **Gestão de Séries:** Lógica avançada para agrupamento de episódios por "nome base" da série.
- **Abas de Temporadas:** Navegação limpa por temporadas via renderização de componentes com abas dinâmicas.
- **Formato das Capas:** A grade de episódios foi ajustada do padrão horizontal (`aspect-video` / 16:9) para o formato retrato/pôster (`aspect-[2/3]`).
- **Botão de Favoritar:** Botão interativo com ícone de coração (preenchido/contorno) e texto dinâmico ("Favoritar" / "Favorito") ao lado do botão "Assistir Agora". O estado visual muda de `bg-black/40` para `bg-white text-black` quando ativo.
- **Texto Inteligente do Botão Play:** O botão principal adapta seu texto de acordo com o contexto:
  - Filme sem histórico: "Assistir Agora"
  - Filme com progresso: "Continuar de Xh Ymin"
  - Filme concluído: "Assistir de Novo"
  - Série sem histórico: "Assistir Agora"
  - Série em progresso: "Continuar T01E03"
  - Episódio concluído: "Próximo: T01E04"
- **Barra de Progresso por Episódio:** Cada episódio na grade exibe sua própria barra de progresso visual (cor primária), calculada a partir do `HistoryStore`.
- **Auto-Navegação para Temporada Ativa:** Ao abrir a DetailsView de uma série, a temporada selecionada é automaticamente aquela onde o último episódio assistido está localizado (em vez de sempre abrir na T1).

## 2. Refatoração do Parser M3U (`m3u-parser.ts`)
- **Correção da Poluição de Canais:** Um problema crítico fazia com que a busca de canais (TV Ao Vivo) carregasse milhares de filmes/séries devido a heurísticas fracas no parser.
- **Análise de URL:** Adicionado o mapeamento via padrão de pastas da URL (`/movie/`, `/series/`, `/live/`).
- **Análise Regex:** Implementado o reconhecimento de padrões de episódios nos nomes (ex: `S01 E01`, `1x01`, `Ep. 01`) assegurando que caiam instantaneamente na aba de Séries e não Canais.

## 3. Lógica de Metadados: Séries Únicas & Ano de Lançamento
- **Deduplicação de Séries (`uniqueSeries`):** Criada uma lógica para varrer a lista de séries no Pinia (que contém todos os episódios isolados) e agrupá-las pelo nome da série, garantindo que grades e busca mostrem apenas uma capa por série.
- **Extração de Ano (`extractYear`):** O ano de lançamento (ex: `(2024)`), frequentemente poluindo os nomes no M3U, agora é extraído, removido do título e exibido com destaque usando o rótulo `Lançamento: YYYY`.

## 4. Nova Página de Busca Universal (`SearchView.vue`)
- **Desenvolvimento do Zero:** A página `/search` foi criada para pesquisar instantaneamente no catálogo completo.
- **Separação Contextual:** Os resultados são exibidos em grades apartadas (Filmes, Séries, TV Ao Vivo) com badges mostrando a quantidade de itens encontrados.
- **Feedback Visual:** Implementados *empty states* elegantes para encorajar a pesquisa e informar quando não há resultados.
- **Redirecionamento Inteligente:** O clique em Filmes/Séries direciona para a `DetailsView`, enquanto Canais acionam o `VideoPlayerModal`.

## 5. Ajustes de UI/UX e Tipografia (Global)
- **Hero Banners Dinâmicos:** As seções hero em `HomeView`, `MoviesView` e `SeriesView` agora são carrosséis com transição automática.
- **Tipografia:** Remoção definitiva de estilos que injetavam a fonte `Times New Roman/Georgia` nos títulos dos Hero banners, garantindo a fonte *sans-serif* moderna em todo o app.
- **Consistência de Capas (Covers):**
  - Todos os cantos arredondados (`border-radius`) foram removidos para garantir quinas "secas", adotando a estética premium atual.
  - Fixado um limite de aproximadamente 6 colunas por tela.
  - Todas as grades (Séries, Filmes e TV Ao Vivo) foram unificadas no formato `aspect-[2/3]` em `object-cover`.
  - Remoção de barras de scroll horizontal nativas em seções que não precisam delas.

## 6. Otimizações de Desempenho e Layout para Smart TVs
- **Batching no IndexedDB (`indexeddb.ts`):** O processo de salvamento do *parse* de M3U foi totalmente reescrito para utilizar lotes (chunks de 5000 itens) com promessas encadeadas, evitando que o congelamento da interface (`Internal Server Error` / IPC Out Of Memory) afete processadores e navegadores lentos de Smart TV.
- **Feedback Visual de Processamento (`playlist.ts`):** Inclusão de callbacks de progresso para que a interface reflita visualmente (ex: `Saving Series (5000/242431)...`) os lotes salvos no IndexedDB.
- **Viewport Engessado para 1920px (`index.html`):** Substituição do comportamento responsivo flexível por uma meta tag de `viewport` fixa em `1920px`, impedindo que navegadores independentes de TV (como o BrowseHere ou os nativos da TCL) acionem heurísticas de zoom mobile (onde aplicavam escala de 200%).
- **Força do Grid Fixado (`HomeView.vue`):** Criação de estilos precisos baseados em `calc()` e flexbox no layout de retratos, assegurando de modo imutável a proporção de 6 colunas, evitando que a última capa ficasse cortada independentemente de zoom em navegadores nativos.

## 7. Refinamento de Interface e Lógica "Premium"
- **Edge Fading com CSS Masks:** O hero banner da página inicial, Filmes e Séries recebeu a técnica visual empregada na Netflix. Utilizou-se `mask-image` nas imagens de fundo (junto a um alinhamento `object-[75%_top]` e scale moderado) para criar um desaparecimento esfumaçado perfeito da borda esquerda da imagem em direção ao background escuro (`#0f171e`), sem interrupções abruptas quadradas.
- **Nomenclatura Limpa na Grade de Séries (`cleanName`):** A função de sanitização de títulos foi aplicada ao grid principal de Séries. Isso remove de vez prefixos/sufixos de arquivo ou episódios específicos (ex: `S02 E33`) deixando as capas listadas como se tratassem da série como um todo, não de um episódio.
- **Lógica Inteligente de Assistir (`DetailsView.vue`):** O botão principal "Assistir Agora" teve sua lógica alterada para priorizar o consumo de seriados. Ao invés de reproduzir o ID atrelado à miniatura de um episódio aleatório da lista, ele faz parse de todas as temporadas da obra e abre invariavelmente o Episódio 1 da Temporada 1, reproduzindo o modelo on-demand profissional.
- **Limpeza do Conteúdo da Home (`HomeView.vue`):** Remoção de carrosséis e sessões destinadas à "TV Ao Vivo" e canais da `HomeView`, destinando essa tela inicial de forma totalmente imersiva apenas a VOD (Filmes e Séries).

## 8. Sistema de Histórico e Favoritos (Local-First)
- **Banco de Dados Estendido (`indexeddb.ts`):** Criados os stores `history` e `favorites` no IndexedDB para persistir os hábitos de visualização e itens favoritados pelo usuário.
- **Gerenciadores de Estado Globais (Pinia):** Adicionados os arquivos `history.ts` e `favorites.ts` para conectar o banco de dados à interface e calcular reativamente quais itens estão sendo consumidos.
- **Progresso de Reprodução Automático (`VideoPlayer.vue`):** O componente de player foi atualizado para rastrear cada segundo de reprodução. A cada 5 segundos disparados por eventos `@timeupdate`, ele injeta no IndexedDB o progresso, evitando lentidão ao mesmo tempo em que armazena onde o usuário parou.
- **Retomada de Ponto de Parada (Resume):** Filmes e séries agora retomam do último segundo assistido caso um arquivo de progresso exista (e caso não esteja acima de 95% do total, quando é considerado concluído).
- **Trilhos de Vistos Recentemente e Continuar Assistindo (`HomeView.vue`):** Foram criados dois trilhos dinâmicos no topo da tela inicial com barras de progresso (vermelhas) acima das capas, baseadas na minutagem de vídeos em andamento.
- **Categorias Virtuais (`MoviesView`, `SeriesView`):** As telas de navegação vertical (Filmes e Séries) agora exibem nativamente as seções "Favoritos" e "Continuar Assistindo" logo abaixo da categoria "Todos", filtrando as bibliotecas baseando-se nos bancos de dados locais.

## 9. Página de Configurações Completa (`SettingsView.vue`)
- **Dashboard de Estatísticas:** Barra superior com 4 cards exibindo contadores reais: Filmes, Episódios de Séries, Canais AO VIVO e Favoritos, alimentados diretamente pelos stores Pinia.
- **Gerenciamento de Playlist:** Exibição da URL configurada (com máscara de senha), botões "Sincronizar" (re-fetch da mesma URL) e "Trocar URL" (input inline com validação).
- **Gerenciamento de Histórico:** Seção dedicada mostrando total de itens assistidos e quantos estão "em andamento". Botão de limpeza com confirmação modal (dupla ação), chamando `db.clearHistory()` e esvaziando o array reativo.
- **Zona de Perigo:** Funcionalidade de "Limpar todos os dados" com confirmação dupla, que apaga playlist + histórico + favoritos e redireciona ao Onboarding.
- **Seção "Sobre o RC Player":** Grid com versão (v0.2.0), plataforma, armazenamento e total de conteúdos. Disclaimer legal sobre responsabilidade do usuário.
- **Toast Notifications:** Sistema de notificações animadas (toast) com ícones de sucesso/erro e auto-dismiss.
- **Layout 2 Colunas:** Interface profissional dividida em coluna esquerda (Fonte + Sobre) e coluna direita (Histórico + Zona de Perigo).

## 10. Página de Pareamento TV (`PairView.vue`)
- **Fluxo de Pareamento:** Tela `/pair` que permite ao usuário inserir o código de 6 dígitos exibido na TV e a URL da playlist M3U.
- **Validação:** Verificação de código (6 caracteres, uppercase) e URL preenchida antes do envio.
- **Feedback de Sucesso/Erro:** Tela de confirmação com ícone de check verde e mensagem de sucesso, ou banner de erro estilizado.
- **Integração Backend:** Chamada `POST /api/v1/pairing-codes/{code}/payload` com payload JSON contendo a URL.

## 11. Guia de Programação (`GuideView.vue`)
- **Grade Estilo TV por Assinatura:** Página `/guide` com layout clássico de EPG (canais na vertical, horários na horizontal).
- **Timeline de 5 Horas:** Renderização dinâmica das próximas 5 horas a partir da hora atual, formatadas em pt-BR.
- **Coluna de Canais:** Primeiros 50 canais ao vivo com logo e nome, cada um clicável para acionar o VideoPlayer.
- **Mock de Programação:** Blocos visuais com texto "Programação Automática — Em breve via XMLTV" como placeholder até a integração do parser XMLTV real.
- **Serviço EPG Stub (`epg.service.ts`):** Interface `EPGProgram` e classe `EPGService` com método mock `getCurrentProgram()` que gera dados pseudo-aleatórios estáveis. Preparado para ser substituído por dados reais do XMLTV ou da Xtream Codes API.

## 12. Sistema de Navegação Drawer (`ContentDrawer.vue`)
- **Painel Lateral Animado:** Componente reutilizável que renderiza `MoviesView`, `SeriesView` ou `LiveView` como drawer slide-in a partir da direita, ocupando toda a tela menos a sidebar (80px).
- **Transições CSS:** Backdrop com blur (`bg-black/70 backdrop-blur-sm`) e painel com `cubic-bezier` para entrada/saída suave.
- **Suporte a Teclado:** Listener de `Escape` para fechar o drawer, com remoção automática no `onUnmounted`.
- **Header Contextual:** Ícones dinâmicos por seção (claquete para Filmes, grade para Séries, dot pulsante para Ao Vivo).

## 13. Home Restruturada com Categorias Temáticas (`HomeView.vue`)
- **Menu Superior Temático:** Barra de navegação `Home | Esportes | News | Infantil` que filtra conteúdo por palavras-chave (ex: Esportes busca por "futebol", "premiere", "espn", "combate", etc.).
- **Filtragem por Keyword:** O `categoryContent` computed cruza nomes e grupos de filmes, séries e canais ao vivo contra listas de keywords por tema, retornando apenas itens com logo HTTP válida.
- **Restrição de Conteúdo ao Vivo em Temas:** Para as seções `Esportes` e `News`, a exibição foi restringida estritamente a canais de TV ao vivo, eliminando a mistura com filmes e séries gravados. O catálogo sob demanda (VOD) permanece disponível sob as abas correspondentes ou na seção `Infantil`.
- **Hero Carousel Aprimorado:** Alternância de filmes e séries intercalados no carrossel, com controles manuais (setas laterais + dots), timer de 6s com pausa no hover, e transição `hero-fade`.
  - **Visibilidade Inteligente:** O Hero Banner/Carrossel foi ajustado para ser renderizado **exclusivamente na tela inicial (`Home`)**, ocultando-se ao navegar para `Esportes`, `News` e `Infantil` para evitar a exibição e reprodução de filmes/séries fora de contexto nestas categorias de TV ao vivo.
- **Trilhos por Categoria de Grupo:** Até 4 categorias de Filmes e 3 de Séries renderizadas como trilhos horizontais com scroll por setas, agrupados dinamicamente pelo campo `group` do M3U.

## 14. Backend Laravel (API RESTful)
- **Health Check:** `GET /api/v1/health` — endpoint sem autenticação para monitoramento.
- **Versão do App:** `GET /api/v1/app-version` — retorna versão atual e termos.
- **Aceite de Termos:** `POST /api/v1/terms/accept` — registra aceite, rate-limited a 30 req/min.
- **Pareamento TV (CRUD):**
  - `POST /api/v1/pairing-codes` — gera código de 6 dígitos.
  - `GET /api/v1/pairing-codes/{code}` — consulta estado (has_payload).
  - `POST /api/v1/pairing-codes/{code}/payload` — envia payload (URL) para a TV.
  - `POST /api/v1/pairing-codes/{code}/consume` — TV consome o payload.
  - Rate-limited a 20 req/min.
- **Proxy CORS:** `POST /api/v1/proxy` — proxy server-side para download de listas M3U (contorna restrições CORS dos navegadores de Smart TV). Timeout de 60s, rate-limited a 30 req/min.

## 15. Onboarding Multimodal (`OnboardingView.vue`)
- **Três Modos de Entrada:**
  - **Pareamento (padrão):** Gera código de 6 dígitos via API, polling automático a cada 3s esperando payload da TV. Ao receber, extrai a URL e carrega automaticamente.
  - **Xtream Codes:** Formulário com Server URL, Username e Password. Constrói automaticamente a URL M3U no formato `get.php?username=X&password=Y&type=m3u_plus&output=ts`.
  - **Acesso Direto (URL M3U):** Campo de texto livre para colar URL completa.
- **Integração com Proxy:** Quando o fetch direto falha por CORS, tenta automaticamente via `POST /api/v1/proxy` como fallback.

---

## Mapa de Rotas

| Rota | View | Descrição |
|------|------|-----------|
| `/` | `HomeView` | Tela principal com hero, categorias temáticas e trilhos |
| `/movies` | `MoviesView` | Catálogo com sidebar de categorias + Favoritos + Continuar Assistindo |
| `/series` | `SeriesView` | Catálogo com sidebar de categorias + Favoritos + Continuar Assistindo |
| `/live` | `LiveView` | Grade de canais ao vivo |
| `/guide` | `GuideView` | EPG estilo TV por assinatura (stub) |
| `/search` | `SearchView` | Busca universal multi-tipo |
| `/details/:id` | `DetailsView` | Página imersiva de detalhes com favoritar e resumo inteligente |
| `/settings` | `SettingsView` | Configurações, estatísticas e zona de perigo |
| `/pair` | `PairView` | Pareamento de dispositivo TV |
| `/onboarding` | `OnboardingView` | Configuração inicial (pareamento / xtream / URL direta) |

## Mapa de Stores (Pinia)

| Store | Arquivo | Responsabilidade |
|-------|---------|-----------------|
| `playlist` | `stores/playlist.ts` | Gerencia toda a lista M3U (filmes, séries, canais), parsing, IndexedDB e estado de carregamento |
| `history` | `stores/history.ts` | Histórico de reprodução, cálculo de progresso, `activelyWatching` (1%–95%), `fullHistory` |
| `favorites` | `stores/favorites.ts` | Toggle favorito, persistência IndexedDB, consulta `isFavorite()` |

## Mapa de IndexedDB Stores

| Store | Chave | Dados |
|-------|-------|-------|
| `playlist` | `id` (auto) | `PlaylistItem` completo (name, url, logo, group, type, epgId) |
| `config` | `key` | Pares chave-valor (ex: `playlist_url`) |
| `history` | `id` | `{ id, currentTime, duration, watchedAt }` |
| `favorites` | `id` | `{ id }` |

## 16. Fallback HLS Nativo e Proteção por Token (v0.4.0)
- **Fallback HLS Nativo (`VideoPlayer.vue`):** Adicionado suporte para reprodução de streams HLS nativas diretamente no elemento `<video>` caso o motor `hls.js` não seja suportado (Samsung Tizen, LG webOS e navegadores baseados em Safari).
- **Middleware de Autenticação (`VerifyDeviceToken.php`):** Criado e configurado o middleware `device.auth` para validar solicitações contendo tokens de identificação do aparelho.
- **Handshake Criptografado (`DeviceController.php`):** A resposta do handshake de rede do dispositivo fornece o `device_token` criptografado contendo o ID e o MAC address associados.
- **Headers de Autorização Seguros (`playlist.ts` & `epg.service.ts`):** O token salvo no IndexedDB local do cliente é anexado no cabeçalho `Authorization: Bearer <token>` de todas as chamadas de proxy CORS M3U/XMLTV e download de configurações remotas da API.


## 17. EPG Integrado e Grade de Categorias Dinâmicas (v0.5.0)
- **Hero Banner nas Categorias:** O Hero Banner foi adicionado no topo das páginas de categorias (`Esportes`, `News`, `Infantil`), exibindo o canal em destaque com suporte para reprodução direta (play).
- **Grades de Canais Responsivas:** A exibição dos canais nas categorias foi reestruturada de fileiras horizontais para grades de distribuição (`CSS Grid`) responsivas.
- **Programação EPG em Tempo Real:** 
  - **No Hero Banner:** Exibe o título do programa atual, horário de início/fim, descrição e barra de progresso do programa ativo.
  - **Nos Cards da Grade:** Exibe o título do programa atual logo abaixo do nome do canal em destaque de cor primária.
- **Atualização Dinâmica por Foco (Hover):** Ao passar o mouse (`mouseenter`) ou focar (`focus`) um card de canal na grade, o Hero Banner no topo atualiza instantaneamente para exibir os detalhes e a programação EPG do canal focado.
- **Restrição e Limpeza de Conteúdo:** Refinada a separação das categorias `Esportes` e `News` para exibir estritamente canais de TV ao vivo, eliminando a mistura com filmes e séries gravados.
- **Visual Clean e Premium:** Ajustada a aparência do item focado para utilizar apenas uma borda fina na cor primária, removendo o contorno em círculo amarelo antigo e mantendo o ícone de ação na cor branca.

## 18. Integração TMDB (Metadados e Backdrop) (v0.6.0)
- **Serviço de Proxy TMDB (`TMDBController.php` & `TMDBService.php`):** Criado endpoint proxy no backend Laravel (`GET /api/v1/tmdb/metadata`) que realiza consultas autenticadas na API do TheMovieDB em português brasileiro (`pt-BR`).
- **Cache Local de Metadados (`indexeddb.ts`):** Criada uma nova object store `'tmdb_cache'` no IndexedDB (DB Version 3) para salvar metadados do TMDB de filmes e séries, evitando excesso de tráfego de rede e garantindo tempo de expiração do cache em 7 dias.
- **Higienização de Títulos (`tmdb.service.ts`):** O frontend filtra e higieniza automaticamente os títulos de VODs de listas M3U para obter a melhor taxa de acerto e correspondência nas buscas do TMDB.
- **Hero Banner Aprimorado com TMDB (`HomeView.vue`):** Filmes e séries em destaque na Home carregam dinamicamente a imagem de plano de fundo oficial (backdrop horizontal) em alta definição e a sinopse detalhada do TMDB.
- **DetailsView Imersiva com TMDB (`DetailsView.vue`):** Tela de detalhes de filmes e episódios de séries atualizada para substituir cartazes e textos genéricos por metadados reais, incluindo a sinopse traduzida e imagens de fundo dinâmicas.

## 19. Correção de Renderização de Textos e Fallback de Metadados (v0.6.1)
- **Resolução do Bug de Sobreposição de Texto (drop-shadow):** Identificação e correção de um bug de renderização de subpixel/aceleração de hardware no Chromium (particularmente visível em Smart TVs e WebViews), onde a propriedade de sombra projetada (`drop-shadow`) em parágrafos de texto longos com múltiplas linhas ou com limitação de linhas (`line-clamp`) gerava camadas de texto duplicadas e invertidas. A classe foi removida nas sinopses das páginas `HomeView.vue` e `DetailsView.vue`, garantindo legibilidade absoluta.
- **Fallback Automático para Inglês (en-US) no TMDB:** Atualizado o backend Laravel (`TMDBService.php`) para realizar uma consulta secundária no idioma `en-US` caso o retorno em português (`pt-BR`) resulte in uma sinopse vazia. Isso impede a exibição de áreas em branco para títulos menos populares ou novos no catálogo do TMDB.

## 20. Integração e Sincronização de EPG XMLTV Real (v0.7.0)
- **Descompressão Automática no Proxy Backend:** O endpoint proxy `/api/v1/proxy` no backend Laravel agora detecta cabeçalhos e bytes mágicos de arquivos comprimidos em Gzip (`\x1f\x8b`) e realiza a descompressão server-side com `gzdecode`. Isso remove o overhead de processamento e riscos de estouro de memória no navegador de Smart TVs de baixo desempenho ao baixar feeds `.xml.gz`.
- **Parsing em Web Worker (`epg-parser.worker.ts`):** O processamento de arquivos pesados de guia de programação (XMLTV) foi isolado em uma thread em segundo plano (Web Worker), prevenindo o travamento completo da interface (UI freezes) durante o carregamento de milhares de programas.
- **Associação por EPG ID (`tvg-id`):** O carregamento de programação do EPGService foi refinado para buscar programações em tempo real usando prioritariamente o identificador do canal `tvg-id` (mapeado para `epgId`), resolvendo falhas de correspondência e de pareamento.
- **Interface de Configuração de EPG na Tela de Ajustes (`SettingsView.vue`):** Adicionada uma nova seção interativa para gerenciamento do Guia EPG, com exibição de URL ativa, controle de atualização manual, status em tempo real da sincronização e opção para remover o guia cadastrado.
- **Mensagens de Fallback Limpas:** Substituição dos placeholders de teste por textos de fallback limpos e profissionais, mantendo a experiência do usuário coesa quando não há programação cadastrada para o canal.
- **Correção de Rolagem Automática em Séries (`DetailsView.vue`):** Correção de bug que fazia com que o contêiner de detalhes rolasse automaticamente para o rodapé da página quando uma série com muitos episódios era aberta. Isso foi resolvido eliminando as propriedades `justify-end` e `min-h-full` do container flex do conteúdo, e implementando um reset de rolagem explícito (`scrollTop = 0`) via template ref e escuta de alteração de rota.

## 21. Polimento de UI do Hero Banner e Player Ao Vivo (v0.7.1)
- **Aprimoramento Visual dos Banners:** Aumentamos a altura dos Hero Banners para `60vh` nas views Home, Filmes e Séries. Ajustamos as imagens de fundo com proporções adequadas (`object-contain` nas listas e `object-cover` nos banners) e gradientes focados, removendo máscaras pesadas.
- **Navegação Uniforme:** Adicionamos setas de navegação (próximo/anterior) nos banners de Filmes e Séries para espelhar a funcionalidade já existente na tela Inicial.
- **Limpeza do Player de TV Ao Vivo:** Removemos controles desnecessários durante a transmissão ao vivo, como a barra de progresso, botões de retroceder/avançar, ações secundárias inferiores e a temperatura. Agora, o foco do player para canais Ao Vivo exibe apenas título, hora local atual e botão de voltar.
- **Filtro da Categoria Infantil Otimizado:** Ajustada a detecção da aba de categorias 'Infantil' no menu principal (`HomeView.vue`), prevenindo que conteúdos destinados a adultos de redes específicas (como filmes do Disney+ ou séries originais do Discovery Channel) fossem incluídos incorretamente. As palavras-chave agora são limitadas e seguras, focando em 'discovery kids' e 'disney junior' em vez dos nomes genéricos da rede.
- **Resolução de Capas no Hero Banner da Home:** Correção no carregamento dinâmico de metadados do TMDB na tela inicial (`HomeView.vue`). A validação do tipo de conteúdo (`movie` ou `series`) foi refatorada para garantir que o *backdrop* (imagem panorâmica em alta definição) seja sempre baixado para Filmes e Séries em destaque, superando as inconsistências na tipagem do arquivo M3U original.

## 22. Otimização de Desempenho para Catálogos Massivos (v0.7.2)

**Contexto do Problema:** Navegadores nativos de Smart TVs (ex: Samsung Tizen) apresentavam tempo de carregamento excessivo ao abrir o catálogo de séries com listas M3U contendo **mais de 200 mil episódios**. A causa raiz era a repetição de varreduras completas da lista (O(N)) com sanitização via expressões regulares a cada render, filtro ou navegação.

- **Memoização do `cleanName` (`utils/text.ts`):** A função de limpeza de títulos (que remove notação de episódios/ano) agora mantém um cache em memória (`Map`) com limite de 200 mil entradas. Como o mesmo nome se repete em todos os episódios de uma série, a sanitização deixa de executar regex repetidamente e passa a ser uma consulta O(1) ao cache.
- **Índices Pré-Computados de Séries (`stores/playlist.ts`):** Adicionados os índices `seriesByCleanKey` (Map de nome limpo → lista de episódios) e `seriesIdSet` (Set de IDs) construídos **uma única vez** no carregamento/limpeza da playlist (`buildSeriesIndexes()`), eliminando varreduras repetidas de 200 mil itens.
  - `uniqueSeries` agora é derivado do `seriesByCleanKey` (O(nº de séries únicas) em vez de O(200k)).
  - Novo método `getSeriesEpisodes(baseCleanName)` para lookup O(1) dos episódios de uma série.
  - Novo método `isSeriesId(id)` para consulta O(1) de pertencimento.
- **Lookup O(1) na Página de Detalhes (`DetailsView.vue`):** A listagem de episódios de uma série deixou de executar `filter` sobre a lista completa (200k itens) e passou a consultar o índice pré-computado via `getSeriesEpisodes()`.
- **Verificação de Canal ao Vivo Otimizada (`HomeView.vue`):** A função `isLiveChannel` substituiu o `store.uniqueSeries.some(...)` (O(N) por chamada) por consulta ao `Set` de IDs de séries (`isSeriesId`).
- **Resultado:** Redução drástica do uso de CPU/memória nas operações de abertura do app, filtragem por categoria, busca e abertura de detalhes de séries, com ganho especialmente perceptível em processadores fracos de Smart TV.

## 23. Aprimoramento de Navegação D-Pad e UX de Carregamento (Android TV) (v0.7.3)

**Contexto do Problema:** Ao inicializar no Android TV, o WebView (configurado como fundo transparente no Android nativo para rodar ExoPlayer) causava conflito com o framework padrão de Splash Screen do Android 12+, travando em uma tela preta infinita. Além disso, a navegação entre a lista de temporadas e episódios (D-Pad) comportava-se de forma errática devido ao layout complexo de grid.

- **Splash Screen 100% Web (Fim da Tela Preta):** Remoção completa do plugin nativo `@capacitor/splash-screen`. Implementado um `div` de splash screen robusto em HTML/CSS (com logotipo e spinner de carregamento) desenhado diretamente no `index.html` fora da instância do Vue. O resultado é a exibição em tempo zero (sem o tempo de boot do JS) cobrindo a tela inteira com animação, e sendo gradualmente removido com um suave *fade-out* assim que a renderização pesada (VODs) estiver 100% concluída. Adicionada também uma trava de 3,5 segundos de limite máximo, garantindo que usuários nunca mais fiquem retidos em telas pretas.
- **Navegação Bidirecional de Temporadas/Episódios (Spatial Navigation Seguro):** Implementada a manipulação forçada de foco (`e.preventDefault()` via `handleKeydown`) dentro do `DetailsView.vue`.
  - Navegar "Para baixo" a partir dos botões Assistir/Favoritar trava o foco na "Temporada 1".
  - Navegar "Para baixo" na lista de temporadas fixa o foco no "Episódio 1", e "Para cima" retrocede ao botão "Assistir".
  - Navegar para as extremidades (esquerda/direita) aciona limitadores lógicos que impedem o ponteiro (D-Pad) de pular cegamente pela tela ou causar rolagens inesperadas, prendendo o usuário à grid visível.
- **Auto-Foco de "Assistir Agora":** Ao acessar a tela de detalhes (Filme ou Série), o ciclo de vida do componente Vue (`nextTick` no evento `onMounted` e de alteração de URL) posiciona automaticamente o seletor do D-Pad sobre o botão principal "Assistir", reduzindo a quantidade de cliques até a visualização.
- **Otimização da Grid de Capas e Auto-Scroll:** O tamanho e aspecto visual dos cards na tela de Episódios foi formatado estritamente para `grid-cols-6`, seguindo a padronização dimensional estabelecida em Filmes e Séries. A cada clique na rolagem para baixo durante a visualização de episódios (D-Pad down), a página processa a instrução `.scrollIntoView({ behavior: 'smooth' })`, certificando-se de que a capa focada jamais desapareça sob as bordas da tela.
- **Identidade de Marca no Menu de Navegação:** Substituição do placeholder padrão circular amarelo pelo logotipo nativo oficial do RC Player (fundo azul `#2563eb`, bordas sutilmente arredondadas) no topo da barra de navegação lateral (`App.vue`), fixando uma experiência visual orgânica com a animação de splash recém-construída.
