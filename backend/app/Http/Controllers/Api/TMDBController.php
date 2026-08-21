<?php

namespace App\Http\Controllers\Api;

use App\Services\TMDBService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class TMDBController extends Controller
{
    protected TMDBService $tmdbService;

    public function __construct(TMDBService $tmdbService)
    {
        $this->tmdbService = $tmdbService;
    }

    public function getMetadata(Request $request)
    {
        $request->validate([
            'title' => 'required|string',
            'type' => 'required|string|in:movie,series',
            'year' => 'nullable|string'
        ]);

        $title = $request->query('title');
        $type = $request->query('type');
        $year = $request->query('year');

        $metadata = $this->tmdbService->getMetadata($title, $type, $year);

        return response()->json($metadata);
    }
}
