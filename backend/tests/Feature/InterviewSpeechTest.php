<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use App\Services\Speech\GeminiSpeechSynthesizer;
use App\Services\Speech\InterviewSpeech;
use App\Services\Speech\SpeechManager;
use App\Services\Speech\SynthesizedSpeech;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The interviewer's voice: which provider speaks, that a question is synthesised once and then served from disk, that only the question
 * a candidate is on can be heard, that the browser voice takes over quietly when there is no voice, and that the next questions are
 * made ready while the current one is answered.
 */
class InterviewSpeechTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        config([
            'interview_speech.enabled' => true,
            'interview_speech.driver' => 'auto',
            'interview_speech.disk' => 'local',
            'interview_speech.drivers.gemini.api_key' => null,
            'interview_speech.drivers.openai.api_key' => null,
            'interview_speech.drivers.elevenlabs.api_key' => null,
        ]);
    }

    /** A WAV file the way Gemini returns one (header + 24 kHz 16-bit mono samples), base64'd inside its JSON. */
    private function geminiWav(int $samples = 2400): array
    {
        $wav = SynthesizedSpeech::wavFromPcm(str_repeat("\x01\x00", $samples))->bytes;

        return ['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'audio/wav', 'data' => base64_encode($wav)]]]]]]];
    }

    private function useGemini(): void
    {
        config(['interview_speech.drivers.gemini.api_key' => 'gemini-test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->geminiWav())]);
    }

    private function interview(int $questions = 3): Interview
    {
        $interview = Interview::create([
            'title' => 'General Screening',
            'slug' => Interview::uniqueSlug('General Screening'),
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
        ]);

        foreach (range(0, $questions - 1) as $i) {
            $bank = InterviewQuestionBank::create([
                'question_text' => "Tell me about topic number {$i} & what it means.",
                'category' => 'technical',
                'difficulty' => 'medium',
                'expected_duration_seconds' => 120,
                'tags' => [],
                'is_active' => true,
            ]);
            InterviewQuestion::create(['interview_id' => $interview->id, 'interview_question_bank_id' => $bank->id, 'display_order' => $i]);
        }

        return $interview;
    }

    private function student(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function questionIds(Interview $interview): array
    {
        return $interview->interviewQuestions()->orderBy('display_order')->pluck('id')->all();
    }

    private function speechUrl(Interview $interview, int $questionId): string
    {
        return "/api/interviews/{$interview->slug}/questions/{$questionId}/speech";
    }

    // ───────────────────────────── which provider speaks ─────────────────────────────

    public function test_with_no_key_there_is_no_voice_and_the_interview_says_so(): void
    {
        $interview = $this->interview();
        Sanctum::actingAs($this->student());

        $this->postJson("/api/interviews/{$interview->slug}/start")
            ->assertOk()
            ->assertJsonPath('speech.enabled', false);

        $this->getJson($this->speechUrl($interview, $this->questionIds($interview)[0]))
            ->assertStatus(503)
            ->assertJsonPath('code', 'speech_unavailable');
    }

    public function test_the_best_provider_with_a_key_speaks_and_a_switch_forces_one(): void
    {
        config(['interview_speech.drivers.gemini.api_key' => 'g', 'interview_speech.drivers.openai.api_key' => 'o']);
        $this->assertSame('openai', app(SpeechManager::class)->driver()->name());

        config(['interview_speech.drivers.elevenlabs.api_key' => 'e']);
        $this->assertSame('elevenlabs', app(SpeechManager::class)->driver()->name());

        config(['interview_speech.driver' => 'gemini']);
        $this->assertSame('gemini', app(SpeechManager::class)->driver()->name());

        // Naming a provider that has no key does not silently fall through to another.
        config(['interview_speech.driver' => 'openai', 'interview_speech.drivers.openai.api_key' => null]);
        $this->assertNull(app(SpeechManager::class)->driver());

        config(['interview_speech.enabled' => false, 'interview_speech.driver' => 'auto']);
        $this->assertNull(app(SpeechManager::class)->driver());
    }

    public function test_gemini_is_asked_for_the_chosen_voice_with_the_bare_text_and_nothing_to_be_read_out(): void
    {
        $this->useGemini();
        config(['interview_speech.drivers.gemini.voice' => 'Kore', 'interview_speech.drivers.gemini.model' => 'gemini-3.8-flash-tts']);

        app(GeminiSpeechSynthesizer::class, ['config' => config('interview_speech.drivers.gemini')])->synthesize('Hello there.');

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'gemini-3.8-flash-tts:generateContent')
                && $request->header('x-goog-api-key')[0] === 'gemini-test-key'
                && $request['contents'][0]['parts'][0]['text'] === 'Hello there.' // no style prefix: Gemini would read it aloud
                && $request['generationConfig']['responseModalities'] === ['AUDIO']
                && $request['generationConfig']['speechConfig']['voiceConfig']['prebuiltVoiceConfig']['voiceName'] === 'Kore';
        });
    }

    public function test_bare_pcm_from_gemini_is_given_a_wav_container(): void
    {
        $pcm = str_repeat("\x02\x00", 4800);
        config(['interview_speech.drivers.gemini.api_key' => 'k']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'audio/L16;codec=pcm;rate=24000', 'data' => base64_encode($pcm)]]]]]]])]);

        $clip = app(SpeechManager::class)->driver()->synthesize('Hi.');

        $this->assertSame('audio/wav', $clip->mime);
        $this->assertSame('RIFF', substr($clip->bytes, 0, 4));
        $this->assertSame('WAVE', substr($clip->bytes, 8, 4));
        $this->assertSame(24000, unpack('V', substr($clip->bytes, 24, 4))[1]);
        $this->assertSame(strlen($pcm), unpack('V', substr($clip->bytes, 40, 4))[1]);
        $this->assertSame($pcm, substr($clip->bytes, 44));
    }

    public function test_elevenlabs_and_openai_are_called_the_way_their_apis_expect(): void
    {
        config(['interview_speech.drivers.elevenlabs.api_key' => 'el-key', 'interview_speech.drivers.elevenlabs.voice' => 'VOICE123']);
        Http::fake(['api.elevenlabs.io/*' => Http::response('MP3BYTES', 200, ['Content-Type' => 'audio/mpeg'])]);

        $clip = app(SpeechManager::class)->driver()->synthesize('Hello.');
        $this->assertSame('MP3BYTES', $clip->bytes);
        $this->assertSame('mp3', $clip->extension);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/v1/text-to-speech/VOICE123?output_format=mp3_44100_128')
            && $r->header('xi-api-key')[0] === 'el-key'
            && $r['model_id'] === 'eleven_multilingual_v2'
            && $r['text'] === 'Hello.'
            && isset($r['voice_settings']['stability']));

        config(['interview_speech.drivers.elevenlabs.api_key' => null, 'interview_speech.drivers.openai.api_key' => 'oa-key']);
        Http::fake(['api.openai.com/*' => Http::response('OPENAIMP3', 200)]);

        $clip = app(SpeechManager::class)->driver()->synthesize('Hello.');
        $this->assertSame('OPENAIMP3', $clip->bytes);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'api.openai.com/v1/audio/speech')
            && $r->header('Authorization')[0] === 'Bearer oa-key'
            && $r['model'] === 'gpt-4o-mini-tts'
            && $r['voice'] === 'marin'
            && $r['input'] === 'Hello.'
            && ! empty($r['instructions']));
    }

    // ───────────────────────────── caching ─────────────────────────────

    public function test_a_question_is_synthesised_once_and_then_served_from_disk_for_everyone(): void
    {
        $this->useGemini();
        $interview = $this->interview();
        $first = $this->questionIds($interview)[0];

        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk()->assertJsonPath('speech.enabled', true);

        $response = $this->get($this->speechUrl($interview, $first))->assertOk();
        $this->assertSame('audio/wav', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertSame('RIFF', substr($response->streamedContent(), 0, 4));

        // Asked again, and by another candidate sitting the same interview: no second provider call for that question.
        $this->get($this->speechUrl($interview, $first))->assertOk();
        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        $this->get($this->speechUrl($interview, $first))->assertOk();

        $calls = collect(Http::recorded())->filter(fn ($pair) => str_contains($pair[0]->url(), 'generativelanguage'))->count();
        // Question 0 once; question 1 once (the start() warm-up, for the first candidate; the second finds it cached).
        $this->assertSame(2, $calls);
    }

    public function test_a_different_voice_never_gets_the_old_voices_audio(): void
    {
        $this->useGemini();
        $speech = app(InterviewSpeech::class);

        $speech->forText('Same words.');
        config(['interview_speech.drivers.gemini.voice' => 'Kore']);
        $speech->forText('Same words.');

        $this->assertCount(2, Storage::disk('local')->files('interview-speech'));
    }

    public function test_the_text_is_tidied_before_it_is_spoken_and_cached_by_what_is_spoken(): void
    {
        $this->assertSame('Use a and b to fine and done', InterviewSpeech::prepare("Use `a`   and\n `b` -> fine & done"));

        $this->useGemini();
        $speech = app(InterviewSpeech::class);
        $speech->forText('Hello   world');
        $speech->forText("Hello\nworld");

        $this->assertCount(1, Storage::disk('local')->files('interview-speech'));
    }

    public function test_an_overlong_text_is_never_sent_to_a_paid_api(): void
    {
        $this->useGemini();

        $this->assertNull(app(InterviewSpeech::class)->forText(str_repeat('word ', 400)));
        Http::assertNothingSent();
    }

    public function test_a_provider_failure_is_a_quiet_503_so_the_browser_voice_takes_over(): void
    {
        config(['interview_speech.drivers.gemini.api_key' => 'k']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'quota']], 403)]);
        $interview = $this->interview();
        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();

        $this->getJson($this->speechUrl($interview, $this->questionIds($interview)[0]))
            ->assertStatus(503)
            ->assertJsonPath('code', 'speech_unavailable');
        $this->assertCount(0, Storage::disk('local')->files('interview-speech'));
    }

    public function test_when_the_provider_says_slow_down_the_voice_backs_off_instead_of_hammering_it(): void
    {
        config(['interview_speech.drivers.gemini.api_key' => 'k']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['code' => 429, 'message' => 'You exceeded your current quota']], 429)]);
        $speech = app(InterviewSpeech::class);

        $this->assertNull($speech->forText('First question.'));
        $this->assertTrue($speech->coolingDown());
        // No retry inside the failed attempt, and nothing at all while cooling down: the candidate gets the browser voice straight away.
        $this->assertNull($speech->forText('Second question.'));
        $this->assertNull($speech->forText('Third question.'));
        Http::assertSentCount(1);
    }

    public function test_clips_already_made_are_still_served_while_the_provider_is_cooling_down(): void
    {
        $this->useGemini();
        $speech = app(InterviewSpeech::class);
        $this->assertNotNull($speech->forText('A question that was made earlier.'));

        \Illuminate\Support\Facades\Cache::put('interview-speech:cooldown', true, 60);

        $this->assertNotNull($speech->forText('A question that was made earlier.'));
        $this->assertNull($speech->forText('A brand new one.'));
    }

    // ───────────────────────────── who may hear what ─────────────────────────────

    public function test_only_the_current_or_an_already_answered_question_can_be_heard(): void
    {
        $this->useGemini();
        $interview = $this->interview(3);
        [$q0, $q1, $q2] = $this->questionIds($interview);
        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();

        $this->get($this->speechUrl($interview, $q0))->assertOk();
        $this->getJson($this->speechUrl($interview, $q1))->assertNotFound(); // not asked yet
        $this->getJson($this->speechUrl($interview, $q2))->assertNotFound();

        $this->postJson("/api/interviews/{$interview->slug}/answer", ['interview_question_id' => $q0, 'transcript_text' => 'My answer.'])->assertOk();

        $this->get($this->speechUrl($interview, $q1))->assertOk();
        $this->get($this->speechUrl($interview, $q0))->assertOk(); // an answered one is still fine
        $this->getJson($this->speechUrl($interview, $q2))->assertNotFound();
    }

    public function test_someone_who_has_not_started_the_interview_hears_nothing(): void
    {
        $this->useGemini();
        $interview = $this->interview();
        Sanctum::actingAs($this->student());

        $this->getJson($this->speechUrl($interview, $this->questionIds($interview)[0]))->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_a_question_from_another_interview_cannot_be_asked_through_this_one(): void
    {
        $this->useGemini();
        $mine = $this->interview();
        $other = $this->interview();
        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$mine->slug}/start")->assertOk();

        $this->getJson($this->speechUrl($mine, $this->questionIds($other)[0]))->assertNotFound();
    }

    public function test_nothing_is_served_once_the_interview_is_complete_or_without_a_login(): void
    {
        $this->useGemini();
        $interview = $this->interview(1);
        $q0 = $this->questionIds($interview)[0];

        $this->getJson($this->speechUrl($interview, $q0))->assertUnauthorized();

        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        $this->postJson("/api/interviews/{$interview->slug}/answer", ['interview_question_id' => $q0, 'transcript_text' => 'Done.'])->assertOk();

        $this->getJson($this->speechUrl($interview, $q0))->assertNotFound();
    }

    // ───────────────────────────── the fixed lines ─────────────────────────────

    public function test_the_interviewers_fixed_lines_are_offered_with_their_text_and_only_those(): void
    {
        $this->useGemini();
        $interview = $this->interview();
        Sanctum::actingAs($this->student());

        $this->postJson("/api/interviews/{$interview->slug}/start")
            ->assertOk()
            ->assertJsonPath('speech.lines.greeting', config('interview_speech.lines.greeting'))
            ->assertJsonPath('speech.lines.welcome_back', config('interview_speech.lines.welcome_back'));

        $this->get('/api/interviews-speech/lines/greeting')->assertOk();
        Http::assertSent(fn ($r) => $r['contents'][0]['parts'][0]['text'] === InterviewSpeech::prepare(config('interview_speech.lines.greeting')));

        // Not a text-to-speech service anyone can borrow.
        $this->getJson('/api/interviews-speech/lines/anything-else')->assertNotFound();
    }

    public function test_the_briefing_page_is_told_whether_the_voice_can_be_previewed(): void
    {
        $interview = $this->interview();
        Sanctum::actingAs($this->student());

        $this->getJson("/api/interviews/{$interview->slug}")->assertOk()->assertJsonPath('voice_preview', null);

        $this->useGemini();
        $this->getJson("/api/interviews/{$interview->slug}")
            ->assertOk()
            ->assertJsonPath('voice_preview.text', config('interview_speech.lines.greeting'));
    }

    // ───────────────────────────── ready before it is needed ─────────────────────────────

    public function test_the_question_after_the_current_one_is_made_ready_while_the_current_one_is_answered(): void
    {
        $this->useGemini();
        $interview = $this->interview(4);
        [$q0, $q1, $q2, $q3] = $this->questionIds($interview);
        $text = fn (int $id) => InterviewSpeech::prepare(InterviewQuestion::with('questionBank')->find($id)->questionBank->question_text);
        $spoken = fn () => collect(Http::recorded())->map(fn ($pair) => $pair[0]['contents'][0]['parts'][0]['text'] ?? null)->all();

        Sanctum::actingAs($this->student());
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        // Starting made question 1 ready (question 0 is the candidate's own request to make).
        $this->assertContains($text($q1), $spoken());
        $this->assertNotContains($text($q0), $spoken());

        $this->get($this->speechUrl($interview, $q0))->assertOk();
        $this->postJson("/api/interviews/{$interview->slug}/answer", ['interview_question_id' => $q0, 'transcript_text' => 'A.'])->assertOk();
        // Answering made question 2 ready; question 1 was already waiting.
        $this->assertContains($text($q2), $spoken());
        $this->assertNotContains($text($q3), $spoken());
    }

    public function test_warming_does_nothing_and_breaks_nothing_when_there_is_no_voice(): void
    {
        $interview = $this->interview(2);
        Sanctum::actingAs($this->student());

        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        $this->postJson("/api/interviews/{$interview->slug}/answer", ['interview_question_id' => $this->questionIds($interview)[0], 'transcript_text' => 'A.'])->assertOk();
        Http::assertNothingSent();
    }

    public function test_the_whole_bank_can_be_made_ready_in_one_command(): void
    {
        $this->useGemini();
        InterviewQuestionBank::create(['question_text' => 'One?', 'category' => 'hr', 'difficulty' => 'easy', 'expected_duration_seconds' => 60, 'tags' => [], 'is_active' => true]);
        InterviewQuestionBank::create(['question_text' => 'Two?', 'category' => 'hr', 'difficulty' => 'easy', 'expected_duration_seconds' => 60, 'tags' => [], 'is_active' => true]);
        InterviewQuestionBank::create(['question_text' => 'Retired?', 'category' => 'hr', 'difficulty' => 'easy', 'expected_duration_seconds' => 60, 'tags' => [], 'is_active' => false]);

        $this->artisan('interview:warm-speech')->assertSuccessful();

        // Every distinct active question + the 2 fixed lines; the retired question costs nothing. (The bank may already hold seeded questions.)
        $distinct = InterviewQuestionBank::where('is_active', true)->pluck('question_text')->map(fn ($t) => InterviewSpeech::prepare($t))->unique()->count();
        $this->assertCount($distinct + 2, Storage::disk('local')->files('interview-speech'));
        $this->assertNotContains(InterviewSpeech::prepare('Retired?'), collect(Http::recorded())->map(fn ($p) => $p[0]['contents'][0]['parts'][0]['text'] ?? null)->all());
        $before = count(Http::recorded());
        $this->artisan('interview:warm-speech')->assertSuccessful();
        $this->assertSame($before, count(Http::recorded()), 'a second run finds everything already made');
    }

    public function test_auditioning_voices_writes_one_clip_per_voice(): void
    {
        $this->useGemini();
        $out = storage_path('framework/testing/speech-samples-'.uniqid());

        $this->artisan('interview:speech-sample', ['--voices' => 'Kore,Achird', '--out' => $out])->assertSuccessful();

        $this->assertFileExists("{$out}/gemini-Kore.wav");
        $this->assertFileExists("{$out}/gemini-Achird.wav");
        @unlink("{$out}/gemini-Kore.wav");
        @unlink("{$out}/gemini-Achird.wav");
        @rmdir($out);
    }
}
