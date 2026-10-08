<?php

namespace App\Console\Commands;

use App\Models\SpeakingAttempt;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * One-off (and safe to re-run) cleanup of Speaking Practice recordings stored
 * before scoring became audio-first. Since that change a recording is scored
 * from memory and never written to disk; this removes the ones the previous
 * implementation kept, because a student's voice is personal data and nothing
 * in the product plays it back.
 */
class PurgeSpeakingAudio extends Command
{
    protected $signature = 'speaking:purge-audio {--dry-run : Report what would be deleted without deleting anything}';

    protected $description = 'Delete Speaking Practice recordings stored by the previous implementation';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $files = 0;
        $rows = 0;

        SpeakingAttempt::whereNotNull('audio_path')->orderBy('id')->chunkById(200, function ($attempts) use ($dry, &$files, &$rows) {
            foreach ($attempts as $attempt) {
                $rows++;
                if (Storage::disk('local')->exists($attempt->audio_path)) {
                    $files++;
                    if (! $dry) {
                        Storage::disk('local')->delete($attempt->audio_path);
                    }
                }
                if (! $dry) {
                    $attempt->update(['audio_path' => null]);
                }
            }
        });

        $this->info(($dry ? '[dry run] would delete ' : 'Deleted ')."{$files} recording file(s) and clear {$rows} attempt reference(s).");

        return self::SUCCESS;
    }
}
