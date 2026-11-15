# Skue

> **Modern, High-Performance, Local-First VOD & IPTV Player for Web and Smart TVs**

[![CI](https://github.com/rclabs-app/skue-player/actions/workflows/ci.yml/badge.svg)](https://github.com/rclabs-app/skue-player/actions/workflows/ci.yml)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Laravel](https://img.shields.io/badge/Laravel-11-FF2D20?logo=laravel&logoColor=white)](https://laravel.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.x-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## 1. Visão Geral

O **Skue** é um reprodutor e organizador de mídia IPTV / VOD desenvolvido com uma interface de padrão comercial de streaming (inspirada em Netflix, Prime Video e Apple TV), projetado sob o paradigma **Local-First** para oferecer máxima fluidez e responsividade mesmo em dispositivos com hardware restrito (Smart TVs de entrada com 1-2GB de RAM).

O sistema opera estritamente como um **reprodutor de mídia neutro** ("*Bring Your Own Content*"). Todo o processamento de listas (`.m3u`), histórico e favoritos ocorre **diretamente no hardware do usuário**.

---

## 2. Destaques e Funcionalidades

* 🚀 **Arquitetura Local-First:** Processamento e armazenamento descentralizados (IndexedDB estruturado gravado em lotes transacionais de 5.000 itens) para suportar listas massivas (200k+ itens) sem travar a interface.
* ⚡ **Parsing Assíncrono via Web Workers:** Processamento de M3U em thread de background dedicada.
* 📺 **Suporte Nativo a Smart TVs (Android TV / Google TV):**
  * Navegação espacial otimizada por controle remoto (D-Pad).
  * Camada de vídeo nativa com **ExoPlayer / Media3** renderizada sob WebView transparente via `SurfaceView`.
  * Viewport fixado em 1080p Full HD com safe areas para TV.
* 🎬 **Experiência VOD & Live TV Imersiva:**
  * **Hero Banners Dinâmicos:** Efeito de *edge fading* via CSS masks e transição suave.
  * **Página de Detalhes (`DetailsView`):** Agrupamento inteligente de temporadas/episódios, extração automática de ano, indicação de próximo episódio e barra de progresso por item.
  * **Busca Universal:** Resultados instantâneos separados por Filmes, Séries e TV Ao Vivo.
  * **Suporte a Múltiplos Protocolos:** HLS (`hls.js`), MPEG-TS (`mpegts.js`) e HTML5 nativo.
* 📱 **Portal Remoto & Pareamento:**
  * Handshake por MAC Address e ativação simplificada via QR Code.
  * Portal web para gestão de listas pelo smartphone ou computador com sincronização instantânea na TV.
  * Gestão de Playlist Principal (*Main Playlist*).
* 🛡️ **Conformidade Legal & Segurança:**
  * Backend não armazena, hospeda ou distribui conteúdo audiovisual.
  * Proxy CORS técnico protegido contra SSRF (bloqueio de IPs privados) com descompressão Gzip automática.
  * Chaves e tokens criptografados.

---

### Gateway de filmes em preparação

Há uma implementação opcional em [`gateway/`](gateway/README.md) para entregar por HTTPS filmes de fontes HTTP. Ela foi validada localmente com dados sintéticos e permanece desativada até definir hospedagem, configurar segredos e testar a fonte no servidor público. O Laravel apenas autoriza; o serviço separado retransmite o vídeo sem armazená-lo. Isso altera a premissa de reprodução exclusivamente direta e exige revisar as descrições operacionais antes da ativação. Nesta etapa, somente filmes Xtream MP4/M4V/WebM; séries, Live e atualização do APK aguardam.

## 3. Arquitetura do Sistema

```
┌────────────────────────────────────────────────────────┐
│               Cliente (Web / Smart TV)                 │
│                                                        │
│  ┌─────────────────────────┐   ┌────────────────────┐  │
│  │       Vue 3 SPA         │<─>│    Pinia Stores    │  │
│  │ (D-Pad, VOD, Details)   │   └─────────┬──────────┘  │
│  └───────────┬─────────────┘             │             │
│              │                 ┌─────────▼──────────┐  │
│              │                 │ IndexedDB (Lotes)  │  │
│              │                 └─────────┬──────────┘  │
│              │                           │             │
│  ┌───────────▼─────────────┐   ┌─────────▼──────────┐  │
│  │ Player (HLS/TS/ExoPlay) │   │    Web Workers     │  │
│  └─────────────────────────┘   │ (Parser M3U)       │  │
│                                └────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Handshake / Proxy / Pairing
┌───────────────────────────▼────────────────────────────┐
│              Backend Coordenador (Laravel)             │
│                                                        │
│  • Handshake de Dispositivo (/api/v1/devices)          │
│  • Portal de Playlists Remotas (/api/v1/portal)        │
│  • Pareamento de Telas (/api/v1/pairing-codes)         │
│  • Proxy CORS Seguro c/ SSRF Check (/api/v1/proxy)     │
│  • Proxy de Metadados TMDB (/api/v1/tmdb)              │
│  • SQLite DB para tokens e sessões temporárias         │
└────────────────────────────────────────────────────────┘
```

---

## 4. Estrutura do Repositório

```
skue-player/
├── backend/            # API Coordenadora em Laravel 11 (PHP 8.3 + SQLite)
│   ├── app/            # Controllers, Middlewares e Models
│   ├── routes/api.php  # Endpoints REST
│   └── tests/          # 25 testes de feature automatizados
├── web/                # Frontend SPA em Vue 3 + TypeScript + Vite
│   ├── android/        # Projeto Android TV (Capacitor + ExoPlayer)
│   └── src/
│       ├── views/      # Home, Details, Live, Search, Settings, Onboarding
│       ├── lib/        # Wrapper IndexedDB e M3U Parser
│       ├── workers/    # Web Workers (M3U)
│       └── stores/     # Pinia Stores (Playlist, History, Favorites)
├── docs/               # Documentação técnica, changelogs e especificações
├── download/           # Binários de release (APK Android TV)
├── docker-compose.yml  # Orquestração do ambiente completo
└── ANTIGRAVITY_SPECS.md# Diretrizes de arquitetura e engenharia do projeto
```

---

## 5. Como Executar

### Pré-requisitos
* [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)
* *Ou localmente:* PHP 8.3+, Composer, Node.js 20+

---

### Executando com Docker (Recomendado)

Inicie toda a stack com um único comando:

```bash
docker compose up -d
```

Acesse os serviços:
* **Frontend Web:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
* **Portal de Playlists:** [http://localhost:8000/portal](http://localhost:8000/portal)

---

### Executando Localmente (Sem Docker)

#### 1. Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve --port=8000
```

#### 2. Frontend (Vue 3 / Vite)
```bash
cd web
npm install
npm run dev
```

---

### Portal de gerenciamento (Laravel)

O portal do usuário é servido exclusivamente pelo Laravel em `/portal`. O Vue
fica responsável pelo player; suas antigas telas de login e painel do portal
foram removidas. No portal é possível cadastrar, editar, ativar/desativar, excluir
e definir a lista principal. Uma lista desativada não pode ser principal; ao
remover ou desativar a principal, outra lista ativa é escolhida, se existir.

Para servir os estilos do portal, gere os assets do backend:

```bash
cd backend
npm install
npm run build
```

Durante o desenvolvimento, acesse `http://localhost:8000/portal`, ou substitua
`localhost` pelo IP do computador para acessar de outro dispositivo. A porta 5173
serve somente o player; não há encaminhamento do portal por ela. A API do aplicativo
continua disponível e compartilha as regras de listas no backend.

No APK, configure `VITE_PORTAL_URL` com a URL completa do portal Laravel. Essa
variável é usada pelo QR Code e pelos links de configurações. Sem configuração,
o app nativo usa `https://skue.tv/portal`, que depende da publicação e do domínio
estarem operacionais. No player web em desenvolvimento, o destino padrão é o
mesmo host na porta 8000; em produção, é `/portal` na origem pública atual.
Se o portal público estiver em outro host, configure `VITE_PORTAL_URL`.
Uma alteração no aplicativo exige novo build/APK; uma alteração apenas no Blade
é entregue pelo Laravel.

---

## 6. Testes Automatizados

### Backend (PHPUnit / Pest)
```bash
# Via Docker
docker compose exec backend php artisan test

# Ou localmente
cd backend && php artisan test
```
*Total de 25 testes de Feature cobrindo Ativação de Dispositivo, Pareamento e TMDB Proxy.*

### Frontend (Vitest & Type Check)
```bash
cd web
npm run test    # Testes unitários com Vitest
npm run build   # Verificação estrita de TypeScript (vue-tsc) e build do Vite
```

---

## 7. Compilação para Android TV (APK)

O aplicativo utiliza o Capacitor com bridge customizado em Java para ExoPlayer nativo.

```bash
cd web
VITE_API_BASE_URL=https://api.skue.tv VITE_PORTAL_URL=https://skue.tv/portal npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
*O APK gerado ficará disponível em `web/android/app/build/outputs/apk/debug/`.*

Distribuição de testes atual: `1.0.2-tv-beta` (versionCode 10), com a assinatura debug existente preservada. O download canônico é `https://skue.tv/download/skue-tv.apk`; o Laravel redireciona para o artefato público configurado em `SKUE_ANDROID_APK_URL`. Incremente a versão Android e atualize os metadados em `backend/config/downloads.php` ao publicar outro APK. A assinatura comercial e a validação de instalação/atualização em aparelho continuam pendentes.

Para testar o APK com o backend do computador na mesma rede, mantenha o backend
em execução na porta 8000, acessível pela rede local. No build, informe
o IP do computador (substitua `192.168.0.27` pelo endereço atual):

```bash
cd web
VITE_API_BASE_URL=http://192.168.0.27:8000 VITE_PORTAL_URL=http://192.168.0.27:8000/portal npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Essas variáveis configuram somente esse build, sem editar o ambiente de produção.
O celular precisa alcançar o computador pela rede local; o QR Code abrirá o portal
nesse computador. Após mudar o IP ou o destino da API, gere e instale o APK novamente.


---

## 8. Conformidade Legal (Legal Compliance)

O **Skue** é um reprodutor de mídia neutro e agnóstico de conteúdo.

1. **Zero Conteúdo Hospedado:** Nenhum vídeo, transmissão, canal ou arquivo de mídia é armazenado ou retransmitido pelo servidor.
2. **Fontes Fornecidas pelo Usuário:** O usuário é o exclusivo responsável pelas URLs, listas M3U ou credenciais inseridas na aplicação.
3. **Privacidade por Design:** Credenciais e históricos permanecem no dispositivo local, respeitando os preceitos da LGPD e GDPR.

---

## 9. Licença

Propriedade de **RC Labs**. Todos os direitos reservados.

### Conta Xtream no navegador

O player seleciona o importador de API para configurações do tipo Xtream. Categorias e catálogo são consultados diretamente na fonte; episódios de séries são carregados sob demanda. M3U permanece como importador separado. Requisitos de HTTPS/CORS, persistência e limites de validação estão em [docs/XTREAM_WEB.md](docs/XTREAM_WEB.md). O APK publicado não é atualizado por essa alteração web.
