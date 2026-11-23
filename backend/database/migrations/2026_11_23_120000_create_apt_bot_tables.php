<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('apt_bot_faqs')) {
            Schema::create('apt_bot_faqs', function (Blueprint $table) {
                $table->id();
                $table->string('category')->index(); // 'about_aptrun', 'vault_ai', 'placement_drives', 'mock_interviews', 'soft_skills', 'troubleshooting', 'billing'
                $table->string('category_label');
                $table->string('category_icon')->default('HelpCircle');
                $table->string('question');
                $table->string('slug')->unique();
                $table->text('answer');
                $table->string('action_label')->nullable();
                $table->string('action_url')->nullable();
                $table->json('related_slugs')->nullable();
                $table->integer('display_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('support_tickets')) {
            Schema::create('support_tickets', function (Blueprint $table) {
                $table->id();
                $table->string('ticket_number')->unique();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('name');
                $table->string('email')->index();
                $table->string('category');
                $table->string('subject');
                $table->text('message');
                $table->string('status')->default('open'); // 'open', 'in_progress', 'resolved', 'closed'
                $table->json('metadata')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('apt_bot_faqs');
    }
};
