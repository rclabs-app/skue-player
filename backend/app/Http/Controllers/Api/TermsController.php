<?php

namespace App\Http\Controllers\Api;

use App\Models\TermsAcceptance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;

class TermsController extends Controller
{
    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate([
            'acceptance_id' => ['required', 'uuid'],
            'device_id' => ['required', 'string', 'max:64', 'regex:/^SK(:[0-9A-F]{2}){5}$/'],
            'terms_version' => ['required', 'string', Rule::in([config('legal.version')])],
            'platform' => ['required', Rule::in(['web', 'android'])],
        ]);

        // The unique UUID makes retries safe even after a lost HTTP response.
        $acceptance = TermsAcceptance::query()->createOrFirst(
            ['acceptance_id' => $data['acceptance_id']],
            array_diff_key($data, ['acceptance_id' => true]) + ['ip_address' => null],
        );
        foreach (['device_id', 'terms_version', 'platform'] as $field) {
            if ($acceptance->{$field} !== $data[$field]) {
                return response()->json(['message' => 'Identificador de aceite já utilizado.'], 409)
                    ->header('Cache-Control', 'no-store');
            }
        }

        return response()->json([
            'status' => 'accepted',
            'acceptance_id' => $acceptance->acceptance_id,
            'device_id' => $acceptance->device_id,
            'platform' => $acceptance->platform,
            'terms_version' => $acceptance->terms_version,
            'current_version' => config('legal.version'),
            'accepted_at' => $acceptance->created_at->toIso8601String(),
        ], $acceptance->wasRecentlyCreated ? 201 : 200)->header('Cache-Control', 'no-store');
    }

    public function appVersion(): JsonResponse
    {
        return response()->json([
            'version' => config('app.version', '0.1.0'),
            'terms_version' => config('legal.version'),
            'min_app_version' => '0.1.0',
            'legal' => [
                'version' => config('legal.version'),
                'status' => config('legal.status'),
                'documents' => config('legal.documents'),
            ],
        ])->header('Cache-Control', 'no-store');
    }
}
