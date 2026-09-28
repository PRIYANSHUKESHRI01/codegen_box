<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Talk to Our Team" submissions from the public marketing site — a college/
 * TPO or hiring company that isn't (and shouldn't become) a full account
 * holder, unlike a "Mellow Direct" lead (see User::isMellowDirectLead()),
 * which is always an already-registered user. Deliberately its own table
 * rather than a User row: nobody filling out a contact form should get a
 * password-having login. Mirrors the User-based lead pipeline's shape where
 * it makes sense (status vocabulary, assigned_marketing_id, an append-only
 * notes table — see the contact_request_notes migration) so the marketing
 * team works both lead types the same way.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_requests', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->string('audience'); // 'institution' | 'company' — see ContactRequest::AUDIENCE_*
            $table->string('organization_name');
            $table->text('message')->nullable();
            $table->string('status')->default(User::LEAD_STATUS_NEW);
            $table->timestamp('converted_at')->nullable();
            $table->foreignId('assigned_marketing_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('assigned_marketing_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_requests');
    }
};
