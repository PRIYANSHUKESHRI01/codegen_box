<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VocabularyAnswer;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use Database\Seeders\VocabularyWordSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsVocabularyWords;
use Tests\TestCase;

/**
 * The numbers behind the Vocabulary Sprint home page, the Word Bank and the
 * Learning Centre hub card.
 */
class VocabularyOverviewTest extends TestCase
{
    use BuildsVocabularyWords;
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(VocabularyWordSeeder::class);
        $this->student = $this->vocabStudent();
        Sanctum::actingAs($this->student);
    }

    private function overview(): array
    {
        return $this->getJson('/api/learning-centre/vocabulary/overview')->assertStatus(200)->json();
    }

    private function word(string $text): VocabularyWord
    {
        return VocabularyWord::whereNull('user_id')->where('word', $text)->firstOrFail();
    }

    /** A recorded answer on a given day, without going through a whole session. */
    private function answeredOn(Carbon $day, bool $correct = true): void
    {
        $attempt = VocabularyAttempt::create(['user_id' => $this->student->id, 'kind' => 'daily', 'topic' => 't', 'difficulty' => 'mixed', 'questions' => []]);
        DB::table('vocabulary_answers')->insert([
            'user_id' => $this->student->id, 'vocabulary_attempt_id' => $attempt->id, 'question_index' => 0,
            'type' => 'meaning', 'is_correct' => $correct, 'created_at' => $day,
        ]);
    }

    // ---- the home page ------------------------------------------------------------------------------

    public function test_a_brand_new_student_sees_a_full_library_and_an_inviting_first_sprint(): void
    {
        $o = $this->overview();

        $this->assertSame(['library_words' => 160, 'new' => 160, 'learning' => 0, 'familiar' => 0, 'mastered' => 0, 'due_today' => 0, 'weak' => 0, 'my_words' => 0, 'mastered_this_week' => 0], $o['totals']);
        $this->assertSame(['answered' => 0, 'goal' => 10, 'goal_reached' => false, 'streak_days' => 0, 'accuracy_7d' => null], $o['today']);
        $this->assertSame(
            ['state' => 'ready', 'new_words' => 4, 'reviews_due' => 0, 'questions' => 8, 'minutes' => 3, 'focus_deck' => ['slug' => 'workplace-essentials', 'title' => 'Workplace essentials']],
            $o['next_sprint']
        );
        $this->assertNull($o['resume']);

        $this->assertCount(8, $o['decks']);
        $this->assertSame('workplace-essentials', $o['decks'][0]['slug'], 'in learning-path order');
        $this->assertSame([20, 20, 0, 0, 0, 0], [$o['decks'][0]['total'], $o['decks'][0]['new'], $o['decks'][0]['learning'], $o['decks'][0]['familiar'], $o['decks'][0]['mastered'], $o['decks'][0]['due']]);
        $this->assertSame('beginner', $o['decks'][0]['level']);
        $this->assertNotSame('', $o['decks'][0]['tagline']);
    }

    public function test_totals_and_decks_follow_each_words_box(): void
    {
        $mastered = [$this->word('deadline'), $this->word('agenda')];
        $familiar = [$this->word('minutes'), $this->word('postpone'), $this->word('delegate')];
        $learning = $this->word('remind');
        foreach ($mastered as $w) {
            $this->progress($this->student, $w, ['box' => 4, 'due_on' => today()->addDays(9), 'mastered_at' => now()]);
        }
        $this->progress($this->student, $this->word('tone'), ['box' => 5, 'due_on' => today()->addDays(30), 'mastered_at' => now()->subWeeks(3)]);
        foreach ($familiar as $w) {
            $this->progress($this->student, $w, ['box' => 2, 'due_on' => today()->addDays(2)]);
        }
        $this->progress($this->student, $learning, ['box' => 1, 'due_on' => today()]);

        $o = $this->overview();

        $this->assertSame([160 - 7, 1, 3, 3], [$o['totals']['new'], $o['totals']['learning'], $o['totals']['familiar'], $o['totals']['mastered']]);
        $this->assertSame(2, $o['totals']['mastered_this_week'], 'tone was mastered three weeks ago');
        $this->assertSame(1, $o['totals']['due_today'], 'only "remind" is due');
        $workplace = $o['decks'][0];
        $this->assertSame([20 - 6, 1, 3, 2, 1], [$workplace['new'], $workplace['learning'], $workplace['familiar'], $workplace['mastered'], $workplace['due']]);
    }

    public function test_words_a_student_saved_from_ai_quizzes_never_inflate_the_library_totals(): void
    {
        $mine = $this->privateWord($this->student, 'zebra');
        $this->progress($this->student, $mine, ['box' => 4, 'mastered_at' => now(), 'due_on' => today()->addDays(9)]);
        $this->progress($this->vocabStudent(), $this->privateWord(User::factory()->create(['role' => User::ROLE_USER]), 'yak'));

        $o = $this->overview();

        $this->assertSame([160, 160, 0, 1], [$o['totals']['library_words'], $o['totals']['new'], $o['totals']['mastered'], $o['totals']['my_words']]);
    }

    public function test_the_word_of_the_day_is_the_same_for_everyone_and_changes_with_the_date(): void
    {
        Carbon::setTestNow('2026-10-10 09:00:00');
        $first = $this->overview()['word_of_the_day'];
        Sanctum::actingAs($this->vocabStudent());
        $this->assertSame($first['id'], $this->overview()['word_of_the_day']['id'], 'a shared word, no storage needed');

        Carbon::setTestNow('2026-10-11 09:00:00');
        $second = $this->overview()['word_of_the_day'];

        $this->assertNotSame($first['id'], $second['id']);
        foreach ([$first, $second] as $wotd) {
            $this->assertSame('new', $wotd['status']);
            $this->assertNotSame('', $wotd['meaning']);
            $this->assertNotSame('', $wotd['example']);
            $this->assertNotNull($wotd['deck_title']);
        }
        Carbon::setTestNow();
    }

    public function test_today_counts_answers_accuracy_and_a_streak_of_consecutive_days(): void
    {
        $this->answeredOn(today()->subDays(2));
        $this->answeredOn(today()->subDay());
        foreach (range(1, 4) as $_) {
            $this->answeredOn(now());
        }
        $this->answeredOn(now(), false);

        $today = $this->overview()['today'];

        $this->assertSame(5, $today['answered']);
        $this->assertSame(3, $today['streak_days']);
        $this->assertSame(86, $today['accuracy_7d'], '6 of 7 answers in the past week were right');
        $this->assertFalse($today['goal_reached']);
    }

    public function test_a_gap_of_a_day_breaks_the_streak_and_accuracy_needs_five_answers_to_mean_anything(): void
    {
        $this->answeredOn(today()->subDays(3));
        $this->answeredOn(today()->subDays(2));
        $this->answeredOn(now());

        $today = $this->overview()['today'];

        $this->assertSame(1, $today['streak_days'], 'yesterday is missing');
        $this->assertNull($today['accuracy_7d'], 'three answers are too few to call an accuracy');
    }

    public function test_the_goal_is_reached_after_ten_answers_today(): void
    {
        foreach (range(1, 10) as $_) {
            $this->answeredOn(now());
        }

        $this->assertTrue($this->overview()['today']['goal_reached']);
    }

    public function test_an_unfinished_session_is_offered_back_and_a_finished_one_is_not(): void
    {
        $this->assertNull($this->overview()['resume']);

        $attempt = $this->postJson('/api/learning-centre/vocabulary/sessions', ['kind' => 'daily'])->json('attempt_id');
        $this->assertSame(
            ['attempt_id' => $attempt, 'kind' => 'daily', 'title' => "Today\u{2019}s sprint", 'answered' => 0, 'total' => 8],
            $this->overview()['resume']
        );

        VocabularyAttempt::whereKey($attempt)->update(['submitted_at' => now()]);
        $this->assertNull($this->overview()['resume']);
    }

    public function test_the_preview_on_the_start_button_is_exactly_what_the_sprint_delivers(): void
    {
        foreach (['deadline', 'agenda', 'minutes', 'postpone', 'delegate', 'remind', 'urgent'] as $text) {
            $this->progress($this->student, $this->word($text), ['box' => 2]); // 7 due
        }

        $preview = $this->overview()['next_sprint'];
        $session = $this->postJson('/api/learning-centre/vocabulary/sessions', ['kind' => 'daily'])->json();

        $this->assertSame([$session['new_count'], $session['review_count'], $session['total']], [$preview['new_words'], $preview['reviews_due'], $preview['questions']]);
        $this->assertSame([3, 6, 12], [$preview['new_words'], $preview['reviews_due'], $preview['questions']]);
        $this->assertSame(4, $preview['minutes']);
    }

    public function test_when_everything_is_scheduled_the_preview_says_free_practice(): void
    {
        $now = now();
        VocabularyWord::whereNull('user_id')->pluck('id')->chunk(100)->each(fn ($ids) => VocabularyWordProgress::insert(
            $ids->map(fn ($id) => [
                'user_id' => $this->student->id, 'vocabulary_word_id' => $id, 'box' => 2, 'streak' => 1, 'seen_count' => 2,
                'correct_count' => 2, 'lapse_count' => 0, 'last_seen_at' => $now, 'due_on' => today()->addDays(3), 'created_at' => $now, 'updated_at' => $now,
            ])->all()
        ));

        $preview = $this->overview()['next_sprint'];

        $this->assertSame(['practice', 0, 0], [$preview['state'], $preview['new_words'], $preview['reviews_due']]);
        $this->assertSame(10, $preview['questions']);
        $this->assertNull($preview['focus_deck']);
    }

    public function test_the_sprint_draws_new_words_from_wherever_the_student_last_practised(): void
    {
        $this->progress($this->student, $this->word('affect'), ['box' => 1, 'due_on' => today()->addDay()]);
        $attempt = VocabularyAttempt::create(['user_id' => $this->student->id, 'kind' => 'deck', 'topic' => 't', 'difficulty' => 'mixed', 'questions' => []]);
        VocabularyAnswer::create(['user_id' => $this->student->id, 'vocabulary_attempt_id' => $attempt->id, 'question_index' => 0, 'vocabulary_word_id' => $this->word('affect')->id, 'type' => 'meaning', 'is_correct' => true]);

        $focus = $this->overview()['next_sprint']['focus_deck'];

        $this->assertSame('confusing-pairs', $focus['slug'], 'carry on where you left off');
    }

    // ---- the word bank --------------------------------------------------------------------------------

    private function words(string $query = '')
    {
        return $this->getJson('/api/learning-centre/vocabulary/words'.($query ? "?{$query}" : ''));
    }

    public function test_the_word_bank_lists_the_library_in_path_order_with_counts_and_paging(): void
    {
        $page1 = $this->words()->assertStatus(200)->json();

        $this->assertCount(40, $page1['words']);
        $this->assertSame([160, 40, true, 1], [$page1['total'], $page1['per_page'], $page1['has_more'], $page1['page']]);
        $this->assertSame(['all' => 160, 'new' => 160, 'learning' => 0, 'familiar' => 0, 'mastered' => 0, 'weak' => 0], $page1['counts']);
        $this->assertSame('deadline', $page1['words'][0]['word']);
        $this->assertSame('workplace-essentials', $page1['words'][0]['deck']);
        $this->assertSame('Workplace essentials', $page1['words'][0]['deck_title']);

        $last = $this->words('page=4')->json();
        $this->assertCount(40, $last['words']);
        $this->assertFalse($last['has_more']);
        $this->assertSame([], $this->words('page=5')->json('words'));
    }

    public function test_each_word_shows_where_the_student_stands_with_it(): void
    {
        $this->progress($this->student, $this->word('deadline'), ['box' => 3, 'seen_count' => 4, 'correct_count' => 4, 'due_on' => today()->addDays(7)]);

        $row = $this->words('q=deadline')->json('words.0');

        $this->assertSame(['familiar', 3, 4, 4, false, 'in 7 days'], [$row['status'], $row['box'], $row['seen_count'], $row['correct_count'], $row['is_weak'], $row['next_review']]);
        $this->assertSame(['id', 'word', 'part_of_speech', 'level', 'deck', 'deck_title', 'meaning', 'example', 'synonyms', 'note', 'pair_word', 'is_mine', 'status', 'box', 'seen_count', 'correct_count', 'is_weak', 'next_review'], array_keys($row));
        $this->assertNotContains('distractors', array_keys($row), 'authored wrong answers are not for students');
    }

    public function test_the_word_bank_filters_by_status_deck_and_search(): void
    {
        $this->progress($this->student, $this->word('deadline'), ['box' => 4, 'mastered_at' => now(), 'due_on' => today()->addDays(9)]);
        $this->progress($this->student, $this->word('agenda'), ['box' => 1]);
        $this->progress($this->student, $this->word('minutes'), ['box' => 2, 'seen_count' => 5, 'correct_count' => 1]);

        $this->assertSame(['deadline'], array_column($this->words('status=mastered')->json('words'), 'word'));
        $this->assertSame(['agenda'], array_column($this->words('status=learning')->json('words'), 'word'));
        $this->assertSame(['minutes'], array_column($this->words('status=familiar')->json('words'), 'word'));
        $this->assertSame(['minutes'], array_column($this->words('status=weak')->json('words'), 'word'));
        $this->assertSame(157, $this->words('status=new')->json('total'));

        $pairs = $this->words('deck=confusing-pairs')->json();
        $this->assertSame(20, $pairs['total']);
        $this->assertSame(20, $pairs['counts']['all']);

        $this->assertSame(['mitigate'], array_column($this->words('q=MITIG')->json('words'), 'word'), 'search ignores case');
        $this->assertSame(['ubiquitous'], array_column($this->words('q=present+everywhere')->json('words'), 'word'), 'and looks in meanings too');
        $this->assertSame([], $this->words('q=zzzzzz')->json('words'));
    }

    public function test_status_counts_ignore_the_status_filter_but_respect_deck_and_search(): void
    {
        $this->progress($this->student, $this->word('affect'), ['box' => 4, 'mastered_at' => now(), 'due_on' => today()->addDays(9)]);

        $counts = $this->words('deck=confusing-pairs&status=mastered')->json('counts');

        $this->assertSame(['all' => 20, 'new' => 19, 'learning' => 0, 'familiar' => 0, 'mastered' => 1, 'weak' => 0], $counts, 'the pills keep showing every status within the chosen deck');
    }

    public function test_my_words_lists_only_the_students_own_saved_words(): void
    {
        $mine = $this->privateWord($this->student, 'zebra');
        $this->privateWord(User::factory()->create(['role' => User::ROLE_USER]), 'yak');
        $this->progress($this->student, $mine, ['box' => 0]);

        $list = $this->words('deck=mine')->json();

        $this->assertSame(['zebra'], array_column($list['words'], 'word'));
        $this->assertTrue($list['words'][0]['is_mine']);
        $this->assertNull($list['words'][0]['deck_title']);
        $this->assertSame('learning', $list['words'][0]['status']);

        $all = array_column($this->words('q=yak')->json('words'), 'word');
        $this->assertSame([], $all, 'nobody else\'s saved words are visible');
    }

    public function test_word_bank_parameters_are_validated(): void
    {
        $this->words('status=nonsense')->assertStatus(422);
        $this->words('deck=nonsense')->assertStatus(422);
        $this->words('page=0')->assertStatus(422);
        $this->words('q='.str_repeat('a', 61))->assertStatus(422);
    }

    public function test_the_vocabulary_endpoints_need_a_login(): void
    {
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/learning-centre/vocabulary/overview')->assertStatus(401);
        $this->getJson('/api/learning-centre/vocabulary/words')->assertStatus(401);
    }

    // ---- the Learning Centre hub -----------------------------------------------------------------------

    public function test_the_hub_reports_real_mastery_not_just_answers_that_happened_to_be_right(): void
    {
        $this->progress($this->student, $this->word('deadline'), ['box' => 4, 'mastered_at' => now(), 'due_on' => today()->addDays(9)]);
        $this->progress($this->student, $this->word('agenda'), ['box' => 5, 'mastered_at' => now()->subWeeks(4), 'due_on' => today()->addDays(30)]);
        $this->progress($this->student, $this->word('minutes'), ['box' => 2, 'due_on' => today()]);

        $hub = $this->getJson('/api/learning-centre/overview')->assertStatus(200)->json();

        $this->assertSame(1, $hub['words_mastered_this_week']);
        $this->assertSame(2, $hub['words_mastered_total']);
        $this->assertSame(160, $hub['vocabulary_words_total']);
        $this->assertSame(1, $hub['vocabulary_due']);
    }

    public function test_answering_vocabulary_counts_toward_the_hub_streak_and_sessions(): void
    {
        $attempt = $this->postJson('/api/learning-centre/vocabulary/sessions', ['kind' => 'daily'])->json('attempt_id');
        $total = count(VocabularyAttempt::findOrFail($attempt)->questions);

        $this->postJson("/api/learning-centre/vocabulary/attempts/{$attempt}/answer", ['index' => 0, 'answer' => 0])->assertStatus(200);
        $partial = $this->getJson('/api/learning-centre/overview')->json();
        $this->assertSame(1, $partial['day_streak'], 'one answer is enough to keep the habit going');
        $this->assertSame(0, $partial['total_sessions'], 'but it is not a finished session yet');

        foreach (range(1, $total - 1) as $i) {
            $this->postJson("/api/learning-centre/vocabulary/attempts/{$attempt}/answer", ['index' => $i, 'answer' => 0])->assertStatus(200);
        }
        $this->assertSame(1, $this->getJson('/api/learning-centre/overview')->json('total_sessions'));
    }

    public function test_quizzes_finished_before_this_upgrade_still_count_toward_the_streak(): void
    {
        VocabularyAttempt::create([
            'user_id' => $this->student->id, 'topic' => 'Old', 'difficulty' => 'beginner', 'questions' => [],
            'score' => 80, 'passed' => true, 'submitted_at' => now()->subDay(),
        ]);

        $this->assertSame(1, $this->getJson('/api/learning-centre/overview')->json('day_streak'));
    }
}
