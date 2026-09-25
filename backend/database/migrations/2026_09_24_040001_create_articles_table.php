<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A single piece of long-form learning content, markdown-authored by Mellow
 * Ops (see User::PERM_ARTICLES) and read by every student once published.
 * `display_order` positions this article within its topic's reading path —
 * the student reader's Next/Previous navigation walks published siblings by
 * this column (see Article::previousInTopic()/nextInTopic()), not
 * created_at. A topic can't be deleted while it still has articles
 * (restrictOnDelete) — see AdminArticleTopicController::destroy().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_topic_id')->constrained('article_topics')->restrictOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt');
            $table->longText('content'); // markdown source
            $table->string('icon')->nullable(); // overrides the topic's icon when set
            $table->string('status')->default('draft'); // draft | published
            $table->unsignedInteger('display_order')->default(0);
            $table->unsignedInteger('reading_time_minutes')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->unsignedInteger('view_count')->default(0);
            $table->timestamps();

            $table->index(['article_topic_id', 'display_order']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
