<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // A finer-grained cut than branch (e.g. "CSE-A" vs "CSE-B") — set
            // via the same TPO/staff bulk import or manual add as every other
            // academic field, never self-edited by the student.
            $table->string('section')->nullable()->after('branch');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('section');
        });
    }
};
