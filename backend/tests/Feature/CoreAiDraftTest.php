<?php

namespace Tests\Feature;

use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The optional AI first-draft helper for question writers: off by default, always lands as a DRAFT, never trusts the
 * model's output into the bank unchecked.
 */
class CoreAiDraftTest extends TestCase
{
    use RefreshDatabase;

    private CoreSubject $subject;

    protected function setUp(): void
    {
        parent::setUp();

        // The migrations ship starter Domain Prep questions for the non-engineering departments; this test counts only its own.
        CoreQuestion::query()->delete();

        $this->subject = CoreSubject::where('discipline_code', 'ece')->where('code', 'analog_circuits')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_CORE_PREP]]));
    }

    private function body(array $over = []): array
    {
        return $over + ['discipline_code' => 'ece', 'subject_id' => $this->subject->id, 'topic_id' => $this->subject->topics()->first()->id, 'difficulty' => 'medium', 'type' => 'mcq_single', 'count' => 3];
    }

    private function fakeGemini(array $items): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($items)]]]]]], 200)]);
    }

    public function test_it_is_off_unless_switched_on(): void
    {
        config(['core_prep.ai_drafts.enabled' => false]);

        $this->postJson('/api/admin/core/questions/ai-draft', $this->body())->assertStatus(422)->assertJsonFragment(['message' => 'AI drafting is switched off. Ask a developer to set CORE_AI_DRAFTS=true.']);
        $this->assertSame(0, CoreQuestion::count());
    }

    public function test_drafts_land_as_drafts_labelled_as_ai_and_unsound_ones_are_dropped(): void
    {
        config(['core_prep.ai_drafts.enabled' => true, 'services.gemini.api_key' => 'test-key']);
        $this->fakeGemini([
            ['stem' => 'In a common-emitter amplifier, what does the emitter bypass capacitor do?', 'options' => ['Raises the mid-band gain', 'Lowers the input impedance to zero', 'Removes the DC bias', 'Doubles the supply'], 'correct_indexes' => [0], 'explanation' => 'It shorts RE for AC.', 'tags' => ['bjt']],
            ['stem' => 'Two answers marked for a single-answer question', 'options' => ['x', 'y', 'z', 'w'], 'correct_indexes' => [0, 1], 'explanation' => 'ambiguous'],
            ['stem' => 'A key that points at nothing', 'options' => ['x', 'y'], 'correct_indexes' => [7], 'explanation' => 'bad'],
        ]);

        $json = $this->postJson('/api/admin/core/questions/ai-draft', $this->body())->assertCreated()->json();

        $this->assertCount(1, $json['questions']);
        $this->assertSame(2, $json['rejected']);

        $q = CoreQuestion::firstOrFail();
        $this->assertSame('draft', $q->status);
        $this->assertSame('AI draft', $q->source);
        $this->assertSame(['a'], $q->correct);
        $this->assertSame('ece', $q->discipline_code);
        $this->assertSame($this->subject->id, $q->subject_id);
        $this->assertCount(4, $q->options);
    }

    public function test_a_numeric_draft_keeps_its_range_and_unit(): void
    {
        config(['core_prep.ai_drafts.enabled' => true, 'services.gemini.api_key' => 'test-key']);
        $this->fakeGemini([['stem' => 'A 10 V source drives 2 kΩ. What is the current in mA?', 'numeric_min' => 5, 'numeric_max' => 5, 'numeric_unit' => 'mA', 'explanation' => 'I = V/R.']]);

        $this->postJson('/api/admin/core/questions/ai-draft', $this->body(['type' => 'numeric', 'count' => 1]))->assertCreated();

        $q = CoreQuestion::firstOrFail();
        $this->assertSame('numeric', $q->type);
        $this->assertSame(5.0, (float) $q->numeric_min);
        $this->assertSame('mA', $q->numeric_unit);
        $this->assertSame('draft', $q->status);
    }

    public function test_the_prompt_asks_for_the_right_branch_subject_and_format(): void
    {
        config(['core_prep.ai_drafts.enabled' => true, 'services.gemini.api_key' => 'test-key']);
        $this->fakeGemini([]);

        $this->postJson('/api/admin/core/questions/ai-draft', $this->body(['difficulty' => 'hard', 'count' => 2]))->assertCreated();

        Http::assertSent(function (Request $request) {
            $prompt = (string) ($request['contents'][0]['parts'][0]['text'] ?? '');

            return str_contains($prompt, 'GATE EC') && str_contains($prompt, '"Analog Circuits"') && str_contains($prompt, 'Difficulty: hard') && str_contains($prompt, 'exactly 2 question');
        });
    }

    public function test_a_subject_from_another_branch_family_is_refused_and_so_is_a_request_for_too_many(): void
    {
        config(['core_prep.ai_drafts.enabled' => true, 'services.gemini.api_key' => 'test-key']);
        $mech = CoreSubject::where('discipline_code', 'mech')->firstOrFail();

        $this->postJson('/api/admin/core/questions/ai-draft', $this->body(['subject_id' => $mech->id, 'topic_id' => null]))->assertStatus(422);
        $this->postJson('/api/admin/core/questions/ai-draft', $this->body(['count' => 50]))->assertStatus(422);
    }

    public function test_without_the_permission_it_is_closed(): void
    {
        config(['core_prep.ai_drafts.enabled' => true]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_VAULT]]));

        $this->postJson('/api/admin/core/questions/ai-draft', $this->body())->assertForbidden();
    }
}
