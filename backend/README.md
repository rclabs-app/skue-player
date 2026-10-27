# Skue — Backend API (Laravel 11)

API RESTful leve de coordenação do Skue construída com **Laravel 11**, **PHP 8.3** e **SQLite**.

## Responsabilidades
* **Handshake e Ativação de Dispositivos (`/api/v1/devices`):** Registro e geração de token seguro por endereço MAC.
* **Portal Remoto de Playlists (`/api/v1/portal`):** Gerenciamento e sincronização remota de listas para Smart TVs.
* **Pareamento de Telas (`/api/v1/pairing-codes`):** Códigos temporários de 6 caracteres para compartilhamento de configurações.
* **Proxy CORS com Proteção SSRF (`/api/v1/proxy`):** Proxy HTTP técnico com bloqueio de IPs de redes internas e descompressão gzip automática.
* **Proxy de Metadados TMDB (`/api/v1/tmdb`):** Consulta de dados e pôsteres para exibição na UI.

## Executando Localmente

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan test
php artisan serve --port=8000
```

Para mais detalhes da arquitetura completa, consulte o [README principal](../../README.md).
