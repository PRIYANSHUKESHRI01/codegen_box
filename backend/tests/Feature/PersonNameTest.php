<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * A person's name always starts every word with a capital, whatever they typed at sign-up - on every screen, e-mail and
 * report - without ever "correcting" a name into something wrong (McDonald, an all-capitals AKASH, a particle already typed
 * right). See User::properName().
 */
class PersonNameTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, array{0: string|null, 1: string|null}> */
    public static function names(): array
    {
        return [
            'all lowercase' => ['alex chen', 'Alex Chen'],
            'already right' => ['Alex Chen', 'Alex Chen'],
            'one word' => ['priya', 'Priya'],
            'mixed up' => ['aARAV sharma', 'AARAV Sharma'],
            'hyphenated' => ['anne-marie dsouza', 'Anne-Marie Dsouza'],
            'all capitals stay as typed' => ['AKASH KUMAR', 'AKASH KUMAR'],
            'inner capitals are left alone' => ['ronan mcDonald', 'Ronan McDonald'],
            'apostrophe is left alone' => ["conor o'brien", "Conor O'brien"],
            'stray spaces are tidied' => ["  asha   rao  ", 'Asha Rao'],
            'a tab or newline is just a space' => ["asha\trao", 'Asha Rao'],
            'non-English letters' => ['élodie müller', 'Élodie Müller'],
            'an Indian name with initials' => ['k. venkata rao', 'K. Venkata Rao'],
            'digits are not letters' => ['3rd floor', '3rd Floor'],
            'empty' => ['', ''],
            'null' => [null, null],
        ];
    }

    #[DataProvider('names')]
    public function test_proper_name(?string $typed, ?string $shown): void
    {
        $this->assertSame($shown, User::properName($typed));
    }

    public function test_sign_up_stores_and_returns_the_name_capitalised_whatever_was_typed(): void
    {
        $res = $this->postJson('/api/register', [
            'name' => 'priya nair',
            'email' => 'priya@example.com',
            'handle' => 'priya_nair',
            'password' => 'a-good-password',
            'password_confirmation' => 'a-good-password',
        ])->assertCreated();

        $res->assertJsonPath('user.name', 'Priya Nair');
        // Stored tidied at the source, not only dressed up on the way out.
        $this->assertSame('Priya Nair', DB::table('users')->where('email', 'priya@example.com')->value('name'));
    }

    public function test_an_account_written_before_the_rule_still_reads_capitalised_everywhere(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        // What an old row looks like: written straight to the table, bypassing the model.
        DB::table('users')->where('id', $user->id)->update(['name' => 'ravi teja']);

        $this->assertSame('Ravi Teja', $user->fresh()->name);
        $this->assertSame('Ravi Teja', $user->fresh()->toArray()['name']);

        Sanctum::actingAs($user->fresh());
        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.name', 'Ravi Teja');
    }

    public function test_renaming_goes_through_the_same_rule(): void
    {
        $user = User::factory()->create(['name' => 'Asha Rao']);
        Sanctum::actingAs($user);

        $this->putJson('/api/me/profile', ['name' => 'asha  rao-menon'])->assertOk();

        $this->assertSame('Asha Rao-Menon', DB::table('users')->where('id', $user->id)->value('name'));
    }

    public function test_changing_nothing_about_a_name_does_not_count_as_a_change(): void
    {
        // The Mellow Vault hand-off keys off wasChanged('name'): re-saving the same name must not send a spurious update.
        $user = User::factory()->create(['name' => 'Asha Rao']);
        $user->update(['name' => 'asha rao']);

        $this->assertFalse($user->wasChanged('name'));
    }
}
