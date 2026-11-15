# Analisar opções de configuração de fontes
Data/hora: 2026-11-15 00:09 America/Recife
Ferramenta: Codex
Estado: análise concluída; validação das opções na Vercel e reprodução pendentes
Objetivo: analisar opções fornecidas pelo usuário para diagnosticar importação e reprodução, sem copiar credenciais, URLs privadas ou conteúdo.
Arquivos previstos: este registro; contexto somente se houver mudança importante; código funcional somente se defeito confirmado.
Fluxo inicial: buildPlaylistUrl devolve M3U sem alterar e converte Xtream em get.php; proxy Laravel preserva scheme e repassa acesso autenticado; reprodução ocorre no aparelho/browser. Dados recebidos incluem link HTTPS de playlist e bases XC/API alternativas, códigos específicos de outros apps, DNS/IPs, EPG e instaladores externos. EPG permanece fora do escopo por decisão anterior; não instalar executáveis, trocar DNS, alterar clientes/listas ou automatizar contorno de451.
Testes previstos: conexão/TLS e consulta limitada de formato/status das URLs de lista explicitamente fornecidas, sem catálogo/reprodução; não ampliar para mídia ou endpoints não fornecidos. Diagnósticos da máquina local não equivalem ao acesso Vercel/browser. Alterações preexistentes preservadas.

Resultados atuais de consultas limitadas na máquina de diagnóstico:
- M3U original: HTTP200, prefixo M3U válido, sem ACAO compatível com player; primeira entrada amostradaHTTP. Somente8192bytes lidos, sem catálogo persistido.
- SSIPTVHTTPS fornecida: HTTP200, audio/x-mpegurl,580bytes, sem ACAO compatível. Estrutura completa com3entradas HTTPS no mesmo host, marcadas type=playlist. São referências a sublistas; URLs/nomes não registrados, sublistas não consultadas nem reproduzidas.
- TLS padrão443 das três bases verificadas aprovou certificado/TLS1.3. Isso não comprova autorização ou funcionamento de cada endpoint. Não testada TLS80.
- Primeira base XC/API recomendada: autenticaçãoHTTP excedeu15s; indisponibilidade geral não comprovada.
- Segunda base XC/API recomendada: autenticaçãoHTTP200, auth1/statusActive, ACAO compatível; informaHTTP80/HTTPS443. Validado endpoint de autenticaçãoHTTPS443:200/auth1/Active/ACAOcompatível. Endpointget.phpHTTPS conforme construção atual do projeto:200/M3U válido, sem ACAO compatível, primeira entrada amostradaHTTPS. Não inferirHTTPS de toda mídia/segmentos/redirecionamentos.
- Nenhuma consulta de catálogoAPI ou reprodução; corpos de autenticação só em memória, campos livres/credenciais/URLs não exibidos ou persistidos.

Código: web/src/utils/playlist.ts:17 converte Xtream emget.php, não integra player_api.php. Worker emweb/src/workers/m3u-parser.worker.ts:174 ignora atributo type=playlist e trata URL seguinte como item de mídia. Parser síncrono tem o mesmo limite. DevicePlaylistService validaHTTP/HTTPS e mantémURLs informadas. Portanto suporte realXtream/API e expansão controlada de sublistas são melhorias possíveis, não implementadas nesta análise. Não expandir automaticamente/cadastrar fornecedores, não alterar DNS ou instalar APKs externos. EPG continua pausado.

Prioridade proposta: validar a configuraçãoHTTPS443 anunciada pela segunda base fornecida no backend existente; no app atual a M3UsemCORS depende dele. Depois testar reprodução direta autorizada no browser, verificarHTTPS/CORS/codec em cada caminho necessário. Se necessário, planejar importaçãoXtream real genérica e suporteSSIPTV com limites/segurança, sem afirmar que elimina451 da outra origem. Não mudarIP/região/protocolo para contornar recusa.

Nenhum código funcional/cliente/dispositivo/ambiente/APK/deploy/commit/push alterado. Alterados somente este registro e contexto compartilhado. Sem suíte nova: análise de código e testesHTTP/TLS reais limitados; gitdiff--check aprovado.
