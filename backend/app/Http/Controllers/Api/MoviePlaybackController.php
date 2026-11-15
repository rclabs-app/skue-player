<?php

namespace App\Http\Controllers\Api;

use App\Services\MediaTicketService;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Request;

class MoviePlaybackController
{
    public function __invoke(Request $request, string $mac, string $id, MediaTicketService $tickets)
    {
        $input = $request->validate([
            'stream_id' => ['required', 'string', 'regex:/^\d{1,15}$/'],
            'extension' => ['required', 'in:mp4,m4v,webm'],
            'url' => ['prohibited'],
        ]);
        $device = $request->attributes->get('device');
        $playlist = $device->playlists()->whereKey($id)->where('is_active', true)->where('type', 'xtream')->firstOrFail();
        try {
            $base = new Uri(rtrim($playlist->url, '/').'/');
            if (! in_array($base->getScheme(), ['http', 'https']) || ! $base->getHost() || $base->getUserInfo()
                || $base->getQuery() || $base->getFragment() || ! $playlist->username || ! $playlist->password) {
                return response()->json(['code' => 'INVALID_MOVIE_CONFIGURATION'], 422);
            }
            $path = 'movie/'.rawurlencode($playlist->username).'/'.rawurlencode($playlist->password)
                .'/'.$input['stream_id'].'.'.$input['extension'];
            $source = (string) UriResolver::resolve($base, new Uri($path));
            $ticket = $tickets->issue($source, $input['extension'], $device->id);
            if (! $ticket) {
                return response()->json(['code' => 'MEDIA_GATEWAY_UNAVAILABLE'], 503);
            }

            return response()->json($ticket);
        } catch (\Throwable $exception) {
            // Source URL and credentials never enter responses or logs.
            return response()->json(['code' => 'MEDIA_TICKET_FAILED'], 503);
        }
    }
}
