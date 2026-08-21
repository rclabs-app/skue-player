# RC Player — Documentação Técnica do Sistema

Este documento descreve a arquitetura detalhada, as decisões técnicas, os fluxos de segurança e a infraestrutura do **RC Player**, um reprodutor e organizador de mídias IPTV (TV ao vivo, filmes e séries) com arquitetura **local-first** e backend de coordenação.

---

## 1. Visão Geral da Arquitetura

O sistema é construído sobre o paradigma **local-first**, onde o navegador ou a Smart TV do usuário processa, organiza e armazena todo o conteúdo (listas M3U, histórico, favoritos) diretamente no dispositivo, enquanto o backend atua como um coordenador seguro para sincronização de listas remotas, proxying para contornar políticas de CORS, e pareamento entre múltiplos aparelhos (celular ↔ TV).

```mermaid
graph TD
    subgraph Cliente [Navegador / Smart TV]
        Vue[Vue 3 SPA] <--> Pinia[Pinia Stores]
        Vue <--> IDB[(IndexedDB)]
        Worker[Web Worker Parser] <--> IDB
        Player[Video Player HLS/TS] <--> Vue
    end

    subgraph Servidor [Backend Laravel]
        API[Laravel REST API]
        DB[(SQLite DB)]
        Proxy[CORS Proxy Controller]
        Auth[VerifyDeviceToken Middleware]
    end

    Vue -- 1. Handshake -- > API
    API -- 2. Retorna Token -- > Vue
    Vue -- 3. Config / Playlists (Com Token) -- > Auth
    Auth -- 4. Libera Acesso -- > API
    API <--> DB
    
    Vue -- 5. Proxy M3U / EPG (Com Token) -- > Auth
```

---

## 2. Camada de Apresentação (Frontend Web)

O frontend é uma Single Page Application construída com **Vue 3**, **TypeScript**, **Vite** e **Tailwind CSS**. A interface é projetada para rodar em resoluções de **1920x1080px (Full HD)**, garantindo fidelidade de aspecto em Smart TVs e aplicativos envelopados.

### 2.1 Banco de Dados Local (IndexedDB)
Para armazenar com eficiência centenas de milhares de canais e filmes (comuns em listas M3U), o sistema usa o IndexedDB por meio de uma classe wrapper reusável localizada em `web/src/lib/indexeddb.ts`.

#### Estrutura de Stores (Tabelas)
1. **`playlists`**: Armazena as listas M3U cadastradas localmente.
2. **`live`**: Grade de canais de TV ao vivo com índices por categoria (`category`) e nome.
3. **`movie`**: Catálogo de filmes locais com índices por categoria e nome.
4. **`series`**: Catálogo de séries locais agrupadas, indexadas por categoria e nome.
5. **`history`**: Registros de progresso de reprodução, incluindo última posição (segundos) e timestamp de modificação.
6. **`favorites`**: IDs de canais, filmes ou séries marcados como favoritos.
7. **`epg`**: Programas de TV ao vivo parseados a partir de arquivos XMLTV com índices por canal e intervalo de tempo.
8. **`config`**: Pares de chave-valor de uso geral (ex: `device_token`, `epg_url`).

#### Estratégia de Escrita em Lote (Batching)
A importação de listas gigantescas bloqueia a thread principal em navegadores comuns de Smart TVs. Para mitigar isso, o IndexedDB realiza gravações transacionais em **lotes (batches) de 5.000 itens**, notificando a interface de forma progressiva sem degradar a UI.

### 2.2 Gerenciamento de Estado (Pinia Stores)
O estado global da aplicação é particionado em 3 stores sob `web/src/stores/`:
* **`playlist.ts`**: Coordena o carregamento de arquivos M3U, comunicação com a API de ativação de MAC do dispositivo, sincronização remota de playlists e orquestração do Web Worker de parsing.
* **`favorites.ts`**: Controla os canais, filmes e séries favoritos salvos no IndexedDB, oferecendo métodos reativos de toggle e trilhos dedicados na Home.
* **`history.ts`**: Monitora o progresso de reprodução de filmes e episódios de séries, mantendo trilhos dinâmicos como "Continuar Assistindo".

