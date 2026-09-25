<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors the plans already displayed on the /pricing page (see
 * frontend/src/data/pricing.ts) — `code` matches that file's plan `id`
 * exactly, so a Subscription can be created from a plain plan code the
 * frontend already has, with no separate id-mapping layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('audience'); // individual | institution — see App\Models\Plan
            $table->unsignedInteger('monthly_price')->nullable(); // INR; null = not sold monthly (institution plans) or custom
            $table->unsignedInteger('annual_price')->nullable(); // INR; null = custom (Academic Enterprise)
            $table->unsignedInteger('duration_days')->nullable(); // one activation's length; null = never expires (free Coder plan)
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
