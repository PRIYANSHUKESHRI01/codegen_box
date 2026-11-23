<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gemini_api_keys')) {
            Schema::create('gemini_api_keys', function (Blueprint $table) {
                $table->id();
                $table->string('label')->default('Gemini Key');
                $table->text('api_key')->nullable();
                $table->unsignedInteger('order_index')->default(1);
                $table->decimal('duration_hours', 5, 2)->default(4.00);
                $table->boolean('is_active')->default(true);
                $table->boolean('is_exhausted')->default(false);
                $table->timestamp('exhausted_until')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('last_error_at')->nullable();
                $table->text('last_error_message')->nullable();
                $table->unsignedBigInteger('total_requests')->default(0);
                $table->unsignedBigInteger('successful_requests')->default(0);
                $table->unsignedBigInteger('failed_requests')->default(0);
                $table->timestamps();

                $table->index(['is_active', 'order_index']);
            });
        }

        // Seed initial 6 slots (0-4h, 4-8h, 8-12h, 12-16h, 16-20h, 20-24h) if empty
        if (DB::table('gemini_api_keys')->count() === 0) {
            $primaryKey = env('GEMINI_API_KEY') ?: env('GEMINI_API_KEY_1');

            $initialSlots = [
                ['label' => 'Gemini Key 1 (00:00 - 04:00)', 'order_index' => 1, 'duration_hours' => 4.00, 'api_key' => $primaryKey],
                ['label' => 'Gemini Key 2 (04:00 - 08:00)', 'order_index' => 2, 'duration_hours' => 4.00, 'api_key' => env('GEMINI_API_KEY_2')],
                ['label' => 'Gemini Key 3 (08:00 - 12:00)', 'order_index' => 3, 'duration_hours' => 4.00, 'api_key' => env('GEMINI_API_KEY_3')],
                ['label' => 'Gemini Key 4 (12:00 - 16:00)', 'order_index' => 4, 'duration_hours' => 4.00, 'api_key' => env('GEMINI_API_KEY_4')],
                ['label' => 'Gemini Key 5 (16:00 - 20:00)', 'order_index' => 5, 'duration_hours' => 4.00, 'api_key' => env('GEMINI_API_KEY_5')],
                ['label' => 'Gemini Key 6 (20:00 - 24:00)', 'order_index' => 6, 'duration_hours' => 4.00, 'api_key' => env('GEMINI_API_KEY_6')],
            ];

            $now = now();
            foreach ($initialSlots as $slot) {
                DB::table('gemini_api_keys')->insert([
                    'label' => $slot['label'],
                    'api_key' => $slot['api_key'],
                    'order_index' => $slot['order_index'],
                    'duration_hours' => $slot['duration_hours'],
                    'is_active' => true,
                    'is_exhausted' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('gemini_api_keys');
    }
};