### 2.3 Reprodutor de Vídeo (`VideoPlayer.vue`)
O player é otimizado para reproduzir múltiplos formatos comuns em transmissões IPTV:
1. **HLS (`.m3u8`) via `hls.js`**: Utilizado em navegadores desktop para canais ao vivo e VOD.
2. **MPEG-TS (`.ts`) via `mpegts.js`**: Reprodutor leve em JavaScript para streams diretas de IPTV.
3. **Fallback HLS Nativo para Smart TVs**:
   Se `Hls.isSupported()` retornar falso (comum em navegadores nativos de TVs LG webOS e Samsung Tizen que possuem decodificadores internos dedicados), o player injeta a fonte de mídia diretamente no `<video>` usando `video.canPlayType('application/vnd.apple.mpegurl')` e `video.canPlayType('application/x-mpegURL')`.
4. **Diagnóstico de Erros**:
   Captura falhas de CORS, sinal indisponível (403/404) e erros de rede nativos, exibindo uma interface limpa com a causa detalhada do problema.
5. **Tracking de Progresso**:
   A cada **5 segundos**, o progresso de conteúdos VOD (filmes/séries) é persistido no IndexedDB para permitir o recurso de retomar a reprodução de onde o usuário parou.

### 2.4 Mecanismo de EPG XMLTV (`epg.service.ts`)
* **Download & Descompressão Gzip Automática**: Sincroniza dados da grade de programação em XMLTV através do proxy CORS do backend. O proxy detecta se a resposta está comprimida em Gzip (`\x1f\x8b`) e a decompressão é realizada de forma server-side no backend PHP (`gzdecode`), desonerando por completo a CPU e a memória do cliente.
* **Processamento Assíncrono via Web Worker (`epg-parser.worker.ts`)**: O processamento sintático do arquivo XMLTV (que pode atingir dezenas de megabytes) é isolado em um Web Worker em segundo plano. Isso impede o travamento da thread principal (UI freezes) de navegadores em Smart TVs de baixo processamento.
* **Associação Avançada por EPG ID (`tvg-id`)**: Mapeia e recupera a programação do banco de dados IndexedDB de forma precisa utilizando prioritariamente o identificador do canal `tvg-id` (mapeado para `epgId`), antes de realizar fallbacks para o nome ou ID do canal.
* **Gerenciamento e Ajustes do EPG (`SettingsView.vue`)**: Disponibiliza na tela de Ajustes um card exclusivo para o EPG, onde exibe a URL ativa, status detalhado de progresso da sincronização ("Baixando...", "Processando...", "Salvando..."), botões para atualização manual de dados e remoção completa da programação local.
* **EPG Integrado no Banner Principal e nos Cards**: A página inicial (`HomeView.vue`) e as abas de categorias integram o EPG reativamente, exibindo o título do programa atual, descrição, horário e barra de progresso no Hero Banner, bem como o programa atual logo abaixo do nome do canal em cada card.
* **Grades Responsivas e Foco por Hover**: Os canais e VODs nas categorias são exibidos em grades (`CSS Grid`) responsivas sem rolagem horizontal. Ao passar o mouse (`mouseenter`) ou focar um card de canal, o Hero Banner no topo atualiza dinamicamente para mostrar os detalhes do EPG daquele canal específico, com destaque do card por borda fina na cor primária.

### 2.5 Integração com o TMDB (`tmdb.service.ts`)
* **Local Cache (IndexedDB)**: Metadados consultados no TMDB são armazenados na store `'tmdb_cache'` do IndexedDB para evitar chamadas duplicadas ou limite de taxa. A validade padrão do cache local de sinopses e backdrops é de **7 dias**.
* **Higienização de Títulos**: Antes de buscar metadados no TMDB, o frontend higieniza o título do filme/série (removendo tags de resolução, ano entre parênteses como `(2010)`, e pontuações excedentes), garantindo um índice alto de correspondência no TMDB.
* **Hero Banner Dinâmico**: Ao exibir conteúdos VOD (filmes ou séries) no Hero Banner da Home, o sistema renderiza dinamicamente o backdrop horizontal oficial do TMDB e a sinopse/overview correspondente em Português (`pt-BR`).
* **Visualização de Detalhes (`DetailsView.vue`)**: Na tela de detalhes do conteúdo, o cartaz de fundo é substituído pelo backdrop em alta definição do TMDB e o texto padrão de fallback de sinopse é atualizado com a sinopse real retornada pela API.
* **Compatibilidade e Renderização Segura de Texto**: Para prevenir problemas de sobreposição de linhas e duplicação reversa do texto de sinopse em WebViews de TVs e navegadores (bugs de renderização de aceleração de hardware causados pela propriedade `drop-shadow` em parágrafos de texto multilinha), os parágrafos de sinopse não utilizam sombras CSS/Tailwind, sendo renderizados com opacidade e contraste sobrepostos a gradientes de fundo escuros.

