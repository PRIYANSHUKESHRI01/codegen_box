<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The footer's "stay updated" newsletter signup — deliberately its own tiny
 * table rather than reusing ContactRequest (a sales inquiry) or User (an
 * account): this is neither. Just an email address and whether it's still
 * subscribed. `unsubscribed_at` exists now so a future real unsubscribe
 * flow has somewhere to write to without another migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('newsletter_subscribers', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->timestamp('subscribed_at');
            $table->timestamp('unsubscribed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('newsletter_subscribers');
    }
};
