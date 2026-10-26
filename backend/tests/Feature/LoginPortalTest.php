<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The tabs on the sign-in page are a promise about who is signing in: pick Student and only a student gets in,
 * pick College TPO and only a TPO does, pick Hiring Partner and only a hiring partner does. Mellow's own people
 * (superadmin, ops, marketing) are the exception and may use any tab. The server enforces it — the page is only
 * the messenger — so these tests talk to POST /api/login directly.
 */
class LoginPortalTest extends TestCase
{
    use RefreshDatabase;

    private const CUSTOMER_PORTALS = ['user', 'admin_tpo', 'admin_company'];

    private function account(string $role, array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'must_change_password' => false], $attributes));
    }

    private function signIn(User $user, ?string $portal, string $password = 'password')
    {
        return $this->postJson('/api/login', array_filter([
            'email' => $user->email,
            'password' => $password,
            'portal' => $portal,
        ], fn ($value) => $value !== null));
    }

    /** @return array<string, array{string, string, string}> role, the tab it signs in through, that tab's name */
    public static function customerAccounts(): array
    {
        return [
            'student' => [User::ROLE_USER, 'user', 'Student'],
            'college TPO' => [User::ROLE_ADMIN_TPO, 'admin_tpo', 'College TPO'],
            'section coordinator (college staff)' => [User::ROLE_SECTION_COORDINATOR, 'admin_tpo', 'College TPO'],
            'hiring partner' => [User::ROLE_ADMIN_COMPANY, 'admin_company', 'Hiring Partner'],
        ];
    }

    /** @return array<string, array{string}> */
    public static function platformStaff(): array
    {
        return [
            'superadmin' => [User::ROLE_SUPERADMIN],
            'Mellow ops' => [User::ROLE_ADMIN_INTERNAL],
            'Mellow marketing' => [User::ROLE_ADMIN_MARKETING],
        ];
    }

    #[DataProvider('customerAccounts')]
    public function test_a_customer_account_signs_in_only_through_its_own_tab(string $role, string $ownPortal, string $tabName): void
    {
        $user = $this->account($role);

        foreach (array_diff(self::CUSTOMER_PORTALS, [$ownPortal]) as $otherPortal) {
            $this->signIn($user, $otherPortal)
                ->assertStatus(422)
                ->assertJsonValidationErrors('email')
                ->assertJsonMissingPath('token')
                // It says which tab IS theirs, so they are one tap from signing in.
                ->assertJsonPath('errors.email.0', "This is a {$tabName} account. Choose the {$tabName} tab to sign in.");
        }

        $this->assertSame(0, $user->tokens()->count(), 'a refused tab must not leave a session behind');

        $this->signIn($user, $ownPortal)->assertOk()->assertJsonPath('user.role', $role)->assertJsonStructure(['token']);
        $this->assertSame(1, $user->tokens()->count());
    }

    #[DataProvider('platformStaff')]
    public function test_mellow_staff_can_sign_in_from_any_tab(string $role): void
    {
        $user = $this->account($role);

        foreach ([...self::CUSTOMER_PORTALS, 'staff'] as $portal) {
            $this->signIn($user, $portal)->assertOk()->assertJsonPath('user.role', $role);
        }
    }

    #[DataProvider('customerAccounts')]
    public function test_the_staff_page_turns_every_customer_account_away(string $role): void
    {
        $user = $this->account($role);

        $this->signIn($user, 'staff')
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'This sign-in is for Mellow staff accounts only.');

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_a_wrong_password_is_never_told_which_tab_the_account_belongs_to(): void
    {
        $tpo = $this->account(User::ROLE_ADMIN_TPO);

        // Otherwise anyone could probe an address and learn what kind of account it is.
        $this->signIn($tpo, 'user', 'not-the-password')
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');
    }

    public function test_the_wrong_tab_does_not_start_the_one_time_password_flow(): void
    {
        $tpo = $this->account(User::ROLE_ADMIN_TPO, ['must_change_password' => true]);

        $this->signIn($tpo, 'user')
            ->assertStatus(422)
            ->assertJsonMissingPath('must_change_password');

        $this->signIn($tpo, 'admin_tpo')
            ->assertOk()
            ->assertJsonPath('must_change_password', true);
    }

    public function test_a_caller_without_tabs_still_signs_in_and_an_unknown_tab_is_rejected(): void
    {
        $student = $this->account(User::ROLE_USER);

        $this->signIn($student, null)->assertOk()->assertJsonPath('user.role', User::ROLE_USER);
        $this->signIn($student, 'admin_marketing')->assertStatus(422)->assertJsonValidationErrors('portal');
    }

    public function test_a_blocked_account_is_still_told_it_is_blocked(): void
    {
        $student = $this->account(User::ROLE_USER, ['is_blocked' => true]);

        $this->signIn($student, 'admin_tpo')
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'This account has been blocked. Contact an administrator.');
    }

    public function test_every_role_has_a_way_in(): void
    {
        // A role that appears in neither list could never sign in once a tab is chosen — catch it when a role is added.
        $reachable = array_merge(
            User::PLATFORM_STAFF_ROLES,
            ...array_values(User::LOGIN_PORTALS),
        );

        $this->assertEqualsCanonicalizing(User::ROLES, array_unique($reachable));
    }
}
