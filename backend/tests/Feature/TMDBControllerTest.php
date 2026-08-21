<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TMDBControllerTest extends TestCase
{
    public function test_tmdb_metadata_returns_valid_format()
    {
        Http::fake([
            'api.themoviedb.org/3/search/*' => Http::response([
                'results' => [
                    [
                        'id' => 123,
                        'title' => 'Inception',
                        'overview' => 'Mocked TMDB synopsis description',
                        'backdrop_path' => '/mock_backdrop.jpg'
                    ]
                ]
            ], 200)
        ]);

        $response = $this->getJson('/api/v1/tmdb/metadata?title=Inception&type=movie&year=2010');

        $response->assertStatus(200)
            ->assertJson([
                'overview' => 'Mocked TMDB synopsis description',
                'backdrop_url' => 'https://image.tmdb.org/t/p/original/mock_backdrop.jpg'
            ]);
    }

    public function test_tmdb_metadata_validation_errors()
    {
        $response = $this->getJson('/api/v1/tmdb/metadata');
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'type']);
    }
}
