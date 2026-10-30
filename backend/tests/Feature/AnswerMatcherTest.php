<?php

namespace Tests\Feature;

use App\Services\Answers\AnswerMatch;
use App\Services\Answers\AnswerMatcher;
use App\Services\Answers\AnswerText;
use Tests\TestCase;

/**
 * The study-mode answer matcher: plain text matching, no AI. It is tested against the REAL Second Mate (FG) bank, because what matters is
 * not that a unit behaves but that a student's spoken answer to a real question lands in a sensible colour.
 */
class AnswerMatcherTest extends TestCase
{
    private AnswerMatcher $matcher;

    /** @var list<array<string, mixed>> */
    private static array $bank = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->matcher = new AnswerMatcher;

        if (self::$bank === []) {
            foreach (require database_path('seeders/data/mock_questions/merchant_navy_mock.php') as $sets) {
                foreach ($sets as $set) {
                    foreach ($set as $q) {
                        self::$bank[] = $q;
                    }
                }
            }
        }
    }

    private function note(string $questionContains): string
    {
        foreach (self::$bank as $q) {
            if (str_contains($q['text'], $questionContains)) {
                return $q['note'];
            }
        }

        $this->fail("No question contains [{$questionContains}].");
    }

    // ───────────────────────────── the words ─────────────────────────────

    public function test_number_words_become_digits_so_a_spoken_figure_meets_a_written_one(): void
    {
        $this->assertSame(['35', 'degre'], AnswerText::tokens('thirty five degrees'));
        $this->assertSame(['35', 'degre'], AnswerText::tokens('35°'));
        $this->assertSame(['120'], AnswerText::tokens('one hundred and twenty'));
        $this->assertSame(['2000'], AnswerText::tokens('two thousand'));
        $this->assertSame(['28', 'second'], AnswerText::tokens('twenty-eight seconds'));
        $this->assertSame(['0_8'], AnswerText::tokens('0.8'));
        $this->assertSame(['3', 'prolong', 'blast'], AnswerText::tokens('three prolonged blasts'));
    }

    public function test_a_bare_one_is_a_pronoun_not_a_figure(): void
    {
        $this->assertSame(['officer'], AnswerText::tokens('one of the officers'));
        $this->assertSame(['not', 'master'], AnswerText::tokens('not one but the master'), 'a negation is kept');
        $this->assertSame(['1'], AnswerText::tokens('1'), 'a figure written as a digit stays');
    }

    public function test_word_endings_and_little_words_do_not_matter(): void
    {
        $this->assertSame(AnswerText::tokens('ventilate'), AnswerText::tokens('ventilating'));
        $this->assertSame(AnswerText::tokens('ventilation'), AnswerText::tokens('ventilated'));
        $this->assertSame(AnswerText::tokens('make'), AnswerText::tokens('making'));
        $this->assertSame(AnswerText::tokens('stop'), AnswerText::tokens('stopping'));
        $this->assertSame(AnswerText::tokens('manoeuvre'), AnswerText::tokens('maneuver'));
        $this->assertSame(AnswerText::tokens('on board'), AnswerText::tokens('onboard'));
        $this->assertSame([], AnswerText::tokens('um the of a'));
    }

    public function test_a_figure_outweighs_a_technical_term_which_outweighs_a_word_everyone_uses(): void
    {
        $this->assertGreaterThan(AnswerText::weight('ventilat'), AnswerText::weight('28'));
        $this->assertGreaterThan(AnswerText::weight('ship'), AnswerText::weight('ventilat'));
    }

    // ───────────────────────────── the match ─────────────────────────────

    public function test_every_model_answer_matches_itself_completely(): void
    {
        $this->assertCount(690, self::$bank);

        foreach (self::$bank as $q) {
            $m = $this->matcher->match($q['note'], $q['note']);
            $this->assertSame(100, $m->percent, 'self-match: '.$q['text']);
            $this->assertSame(0, $m->count(AnswerMatch::MISSED));
        }
    }

    public function test_an_answer_to_a_different_question_is_not_taken_for_a_good_one(): void
    {
        mt_srand(11);
        $n = count(self::$bank);
        $high = 0;
        $total = 0;
        $sum = 0;

        foreach (self::$bank as $q) {
            for ($k = 0; $k < 4; $k++) {
                do {
                    $other = self::$bank[mt_rand(0, $n - 1)];
                } while ($other['topic'] === $q['topic']);

                $p = $this->matcher->match($other['note'], $q['note'])->percent;
                $total++;
                $sum += $p;
                $this->assertLessThan(70, $p, 'never green: "'.$other['text'].'" answered as "'.$q['text'].'"');
                $high += $p >= 30 ? 1 : 0;
            }
        }

        $this->assertLessThan(10, $sum / $total, 'on average an unrelated answer matches almost nothing');
        $this->assertLessThan(0.01 * $total, $high, 'and is almost never even yellow');
    }

    public function test_a_good_spoken_answer_is_green_and_the_same_without_the_figures_is_not(): void
    {
        $ref = $this->note('SOLAS performance requirement for main steering gear');

        $strong = $this->matcher->match('the main steering gear must be able to put the rudder over from thirty five degrees on one side to thirty degrees on the other side in not more than twenty eight seconds with the ship at her maximum service speed', $ref);
        $this->assertSame('green', $strong->band);
        $this->assertGreaterThanOrEqual(70, $strong->percent);

        $vague = $this->matcher->match('the steering gear is a very important piece of equipment on every ship and it must always be tested and maintained so that the ship can be steered safely', $ref);
        $this->assertSame('red', $vague->band);

        $figuresOnly = $this->matcher->match('thirty five thirty twenty eight', $ref);
        $this->assertLessThan(30, $figuresOnly->percent, 'reciting the numbers is not an answer');
    }

    public function test_a_confident_wrong_figure_cannot_be_green(): void
    {
        $ref = $this->note('SOLAS performance requirement for main steering gear');

        $wrong = $this->matcher->match('the main steering gear must put the rudder from thirty five degrees one side to thirty degrees on the other side in sixty seconds at maximum service speed', $ref);

        $this->assertLessThanOrEqual(60, $wrong->percent);
        $this->assertNotSame('green', $wrong->band);
        // and the key point holding the figure is shown as only partly covered, never as covered
        $this->assertGreaterThan(0, $wrong->count(AnswerMatch::PARTIAL) + $wrong->count(AnswerMatch::MISSED));
    }

    public function test_a_word_said_once_is_not_counted_for_every_point_that_contains_it(): void
    {
        // "Safety Depth, Safety Contour, Shallow Contour, and Deep Contour": two of the four were named.
        $ref = $this->note('four critical safety depth/contour settings');
        $m = $this->matcher->match('there is the safety contour and the safety depth those are the main ones', $ref);

        $this->assertSame('yellow', $m->band);
        $this->assertSame(2, $m->count(AnswerMatch::COVERED));
        $this->assertSame(2, $m->count(AnswerMatch::MISSED));
    }

    public function test_order_and_phrasing_do_not_matter_only_what_was_said(): void
    {
        $ref = $this->note('four distinct stages of passage planning');

        $this->assertSame(100, $this->matcher->match('appraisal then planning then execution and finally monitoring', $ref)->percent);
        $this->assertSame(100, $this->matcher->match('monitoring, execution, planning, appraisal', $ref)->percent);
        $this->assertSame(42, $this->matcher->match('planning and monitoring', $ref)->percent);
    }

    public function test_speech_recognition_slips_are_forgiven(): void
    {
        $ref = $this->note("What is a Mate's Receipt");

        $slip = $this->matcher->match('a mates receipt is a provisional acknowledgement signed by the chief officer confirming the quantity and apparent condition of cargo received onboard before the bill of lading is issued', $ref);
        $this->assertSame('green', $slip->band);

        // "recieved", "aparent": typing and mishearing, one letter out
        $typo = $this->matcher->match('a provisional acknowledgment signed by the chief officer confirming the quantity and aparent condition of cargo recieved onboard before the bill of lading is issued', $ref);
        $this->assertGreaterThanOrEqual(85, $typo->percent);
    }

    public function test_nothing_said_scores_nothing_and_a_shrug_cannot_score_much(): void
    {
        $ref = $this->note("What is a Mate's Receipt");

        $this->assertSame(0, $this->matcher->match('', $ref)->percent);
        $this->assertSame(0, $this->matcher->match('   ', $ref)->percent);
        $this->assertLessThanOrEqual(15, $this->matcher->match('um I am not sure', $ref)->percent);
        $this->assertSame(0, $this->matcher->match('ballast water exchange must be done more than two hundred nautical miles from land', $ref)->percent);
    }

    public function test_the_segments_read_as_the_model_answer_exactly_as_written(): void
    {
        foreach (self::$bank as $q) {
            $m = $this->matcher->match('anything at all about ventilation', $q['note']);

            $this->assertSame(trim(preg_replace('/\s+/u', ' ', $q['note'])), $m->referenceText(), 'segments rejoin to the model answer: '.$q['text']);
            $this->assertNotEmpty($m->segments);

            foreach ($m->segments as $segment) {
                $this->assertContains($segment['status'], [AnswerMatch::COVERED, AnswerMatch::PARTIAL, AnswerMatch::MISSED]);
            }
        }
    }

    public function test_it_is_deterministic(): void
    {
        $ref = $this->note('immediate actions as OOW upon witnessing a Man Overboard');
        $said = 'first i release the lifebuoy with light and smoke put the helm hard over towards the side the person fell and inform the master';

        $this->assertSame($this->matcher->match($said, $ref)->toArray(), $this->matcher->match($said, $ref)->toArray());
    }

    public function test_the_bands_are_red_yellow_green_at_29_30_69_70(): void
    {
        $this->assertSame('red', AnswerMatch::bandFor(0));
        $this->assertSame('red', AnswerMatch::bandFor(29));
        $this->assertSame('yellow', AnswerMatch::bandFor(30));
        $this->assertSame('yellow', AnswerMatch::bandFor(69));
        $this->assertSame('green', AnswerMatch::bandFor(70));
        $this->assertSame('green', AnswerMatch::bandFor(100));

        // and a student's 10%, 50% and 90% are red, yellow and green
        $this->assertSame(['red', 'yellow', 'green'], [AnswerMatch::bandFor(10), AnswerMatch::bandFor(50), AnswerMatch::bandFor(90)]);
    }

    public function test_the_thresholds_are_config_not_code(): void
    {
        config(['answer_match.bands.green_from' => 90]);

        $this->assertSame('yellow', AnswerMatch::bandFor(85));
        $this->assertSame('green', AnswerMatch::bandFor(90));
    }

    public function test_it_never_touches_the_network(): void
    {
        \Illuminate\Support\Facades\Http::fake();

        $this->matcher->match('anything', $this->note("What is a Mate's Receipt"));

        \Illuminate\Support\Facades\Http::assertNothingSent();
    }
}
