<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** An exact structural mirror of lead_notes, for the same reason — an append-only note history, this time against a contact_requests row instead of a users row. See ContactRequestNote's docblock. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_request_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note');
            $table->timestamps();

            $table->index('contact_request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_request_notes');
    }
};
