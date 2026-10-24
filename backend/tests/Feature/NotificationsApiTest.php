<?php

namespace Tests\Feature;

use App\Enums\NotificationType;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The bell's API and the service behind it: you only ever see (and change) your own notifications, the unread
 * count and the poll signal are right, the same event can't tell you twice, muting works but never for the
 * categories that are about your account or money, and nothing can carry an off-site or script link.
 */
class NotificationsApiTest extends TestCase
{
    use RefreshDatabase;

    private function service(): NotificationService
    {
        return app(NotificationService::class);
    }

    private function tell(User $user, string $title = 'Hello', NotificationType $type = NotificationType::DriveLive, array $options = []): void
    {
        $this->service()->notify($user, $type, $title, 'Body', $options);
    }

    // ───────────────────────────── listing and the poll ─────────────────────────────

    public function test_you_only_see_your_own_notifications_newest_first(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        $this->tell($me, 'first');
        $this->tell($other, 'not mine');
        $this->tell($me, 'second');

        Sanctum::actingAs($me);
        $response = $this->getJson('/api/notifications')->assertOk()->assertHeader('Cache-Control', 'no-store, private');

        $this->assertSame(['second', 'first'], collect($response->json('data'))->pluck('title')->all());
        $this->assertSame(2, $response->json('unread_count'));
    }

    public function test_the_signal_is_just_the_unread_count_and_the_newest_id(): void
    {
        $me = User::factory()->create();
        Sanctum::actingAs($me);

        $this->getJson('/api/notifications/signal')->assertOk()->assertExactJson(['unread_count' => 0, 'latest_id' => 0]);

        $this->tell($me, 'a');
        $this->tell($me, 'b');
        $newest = UserNotification::where('user_id', $me->id)->max('id');

        $this->getJson('/api/notifications/signal')->assertExactJson(['unread_count' => 2, 'latest_id' => $newest]);
    }

    public function test_pages_are_cursor_based_so_a_new_arrival_cannot_shift_them(): void
    {
        $me = User::factory()->create();
        foreach (range(1, 5) as $i) {
            $this->tell($me, "n{$i}");
        }
        Sanctum::actingAs($me);

        $first = $this->getJson('/api/notifications?limit=2')->assertOk();
        $this->assertSame(['n5', 'n4'], collect($first->json('data'))->pluck('title')->all());

        $this->tell($me, 'arrived mid-scroll');

        $second = $this->getJson('/api/notifications?limit=2&before='.$first->json('next_before'))->assertOk();
        $this->assertSame(['n3', 'n2'], collect($second->json('data'))->pluck('title')->all());
    }

    public function test_the_list_can_be_narrowed_to_unread_and_to_a_category(): void
    {
        $me = User::factory()->create();
        $this->tell($me, 'drive');
        $this->tell($me, 'hack', NotificationType::HackathonPublished);
        UserNotification::where('title', 'drive')->update(['read_at' => now()]);
        Sanctum::actingAs($me);

        $this->assertSame(['hack'], collect($this->getJson('/api/notifications?unread=1')->json('data'))->pluck('title')->all());
        $this->assertSame(['drive'], collect($this->getJson('/api/notifications?category=drives')->json('data'))->pluck('title')->all());
        $this->getJson('/api/notifications?category=nonsense')->assertStatus(422);
    }

    // ───────────────────────────── reading, dismissing ─────────────────────────────

    public function test_marking_read_updates_the_count_and_is_scoped_to_you(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        $this->tell($me, 'mine');
        $this->tell($other, 'theirs');
        $mine = UserNotification::where('user_id', $me->id)->first();
        $theirs = UserNotification::where('user_id', $other->id)->first();

        Sanctum::actingAs($me);
        $this->postJson("/api/notifications/{$mine->id}/read")->assertOk()->assertJsonPath('unread_count', 0);
        $this->assertNotNull($mine->fresh()->read_at);

        // Someone else's id is "not found", never "forbidden" (which would confirm it exists) — and is left untouched.
        $this->postJson("/api/notifications/{$theirs->id}/read")->assertNotFound();
        $this->deleteJson("/api/notifications/{$theirs->id}")->assertNotFound();
        $this->assertNull($theirs->fresh()->read_at);
        $this->assertNotNull($theirs->fresh());
    }

    public function test_read_all_can_be_limited_to_one_category(): void
    {
        $me = User::factory()->create();
        $this->tell($me, 'drive');
        $this->tell($me, 'hack', NotificationType::HackathonPublished);
        Sanctum::actingAs($me);

        $this->postJson('/api/notifications/read-all', ['category' => 'drives'])->assertOk()->assertJsonPath('unread_count', 1);
        $this->postJson('/api/notifications/read-all')->assertOk()->assertJsonPath('unread_count', 0);
    }

    public function test_dismissing_and_clearing_read_ones(): void
    {
        $me = User::factory()->create();
        $this->tell($me, 'a');
        $this->tell($me, 'b');
        $this->tell($me, 'c');
        $ids = UserNotification::where('user_id', $me->id)->orderBy('id')->pluck('id');
        UserNotification::whereKey($ids[0])->update(['read_at' => now()]);
        Sanctum::actingAs($me);

        $this->deleteJson("/api/notifications/{$ids[2]}")->assertOk();
        $this->assertDatabaseMissing('user_notifications', ['id' => $ids[2]]);

        $this->deleteJson('/api/notifications/read')->assertOk();
        $this->assertSame([$ids[1]], UserNotification::where('user_id', $me->id)->pluck('id')->all());
    }

