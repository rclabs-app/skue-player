<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TMDBService
{
    protected string $apiKey;
    protected string $imageBaseUrl;

    public function __construct()
    {
        $this->apiKey = trim(config('services.tmdb.key', env('TMDB_API_KEY', '')));
        $this->imageBaseUrl = rtrim(env('TMDB_IMAGE_BASE_URL', 'https://image.tmdb.org/t/p/original'), '/');
    }

    public function getMetadata(string $title, string $type, ?string $year = null): array
    {
        if (empty($this->apiKey) || $this->apiKey === 'mock_key_for_testing') {
            // For local testing if no real key is set, we can return some mocked or default response
            // or just mock the TMDB HTTP request
        }

        $endpoint = $type === 'series' ? 'search/tv' : 'search/movie';
        
        $params = [
            'query' => $title,
            'language' => 'pt-BR'
        ];

        if ($year) {
            if ($type === 'series') {
                $params['first_air_date_year'] = $year;
            } else {
                $params['primary_release_year'] = $year;
            }
        }

        try {
            $request = Http::timeout(10);
            
            if (str_starts_with($this->apiKey, 'eyJ')) {
                $request = $request->withToken($this->apiKey);
            } else {
                $params['api_key'] = $this->apiKey;
            }

            $response = $request->get("https://api.themoviedb.org/3/{$endpoint}", $params);
            
            if ($response->successful()) {
                $results = $response->json('results');
                $bestMatch = !empty($results) ? $this->findBestMatch($title, $year, $results) : null;

                if ($bestMatch) {
                    $overview = $bestMatch['overview'] ?? '';

                    if (empty($overview)) {
                        $fallbackParams = $params;
                        if (isset($fallbackParams['api_key'])) {
                            unset($fallbackParams['api_key']);
                        }
                        $fallbackParams['language'] = 'en-US';
                        
                        $fallbackRequest = Http::timeout(10);
                        if (str_starts_with($this->apiKey, 'eyJ')) {
                            $fallbackRequest = $fallbackRequest->withToken($this->apiKey);
                        } else {
                            $fallbackParams['api_key'] = $this->apiKey;
                        }

                        $fallbackResponse = $fallbackRequest->get("https://api.themoviedb.org/3/{$endpoint}", $fallbackParams);
                        if ($fallbackResponse->successful()) {
                            $fallbackResults = $fallbackResponse->json('results');
                            $fallbackMatch = !empty($fallbackResults) ? $this->findBestMatch($title, $year, $fallbackResults) : null;
                            if ($fallbackMatch) {
                                $overview = $fallbackMatch['overview'] ?? '';
                            }
                        }
                    }

                    $backdropPath = $bestMatch['backdrop_path'] ?? null;
                    
                    return [
                        'overview' => !empty($overview) ? $overview : null,
                        'backdrop_url' => $backdropPath ? "{$this->imageBaseUrl}{$backdropPath}" : null
                    ];
                }
            }
        } catch (\Exception $e) {
            Log::error("TMDB Integration Error: " . $e->getMessage());
        }

        return ['overview' => null, 'backdrop_url' => null];
    }

    /**
     * Picks the most likely result instead of blindly using results[0],
     * avoiding wrong wallpapers/synopses for mislabeled M3U titles.
     */
    protected function findBestMatch(string $title, ?string $year, array $results): ?array
    {
        $target = $this->normalize($title);
        $best = null;
        $bestScore = 0.0;

        foreach ($results as $result) {
            $candidates = [
                $result['title'] ?? '',
                $result['original_title'] ?? '',
                $result['name'] ?? '',
                $result['original_name'] ?? '',
            ];

            $bestSimilarity = 0.0;
            foreach ($candidates as $candidate) {
                $normalized = $this->normalize($candidate);
                if ($target === '' || $normalized === '') {
                    continue;
                }
                similar_text($target, $normalized, $percent);
                $bestSimilarity = max($bestSimilarity, $percent);
            }

            if ($bestSimilarity === 0.0) {
                continue;
            }

            $score = $bestSimilarity;

            if ($year) {
                $releaseDate = $result['release_date'] ?? $result['first_air_date'] ?? '';
                if ($year === substr($releaseDate, 0, 4)) {
                    $score += 20;
                }
            }

            // Tie-breaker: prefer results that have a wallpaper available
            if (!empty($result['backdrop_path'])) {
                $score += 5;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $result;
            }
        }

        // Reject matches that are too dissimilar (would apply a wrong wallpaper)
        if ($best === null || $bestScore < 50) {
            return null;
        }

        return $best;
    }

    protected function normalize(string $value): string
    {
        return (string) preg_replace('/[^a-z0-9]/', '', mb_strtolower($value));
    }
}
