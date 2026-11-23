<?php

namespace Database\Seeders;

use App\Models\GeminiApiKey;
use App\Services\GeminiKeyRotationService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class GeminiApiKeySeeder extends Seeder
{
    /**
     * Seeds initial Gemini API key rotation slots and syncs keys from .env if present.
     */
    public function run(): void
    {
        if (! Schema::hasTable('gemini_api_keys')) {
            return;
        }

        // 1. Ensure the default 6 rotation slots exist
        $defaults = [
            1 => ['label' => 'Gemini Key 1', 'duration_hours' => 4.00],
            2 => ['label' => 'Gemini Key 2', 'duration_hours' => 4.00],
            3 => ['label' => 'Gemini Key 3', 'duration_hours' => 4.00],
            4 => ['label' => 'Gemini Key 4', 'duration_hours' => 4.00],
            5 => ['label' => 'Gemini Key 5', 'duration_hours' => 4.00],
            6 => ['label' => 'Gemini Key 6', 'duration_hours' => 4.00],
        ];

        foreach ($defaults as $order => $data) {
            GeminiApiKey::firstOrCreate(
                ['order_index' => $order],
                [
                    'label' => $data['label'],
                    'api_key' => null,
                    'duration_hours' => $data['duration_hours'],
                    'is_active' => true,
                    'is_exhausted' => false,
                ]
            );
        }

        // 2. Synchronize any keys defined in .env into the rotation slots
        try {
            app(GeminiKeyRotationService::class)->syncFromEnv();
        } catch (\Throwable $e) {
            // Non-blocking in environments without .env access
        }
    }
}
