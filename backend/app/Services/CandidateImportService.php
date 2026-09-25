<?php

namespace App\Services;

use App\Jobs\ProcessCandidateImportJob;
use App\Models\CandidateImport;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * The one place a candidate gets into (or is found already in) the
 * platform — shared by the single-add endpoint (CompanyCandidateController)
 * and the bulk CSV job (ProcessCandidateImportJob), so "how a candidate
 * account comes to exist" is never duplicated across the two entry points
 * the way StudentImportController/TpoStudentController currently duplicate
 * it for students (not touched here, out of scope).
 */
class CandidateImportService
{
    public function import(PlacementDrive $drive, UploadedFile $file, ?User $uploadedBy): CandidateImport
    {
        $candidateImport = CandidateImport::create([
            'placement_drive_id' => $drive->id,
            'uploaded_by' => $uploadedBy?->id,
            'original_filename' => $file->getClientOriginalName(),
            'status' => CandidateImport::STATUS_PENDING,
        ]);

        $file->storeAs('candidate-imports', "{$candidateImport->id}.csv", 'local');

        ProcessCandidateImportJob::dispatch($candidateImport->id);

        return $candidateImport;
    }

    /**
     * Finds a candidate by email across the WHOLE platform (never scoped to
     * a company or college — a candidate isn't tenant-owned the way a
     * student is), or creates a brand-new lightweight account. An existing
     * account's role/college_id/password are never touched — being invited
     * into a hiring pipeline never changes who someone already is on the
     * platform.
     *
     * @return array{user: User, created: bool, plainPassword: ?string}
     */
    public function findOrCreateCandidate(string $name, string $email, ?string $phone, int $companyId): array
    {
        $existing = User::where('email', $email)->first();

        if ($existing) {
            return ['user' => $existing, 'created' => false, 'plainPassword' => null];
        }

        $plainPassword = Str::password(12);

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'handle' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
            'role' => User::ROLE_USER,
            'college_id' => null,
            'invited_by_company_id' => $companyId,
            'phone' => $phone,
        ]);

        return ['user' => $user, 'created' => true, 'plainPassword' => $plainPassword];
    }
}
