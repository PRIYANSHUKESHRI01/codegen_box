<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A topic groups articles into a reading path (e.g. "DSA", "Go Programming")
 * — see App\Models\Article's docblock for how display_order within a topic
 * drives the student-facing Next/Previous navigation. Mellow-internal-staff
 * authored only (see User::PERM_ARTICLES); every student on the platform can
 * read a topic's published articles — no college/company ownership tier,
 * unlike Contest/Interview.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_topics', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('icon')->nullable(); // lucide-react icon name, e.g. "Binary" — see ArticleTopic::ICONS
            $table->string('color')->nullable(); // curated theme key, e.g. "indigo" — see ArticleTopic::COLORS
            $table->unsignedInteger('display_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('display_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_topics');
    }
};
