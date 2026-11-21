<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vault_score_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('interview_id')->nullable()->constrained('interviews')->nullOnDelete();
            $table->foreignId('qualification_id')->nullable()->constrained('vault_interview_qualifications')->nullOnDelete();
            $table->string('stack_key', 64)->index();
            $table->string('role_key', 64)->nullable();
            $table->string('event_type', 32); // 'set_cleared' | 'series_qualified'
            $table->decimal('score', 5, 2);
            $table->string('status', 32)->default('cleared'); // 'cleared' | 'qualified'
            $table->text('message');
            $table->json('payload');
            $table->string('destination_type', 24)->default('http'); // 'http' | 'database' | 'both'
            $table->string('destination_url', 500)->nullable();
            $table->string('delivery_status', 24)->default('pending'); // 'delivered' | 'failed' | 'pending' | 'skipped'
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->text('response_body')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('transferred_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'stack_key']);
            $table->index(['event_type', 'delivery_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vault_score_transfers');
    }
};
