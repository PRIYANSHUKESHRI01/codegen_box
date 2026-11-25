<?php

namespace Database\Seeders;

use App\Models\DriveApplication;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent production backfill for TPO enterprise columns.
 * Safe to re-run at any time: never overwrites explicit TPO/student choices.
 */
class TpoEnterpriseBackfillSeeder extends Seeder
{
    public function run(): void
    {
        if (Schema::hasColumn('users', 'placement_status')) {
            // Ensure null placement_status defaults to 'seeking'
            DB::table('users')
                ->where('role', User::ROLE_USER)
                ->where(function ($q) {
                    $q->whereNull('placement_status')->orWhere('placement_status', '');
                })
                ->update(['placement_status' => 'seeking']);

            // Backfill users who already accepted an offer in drive_applications
            $placedUserIds = DB::table('drive_applications')
                ->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
                ->pluck('user_id')
                ->unique()
                ->all();

            if ($placedUserIds !== []) {
                foreach (array_chunk($placedUserIds, 500) as $chunk) {
                    DB::table('users')
                        ->whereIn('id', $chunk)
                        ->where('placement_status', 'seeking')
                        ->update(['placement_status' => 'placed']);
                }
            }
        }

        if (Schema::hasColumn('drive_applications', 'joining_status')) {
            DB::table('drive_applications')
                ->where('stage', DriveApplication::STAGE_OFFER_ACCEPTED)
                ->whereNull('joining_status')
                ->update(['joining_status' => 'pending']);
        }
    }
}
