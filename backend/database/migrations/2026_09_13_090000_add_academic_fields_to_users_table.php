<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('roll_number')->nullable()->after('college_id');
            $table->string('branch')->nullable()->after('roll_number');
            $table->decimal('cgpa', 4, 2)->nullable()->after('branch');
            $table->unsignedTinyInteger('backlogs')->nullable()->after('cgpa');
            $table->string('phone')->nullable()->after('backlogs');
            // Guards SendAccountCredentialsEmail against ever double-sending
            // on a queue retry, and lets a bulk-import re-upload skip anyone
            // who already got their welcome email.
            $table->timestamp('credentials_email_sent_at')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['roll_number', 'branch', 'cgpa', 'backlogs', 'phone', 'credentials_email_sent_at']);
        });
    }
};
