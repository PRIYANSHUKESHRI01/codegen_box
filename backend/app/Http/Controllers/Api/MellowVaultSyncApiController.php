<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\User;
use App\Services\IssuedCredentialVault;
use App\Services\SubscriptionService;
use App\Services\Vault\MellowVaultUserSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Controller exposing API endpoints for Mellow Vault developer synchronization.
 *
 * Senior developers can inspect, test, or integrate these endpoints directly.
 */
class MellowVaultSyncApiController extends Controller
{
    public function __construct(
        private readonly MellowVaultUserSyncService $syncService
    ) {}

    /**
     * GET /api/vault/sync/health
     * Check connection health to Mellow Vault database and developer_details_tb.
     */
    public function health(): JsonResponse
    {
        $health = $this->syncService->checkHealth();

        return response()->json([
            'service' => 'MellowVaultUserSync',
            'health' => $health,
            'timestamp' => now()->toIso8601String(),
        ], $health['connected'] ? 200 : 503);
    }

    /**
     * POST /api/vault/sync/user/{user}
     * Sync an individual AptRun user to Mellow Vault.
     */
    public function syncUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['nullable', 'string', 'min:6'],
            'phone' => ['nullable', 'string', 'max:20'],
            'college_name' => ['nullable', 'string', 'max:100'],
            'branch' => ['nullable', 'string', 'max:100'],
            'passing_year' => ['nullable', 'string', 'max:20'],
        ]);

        $plainPassword = $validated['password'] ?? null;
        $overrides = array_filter([
            'phone' => $validated['phone'] ?? null,
            'college_name' => $validated['college_name'] ?? null,
            'branch' => $validated['branch'] ?? null,
            'passing_year' => $validated['passing_year'] ?? null,
        ], fn ($v) => $v !== null);

        $result = $this->syncService->syncUser($user, $plainPassword, $overrides);

        return response()->json($result, ($result['success'] ?? false) ? 200 : 422);
    }

    /**
     * GET /api/vault/sync/user/{user}/status
     * Get the current sync state of a user in Mellow Vault.
     */
    public function userStatus(User $user): JsonResponse
    {
        $status = $this->syncService->getUserSyncStatus($user);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'college_id' => $user->college_id,
            ],
            'mellow_vault' => $status,
        ]);
    }

    /**
     * POST /api/vault/sync/register-direct
     * Register a new user on AptRun and simultaneously synchronize them to Mellow Vault.
     */
    public function registerDirect(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:50', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:20'],
            'handle' => ['nullable', 'string', 'max:64', 'alpha_dash', 'unique:users,handle'],
            'college_id' => ['nullable', 'integer', 'exists:colleges,id'],
            'branch' => ['nullable', 'string', 'max:100'],
            'graduation_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);

        $handle = $validated['handle'] ?? Str::slug($validated['name']).'-'.Str::lower(Str::random(4));

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'handle' => $handle,
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'role' => User::ROLE_USER,
            'college_id' => $validated['college_id'] ?? null,
            'branch' => $validated['branch'] ?? null,
            'graduation_year' => $validated['graduation_year'] ?? null,
        ]);

        // Keep issued password copy so administrators can view it if needed
        app(IssuedCredentialVault::class)->keep($user, $validated['password'], 'created');

        // Synchronize directly into Mellow Vault
        $syncResult = $this->syncService->syncUser($user, $validated['password'], [
            'phone' => $validated['phone'] ?? null,
            'branch' => $validated['branch'] ?? null,
            'passing_year' => $validated['graduation_year'] ?? null,
        ]);

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'message' => 'User created on AptRun and synced to Mellow Vault.',
            'user' => $user->load('college:id,name'),
            'token' => $token,
            'mellow_vault_sync' => $syncResult,
        ], 201);
    }

    /**
     * POST /api/vault/sync/batch
     * Batch sync existing AptRun users to Mellow Vault.
     */
    public function syncBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'role' => ['nullable', 'string', Rule::in([User::ROLE_USER, User::ROLE_ADMIN_TPO])],
            'college_id' => ['nullable', 'integer', 'exists:colleges,id'],
            'has_college' => ['nullable', 'boolean'],
        ]);

        $limit = $validated['limit'] ?? 50;
        $role = $validated['role'] ?? User::ROLE_USER;

        $query = User::query()
            ->where('role', $role)
            ->where('is_blocked', false);

        if (isset($validated['college_id'])) {
            $query->where('college_id', $validated['college_id']);
        } elseif (isset($validated['has_college'])) {
            $validated['has_college']
                ? $query->whereNotNull('college_id')
                : $query->whereNull('college_id');
        }

        $users = $query->orderBy('id', 'desc')->limit($limit)->get();
        $batchResult = $this->syncService->syncBatch($users);

        return response()->json([
            'filters' => [
                'role' => $role,
                'limit' => $limit,
                'college_id' => $validated['college_id'] ?? null,
                'has_college' => $validated['has_college'] ?? null,
            ],
            'result' => $batchResult,
        ]);
    }
}
