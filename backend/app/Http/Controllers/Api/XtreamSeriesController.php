<?php

namespace App\Http\Controllers\Api;

use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class XtreamSeriesController
{
    public function __invoke(Request $request, string $mac, string $id, string $seriesId)
    {
        $playlist = $request->attributes->get('device')->playlists()
            ->whereKey($id)->where('is_active', true)->where('type', 'xtream')->firstOrFail();
        $headers = ['Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache'];
        $failure = fn (int $status = 502) => response()->json([
            'error' => $status === 451 ? 'A fonte recusou o acesso aos episódios (HTTP 451).'
                : 'Não foi possível consultar os episódios na fonte.',
        ], $status, $headers);
        try {
            $base = new Uri(rtrim($playlist->url, '/').'/');
            if ($base->getScheme() !== 'https' || $base->getUserInfo() || $base->getQuery() || $base->getFragment()) return $failure(422);
            $url = UriResolver::resolve($base, new Uri('player_api.php'))->withQuery(http_build_query([
                'username' => $playlist->username, 'password' => $playlist->password,
                'action' => 'get_series_info', 'series_id' => $seriesId,
            ]));
            for ($redirect = 0; $redirect <= 2; $redirect++) {
                // Validate and pin DNS so redirects/rebinding cannot reach private networks.
                $ips = filter_var($url->getHost(), FILTER_VALIDATE_IP) ? [$url->getHost()] : gethostbynamel($url->getHost());
                if (!$ips) return $failure();
                foreach ($ips as $ip) {
                    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return $failure(422);
                }
                $response = Http::connectTimeout(5)->timeout(12)->withoutRedirecting()->acceptJson()
                    ->setHandler(new \GuzzleHttp\Handler\CurlHandler())
                    ->withOptions(['progress' => static function ($total, $downloaded) {
                        if ($total > 2097152 || $downloaded > 2097152) throw new \RuntimeException('Metadata size limit exceeded.');
                    }, 'curl' => [CURLOPT_RESOLVE => [
                        $url->getHost().':'.($url->getPort() ?? 443).':'.$ips[0],
                    ]]])->get((string) $url);
                if ($response->redirect()) {
                    $location = $response->header('Location');
                    $response->toPsrResponse()->getBody()->close();
                    if (!$location || $redirect === 2) return $failure();
                    $next = UriResolver::resolve($url, new Uri($location));
                    if ($next->getScheme() !== $base->getScheme() || $next->getHost() !== $base->getHost()
                        || $next->getPort() !== $base->getPort() || $next->getUserInfo()) return $failure();
                    $url = $next->withQuery($url->getQuery())->withFragment('');
                    continue;
                }
                if (!$response->successful()) {
                    $response->toPsrResponse()->getBody()->close();
                    return $failure(in_array($response->status(), [401, 403, 451]) ? $response->status() : 502);
                }
                $body = $response->toPsrResponse()->getBody();
                $json = '';
                while (!$body->eof() && strlen($json) <= 2097152) $json .= $body->read(65536);
                $body->close();
                if (strlen($json) > 2097152) return $failure();
                $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
                if (!is_array($data) || !isset($data['episodes']) || !is_array($data['episodes'])) return $failure();
                $episodes = [];
                foreach ($data['episodes'] as $season => $items) {
                    if (!is_array($items)) return $failure();
                    $episodes[$season] = array_map(fn ($item) => is_array($item)
                        ? array_intersect_key($item, array_flip(['id', 'season', 'episode_num', 'container_extension'])) : [], $items);
                }
                return response()->json(['episodes' => (object) $episodes], 200, $headers);
            }
        } catch (\Throwable $exception) {
            // Exception messages can contain private URLs: never log or expose them.
            return $failure();
        }
        return $failure();
    }
}
