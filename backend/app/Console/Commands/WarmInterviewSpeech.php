<?php

namespace App\Console\Commands;

use App\Models\InterviewQuestionBank;
use App\Services\Speech\InterviewSpeech;
use Illuminate\Console\Command;

/**
 * Synthesises the interviewer's voice for the whole question bank (and the fixed lines) ahead of time, so no candidate ever waits for it.
 * Questions are cached by their exact words, so this is safe to run any number of times - it only pays for clips it has not made yet.
 * Run it after importing questions or switching voice (`php artisan interview:warm-speech`).
 */
class WarmInterviewSpeech extends Command
{
    protected $signature = 'interview:warm-speech {--limit=0 : Stop after this many questions (0 = all)} {--discipline= : Only this discipline (e.g. ece); "software" for the general bank}';

    protected $description = "Pre-generate the interviewer's voice for every active interview question";

    public function handle(InterviewSpeech $speech): int
    {
        if (! $speech->available()) {
            $this->warn('No voice is configured (set GEMINI_API_KEY, OPENAI_API_KEY or ELEVENLABS_API_KEY) - candidates will hear the browser voice.');

            return self::SUCCESS;
        }

        $this->info('Fixed lines');
        foreach (array_keys($speech->lines()) as $line) {
            $this->line(sprintf('  %-14s %s', $line, $speech->forLine($line) ? 'ok' : 'FAILED'));
        }

        $query = InterviewQuestionBank::query()->where('is_active', true)->orderBy('id');

        if ($discipline = $this->option('discipline')) {
            $discipline === 'software' ? $query->whereNull('discipline') : $query->where('discipline', $discipline);
        }

        if ($limit = (int) $this->option('limit')) {
            $query->limit($limit);
        }

        $questions = $query->get(['id', 'question_text']);
        $this->info("Questions: {$questions->count()}");

        $failed = 0;
        $bar = $this->output->createProgressBar($questions->count());
        foreach ($questions as $question) {
            $clip = $speech->forText($question->question_text);

            // Over the provider's rate limit (a free or low tier allows only a handful of clips a minute): wait it out once, then try again.
            if ($clip === null && $speech->coolingDown()) {
                $this->newLine();
                $this->warn('The voice provider is rate limiting - waiting a minute, then carrying on...');
                sleep(65);
                $clip = $speech->forText($question->question_text);
            }

            if ($clip === null) {
                $failed++;
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine(2);

        $failed === 0 ? $this->info('Done.') : $this->warn("{$failed} question(s) could not be voiced (they will be read in the browser voice). Run the command again to retry them.");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