---

## 3. Camada de Serviços (Backend Laravel)


O backend é construído em **Laravel** rodando com **PHP 8.3** e persistência em **SQLite**. Ele funciona exclusivamente como uma API RESTful de suporte técnico e persistência para dispositivos de TV.

### 3.1 Esquema do Banco de Dados (SQLite)
A estrutura do banco é mantida simples e sem dependências pesadas de infraestrutura (Redis ou MySQL):

#### Tabela `devices`
Representa um dispositivo físico (como uma Smart TV) cadastrado pelo seu endereço MAC:
* `id` (UUID/Primary Key)
* `mac` (VARCHAR(50), único, em caixa alta)
* `device_key` (VARCHAR(6), chave de pareamento e login administrativo)
* `key_expires_at` (TIMESTAMP, validade da pairing key)
* `name` (VARCHAR(100), nome amigável do dispositivo)

#### Tabela `device_playlists`
Contém as credenciais ou URLs de listas que o usuário cadastrou remotamente para aquele dispositivo:
* `id` (INTEGER, Autoincrement)
* `device_id` (FOREIGN KEY -> devices.id, onDelete CASCADE)
* `name` (VARCHAR(150), apelido da lista)
* `type` (ENUM: `m3u`, `xtream`)
* `url` (TEXT, URL da playlist M3U ou endpoint do Xtream)
* `username` (VARCHAR(100), nulo para M3U)
* `password` (VARCHAR(100), nulo para M3U)
* `is_active` (BOOLEAN, indica se a lista deve ser sincronizada)

#### Tabela `pairing_codes`
Armazena códigos temporários de pareamento entre o navegador e a Smart TV:
* `code` (VARCHAR(6), Primary Key, caracteres não ambíguos)
* `payload` (TEXT, URL da lista a ser transferida)
* `expires_at` (TIMESTAMP, validade de 10 minutos)
* `attempts` (INTEGER, limite de 5 tentativas antes de ser invalidado)

### 3.2 Proxy de Metadados do TMDB
O backend expõe o endpoint `GET /api/v1/tmdb/metadata` que encapsula as credenciais do TMDB e responde com metadados estruturados.
* **Validação de Parâmetros**: Exige o título da mídia (`title`) e o tipo (`type`, aceitando `movie` ou `series`). Opcionalmente aceita o ano de lançamento (`year`) para restringir buscas.
* **Integração TMDB API**:
  - Busca filmes usando `api.themoviedb.org/3/search/movie`
  - Busca séries usando `api.themoviedb.org/3/search/tv`
  - Todas as chamadas de busca são feitas em Português do Brasil (`language=pt-BR`).
* **Estratégia de Fallback de Idioma**: Se a consulta em `pt-BR` retornar um campo `overview` (sinopse) vazio ou nulo, o backend executa uma nova consulta com `language=en-US` para garantir que o usuário não visualize áreas em branco.
* **Tratamento de Imagens**: Monta caminhos completos para os backdrops unindo a URL base de imagem (`TMDB_IMAGE_BASE_URL` ou default `https://image.tmdb.org/t/p/w1280`) com o caminho retornado pela API.

---

## 4. Fluxos de Segurança e Autenticação

Para proteger as URLs das listas dos clientes (que podem conter credenciais pessoais de acesso ao servidor IPTV) e evitar o uso indevido do proxy de rede do servidor, implementamos um sistema de proteção de endpoints baseado em tokens criptografados.

```
Smart TV                                                 Backend
   │                                                        │
   ├────── 1. POST /api/v1/devices/handshake (MAC) ────────>│
   │                                                        │ (Cria/Recupera Device)
   │<───── 2. Retorna device_key & device_token ────────────┤ (Token = Crypt(id|mac))
   │                                                        │
   │                                                        │
   │─── 3. GET /api/v1/devices/{mac}/config (Bearer) ──────>│
   │                                                        │ (Valida Token no Middleware)
   │<─── 4. Retorna Playlists Cadastradas ──────────────────┤
```

