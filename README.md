# Skue Player

> **Modern, High-Performance, Local-First VOD & IPTV Player for Web and Smart TVs**

[![CI](https://github.com/rclabs-app/rc-player/actions/workflows/ci.yml/badge.svg)](https://github.com/rclabs-app/rc-player/actions/workflows/ci.yml)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Laravel](https://img.shields.io/badge/Laravel-11-FF2D20?logo=laravel&logoColor=white)](https://laravel.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.x-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## 1. Visão Geral

O **Skue Player** é um reprodutor e organizador de mídia IPTV / VOD desenvolvido com uma interface de padrão comercial de streaming (inspirada em Netflix, Prime Video e Apple TV), projetado sob o paradigma **Local-First** para oferecer máxima fluidez e responsividade mesmo em dispositivos com hardware restrito (Smart TVs de entrada com 1-2GB de RAM).

O sistema opera estritamente como um **reprodutor de mídia neutro** ("*Bring Your Own Content*"). Todo o processamento de listas (`.m3u`), guia de programação (`XMLTV/EPG`), histórico e favoritos ocorre **diretamente no hardware do usuário**.

---

## 2. Destaques e Funcionalidades

* 🚀 **Arquitetura Local-First:** Processamento e armazenamento descentralizados (IndexedDB estruturado gravado em lotes transacionais de 5.000 itens) para suportar listas massivas (200k+ itens) sem travar a interface.
* ⚡ **Parsing Assíncrono via Web Workers:** Processamento de M3U e EPG em threads de background dedicadas, garantindo 60 FPS contínuos na UI.
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
│  └─────────────────────────┘   │ (Parser M3U & EPG) │  │
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
rc-player/
├── backend/            # API Coordenadora em Laravel 11 (PHP 8.3 + SQLite)
│   ├── app/            # Controllers, Middlewares e Models
│   ├── routes/api.php  # Endpoints REST
│   └── tests/          # 25 testes de feature automatizados
├── web/                # Frontend SPA em Vue 3 + TypeScript + Vite
│   ├── android/        # Projeto Android TV (Capacitor + ExoPlayer)
│   └── src/
│       ├── views/      # Home, Details, Live, Guide, Search, Settings, Onboarding
│       ├── lib/        # Wrapper IndexedDB e M3U Parser
│       ├── workers/    # Web Workers (M3U / XMLTV)
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
* **Portal de Playlists:** [http://localhost:5173/portal](http://localhost:5173/portal)

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
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
*O APK gerado ficará disponível em `web/android/app/build/outputs/apk/debug/`.*

---

## 8. Conformidade Legal (Legal Compliance)

O **RC Player** é um reprodutor de mídia neutro e agnóstico de conteúdo.

1. **Zero Conteúdo Hospedado:** Nenhum vídeo, transmissão, canal ou arquivo de mídia é armazenado ou retransmitido pelo servidor.
2. **Fontes Fornecidas pelo Usuário:** O usuário é o exclusivo responsável pelas URLs, listas M3U ou credenciais inseridas na aplicação.
3. **Privacidade por Design:** Credenciais e históricos permanecem no dispositivo local, respeitando os preceitos da LGPD e GDPR.

---

## 9. Licença

Propriedade de **RC Labs**. Todos os direitos reservados.
