<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Backfills `problems.companies` (e.g. ["Google", "Microsoft"]) for the
 * subset of problems whose title matches a real, per-company LeetCode
 * "company tag" record — extracted from LeetCode Premium's own
 * company-tag feature and mirrored publicly at
 * github.com/dataengineervishal/leetcode-companywise-questions
 * (companies/google/all.csv, companies/microsoft/all.csv), fetched live
 * on 2026-10-01.
 *
 * Only rows with Frequency % >= 50 were kept (the top ~8-14% most
 * strongly company-associated problems in each company's full list —
 * 158 of 2000 for Google, 180 of 1308 for Microsoft), then exact
 * (case/punctuation-normalized) title-matched against this platform's own
 * problem bank. No fuzzy matching, no inference — every tag here traces
 * back to a real row in that sourced data.
 *
 * Deliberately excludes `easy` problems, even when they matched: company
 * tags are meant to flag the "this is genuinely interview-relevant"
 * signal, and easy problems don't need that nudge — showing it on ~46 of
 * them read as noise rather than signal. company_tags.json itself already
 * excludes them, but the `where('difficulty', '!=', 'easy')` guard below
 * is a second line of defense so that invariant can't silently drift if
 * the data file is ever regenerated without it.
 *
 * Caveat worth remembering: LeetCode's own company-tag data is itself
 * built from aggregated candidate self-reporting, not a verified record of
 * actual interview transcripts — the same caveat that applies to every
 * platform that offers this feature. It is the best available real,
 * external, citable source for this claim.
 */
class CompanyTagSeeder extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/company_tags.json';

        if (! file_exists($path)) {
            throw new RuntimeException("CompanyTagSeeder: missing data file at {$path}");
        }

        $matches = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        $updated = 0;
        foreach ($matches as $match) {
            $affected = Problem::where('slug', $match['slug'])
                ->where('difficulty', '!=', Problem::DIFFICULTY_EASY)
                ->update(['companies' => json_encode($match['companies'])]);
            $updated += $affected;
        }

        $this->command?->info("CompanyTagSeeder: tagged {$updated} of ".count($matches).' matched (non-easy) problems.');
    }
}