### 4.1 Middleware `VerifyDeviceToken`
Localizado em `backend/app/Http/Middleware/VerifyDeviceToken.php`, este middleware protege os recursos de configuração e o proxy CORS contra acessos externos.

1. **Estrutura do Token**:
   Durante o handshake inicial do dispositivo (`/devices/handshake`), o backend gera um token encriptando o ID do dispositivo e o endereço MAC correspondente:
   `Crypt::encryptString($device->id . '|' . $device->mac)`
2. **Validação**:
   Em rotas protegidas, o middleware extrai o token do header `Authorization: Bearer <token>`.
3. **Descriptografia e Match**:
   * O middleware descriptografa o token de forma segura.
   * Separa o ID e o MAC e verifica se o dispositivo de fato existe na tabela `devices`.
   * Compara se o MAC extraído do token corresponde ao parâmetro `{mac}` informado na rota de configuração.
   * Se os dados forem inválidos ou corrompidos, retorna `401 Unauthorized`.

### 4.2 Endpoints da API

#### Públicos
* `GET /api/v1/health`: Retorna o status operacional do servidor.
* `GET /api/v1/app-version`: Retorna a versão da aplicação e termos de uso.
* `POST /api/v1/terms/accept`: Registra o aceite dos termos de serviço.
* `POST /api/v1/devices/handshake`: Realiza a validação e gera a chave do dispositivo. Retorna a chave administrativa (`device_key`) de 6 caracteres e o `device_token` seguro para chamadas da API.

#### Protegidos por Token do Dispositivo (`device.auth`)
* `GET /api/v1/devices/{mac}/config`: Retorna a lista de playlists ativas associadas ao dispositivo MAC.
* `POST /api/v1/proxy`: Recebe uma URL na requisição (`url`) e atua como proxy HTTP retransmitindo o corpo de resposta para contornar bloqueios de CORS do navegador.
* `GET /api/v1/tmdb/metadata`: Obtém metadados formatados de filmes e séries diretamente do TMDB utilizando cache e higienização.

#### Autenticados via Portal (`portal.auth` / Session Token)
* `POST /api/v1/portal/authenticate`: Valida o par MAC + Chave Administrativa e retorna um token de sessão administrativa para o painel web.
* `GET /api/v1/portal/playlists`: Lista todas as playlists cadastradas no dispositivo logado.
* `POST /api/v1/portal/playlists`: Adiciona uma nova fonte (M3U ou Xtream Codes) ao dispositivo.
* `PUT /api/v1/portal/playlists/{id}`: Atualiza os dados de uma playlist existente.
* `DELETE /api/v1/portal/playlists/{id}`: Remove uma playlist.

---

## 5. Como Rodar o Projeto Localmente

### 5.1 Pré-requisitos
* Docker e Docker Compose instalados no sistema host.

### 5.2 Sobe os Containers
No diretório raiz do projeto (onde está o arquivo `docker-compose.yml`), execute o comando para subir o backend e o servidor dev do frontend:
```bash
docker compose up -d
```

### 5.3 Configura o Backend (Laravel)
Entre no container do Laravel para gerar o arquivo de banco de dados SQLite e rodar as migrações:
```bash
# Executa as migrations do banco
docker compose exec backend php artisan migrate

# Opcional: roda a suíte de testes de integração e unitários
docker compose exec backend php artisan test
```

### 5.4 Compila o Frontend (Vue 3)
Se você precisar gerar a versão de distribuição estática para o frontend, compile-a de dentro do container do frontend para evitar problemas de permissão de escrita de arquivos no host:
```bash
docker compose exec web npm run build
```
Os arquivos de build serão gerados no diretório `web/dist/`.

---

## 6. Checklist de Deployment para Produção

* [ ] Certificar-se de que a variável `APP_KEY` do Laravel esteja configurada no ambiente de produção para garantir que a criptografia dos tokens de segurança permaneça estável e segura.
* [ ] Utilizar HTTPS tanto no frontend quanto no backend para garantir que as credenciais M3U trafeguem de forma encriptada.
* [ ] Limitar o rate limit no servidor web de produção para o endpoint `/proxy` a fim de evitar abusos de transferência de dados por robôs de terceiros.