    public function test_it_needs_a_signed_in_user_and_a_view_as_session_can_read_but_not_change_anything(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();
        $this->getJson('/api/notifications/signal')->assertUnauthorized();
        $this->postJson('/api/notifications/read-all')->assertUnauthorized();
    }

    // ───────────────────────────── the service's guarantees ─────────────────────────────

    public function test_the_same_event_cannot_tell_the_same_person_twice(): void
    {
        $me = User::factory()->create();

        $this->tell($me, 'once', options: ['group_key' => 'drive:1']);
        $this->tell($me, 'once again', options: ['group_key' => 'drive:1']);
        $this->tell($me, 'no key', options: []);
        $this->tell($me, 'no key either', options: []);

        $this->assertSame(['once', 'no key', 'no key either'], UserNotification::where('user_id', $me->id)->orderBy('id')->pluck('title')->all());
    }

    public function test_a_blocked_account_is_never_written_to(): void
    {
        $blocked = User::factory()->create(['is_blocked' => true]);
        $fine = User::factory()->create();

        $written = $this->service()->notifyMany([$blocked->id, $fine->id], NotificationType::DriveLive, 'Hi');

        $this->assertSame(1, $written);
        $this->assertSame(0, UserNotification::where('user_id', $blocked->id)->count());
    }

    public function test_a_muted_category_is_skipped_but_account_and_plan_notifications_cannot_be_muted(): void
    {
        $me = User::factory()->create();
        Sanctum::actingAs($me);

        $this->putJson('/api/notifications/preferences', ['categories' => ['hackathons' => false, 'plan' => false, 'account' => false]])
            ->assertOk()
            ->assertJsonFragment(['category' => 'hackathons', 'enabled' => false, 'mandatory' => false])
            ->assertJsonFragment(['category' => 'plan', 'enabled' => true, 'mandatory' => true])
            ->assertJsonFragment(['category' => 'account', 'enabled' => true, 'mandatory' => true]);

        $this->tell($me, 'muted', NotificationType::HackathonPublished);
        $this->tell($me, 'plan stuff', NotificationType::PlanChanged);
        $this->tell($me, 'security', NotificationType::PasswordChanged);
        $this->tell($me, 'drive', NotificationType::DriveLive);

        $this->assertEqualsCanonicalizing(['plan stuff', 'security', 'drive'], UserNotification::where('user_id', $me->id)->pluck('title')->all());

        // …and turning it back on works.
        $this->putJson('/api/notifications/preferences', ['categories' => ['hackathons' => true]])->assertOk();
        $this->tell($me, 'back on', NotificationType::HackathonPublished);
        $this->assertTrue(UserNotification::where('title', 'back on')->exists());
    }

    public function test_preferences_ignore_unknown_categories(): void
    {
        $me = User::factory()->create();
        Sanctum::actingAs($me);

        $this->putJson('/api/notifications/preferences', ['categories' => ['made_up' => false]])->assertOk();
        $this->assertNull($me->fresh()->notification_prefs);
    }

    public function test_only_in_app_paths_are_kept_as_links(): void
    {
        $me = User::factory()->create();

        foreach (['/dashboard/drives', 'https://evil.example/x', '//evil.example', 'javascript:alert(1)', '/ok\\..\\bad'] as $i => $url) {
            $this->tell($me, "link {$i}", options: ['url' => $url]);
        }

        $urls = UserNotification::where('user_id', $me->id)->orderBy('id')->pluck('url')->all();
        $this->assertSame(['/dashboard/drives', null, null, null, null], $urls);
    }

    public function test_titles_and_bodies_are_capped(): void
    {
        $me = User::factory()->create();

        $this->service()->notify($me, NotificationType::DriveLive, str_repeat('t', 400), str_repeat('b', 900));

        $row = UserNotification::first();
        $this->assertLessThanOrEqual(160, mb_strlen($row->title));
        $this->assertLessThanOrEqual(500, mb_strlen($row->body));
    }

    public function test_a_bad_call_is_swallowed_not_thrown(): void
    {
        $this->assertFalse($this->service()->notify(999999, NotificationType::DriveLive, 'to nobody'));
        $this->assertSame(0, $this->service()->notifyMany([], NotificationType::DriveLive, 'to nobody'));
    }

    public function test_a_big_audience_is_written_in_chunks_not_one_row_at_a_time(): void
    {
        User::factory()->count(30)->create(['role' => User::ROLE_USER]);

        $written = $this->service()->notifyMany(User::query()->where('role', User::ROLE_USER), NotificationType::DriveLive, 'Everyone');

        $this->assertSame(30, $written);
        $this->assertSame(30, UserNotification::count());
    }

    public function test_deleting_a_user_removes_their_notifications(): void
    {
        $me = User::factory()->create();
        $this->tell($me);

        $me->delete();

        $this->assertSame(0, UserNotification::count());
    }

    public function test_pruning_drops_old_read_ones_and_very_old_unread_ones_but_keeps_recent_ones(): void
    {
        $me = User::factory()->create();
        foreach (['old read', 'old unread', 'fresh read', 'fresh unread', 'ancient unread'] as $t) {
            $this->tell($me, $t);
        }
        UserNotification::where('title', 'old read')->update(['read_at' => now()->subDays(70), 'created_at' => now()->subDays(70)]);
        UserNotification::where('title', 'old unread')->update(['created_at' => now()->subDays(70)]);
        UserNotification::where('title', 'fresh read')->update(['read_at' => now()->subDay()]);
        UserNotification::where('title', 'ancient unread')->update(['created_at' => now()->subDays(200)]);

        $this->artisan('notifications:prune')->assertSuccessful();

        $this->assertEqualsCanonicalizing(['old unread', 'fresh read', 'fresh unread'], UserNotification::pluck('title')->all());
    }
}
