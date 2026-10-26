<?php

namespace App\Support;

use App\Models\Company;
use Illuminate\Support\Collection;

/**
 * Typo-tolerant matching of a typed company name against the shared company catalogue.
 *
 * A TPO scheduling a drive types the company by hand — "capegemni", "Infosis Limited", "Cognizent". Plain substring search
 * finds nothing for those, so they used to end up as a brand-new duplicate company with no logo and none of the existing
 * prep content. This finds the catalogue company they meant.
 *
 * Two strengths, on purpose:
 *  - search(): liberal, for suggestions the person then picks from (substring, plus "looks like a word in the name").
 *  - findMatch(): strict, for silently reusing a record when a drive is saved — the WHOLE normalised name must be equal or
 *    within a small edit distance of exactly one catalogue company. "Wipro Consumer Care" is therefore never folded into
 *    "Wipro".
 */
class CompanyNameMatcher
{
    /** Words that say "this is a company", not which one. */
    private const NOISE = ['ltd', 'limited', 'pvt', 'private', 'inc', 'incorporated', 'corp', 'corporation', 'llc', 'llp', 'plc', 'co', 'company', 'india', 'global', 'the', 'and'];

    /** Lower-case alphanumeric words of a name, without the noise words ("Capgemini India Pvt. Ltd" => ["capgemini"]). */
    public static function tokens(string $name): array
    {
        $ascii = mb_strtolower(preg_replace('/[^\p{L}\p{N}]+/u', ' ', $name) ?? '');
        $words = array_values(array_filter(explode(' ', trim($ascii)), fn ($w) => $w !== '' && ! in_array($w, self::NOISE, true)));

        return $words;
    }

    /** The name with spacing, punctuation and noise words removed: what two spellings of the same company have in common. */
    public static function key(string $name): string
    {
        return implode('', self::tokens($name));
    }

    /** How many typos a word of this length may contain. Short names (TCS, HCL) must match exactly. */
    public static function allowedDistance(int $length): int
    {
        return $length <= 4 ? 0 : ($length <= 7 ? 1 : 2);
    }

    /**
     * Edit distance where swapping two neighbouring letters counts once ("cognizant" / "congizant" = 1) — the commonest typing
     * slip, and one PHP's own levenshtein() charges double for.
     */
    public static function distance(string $a, string $b): int
    {
        $la = strlen($a);
        $lb = strlen($b);
        if ($la === 0) {
            return $lb;
        }
        if ($lb === 0) {
            return $la;
        }

        $d = [];
        for ($i = 0; $i <= $la; $i++) {
            $d[$i][0] = $i;
        }
        for ($j = 0; $j <= $lb; $j++) {
            $d[0][$j] = $j;
        }

        for ($i = 1; $i <= $la; $i++) {
            for ($j = 1; $j <= $lb; $j++) {
                $cost = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
                $d[$i][$j] = min($d[$i - 1][$j] + 1, $d[$i][$j - 1] + 1, $d[$i - 1][$j - 1] + $cost);
                if ($i > 1 && $j > 1 && $a[$i - 1] === $b[$j - 2] && $a[$i - 2] === $b[$j - 1]) {
                    $d[$i][$j] = min($d[$i][$j], $d[$i - 2][$j - 2] + 1);
                }
            }
        }

        return $d[$la][$lb];
    }

    /** True when `$typed` is `$known` give or take the typos a word that long may have. */
    public static function closeEnough(string $typed, string $known): bool
    {
        if ($typed === '' || $known === '') {
            return false;
        }
        $allowed = self::allowedDistance(strlen($known));
        if (abs(strlen($typed) - strlen($known)) > $allowed) {
            return false;
        }

        return self::distance($typed, $known) <= $allowed;
    }

    /**
     * Catalogue companies for a suggestion list: ones whose name contains the text, then ones that merely look like it.
     *
     * @return array<int, array{company: Company, match: string}>
     */
    public function search(string $query, int $limit = 10): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $found = [];
        foreach (Company::where('name', 'like', "%{$query}%")->orderBy('name')->limit($limit)->get(['id', 'name', 'slug', 'logo', 'industry', 'overview']) as $company) {
            $found[$company->id] = ['company' => $company, 'match' => 'exact'];
        }

        if (count($found) >= $limit) {
            return array_values($found);
        }

        $typedKey = self::key($query);
        $typedTokens = array_values(array_filter(self::tokens($query), fn ($t) => strlen($t) >= 5));
        if ($typedKey === '') {
            return array_values($found);
        }

        foreach ($this->catalogue() as $company) {
            if (isset($found[$company->id]) || count($found) >= $limit) {
                continue;
            }

            $nameTokens = self::tokens($company->name);
            $known = array_merge([self::key($company->name)], $nameTokens, array_map(fn ($s) => str_replace('-', '', $s), explode('-', (string) $company->slug)));
            $known = array_values(array_unique(array_filter($known, fn ($k) => strlen($k) >= 5)));

            $similar = false;
            foreach ($known as $k) {
                if (self::closeEnough($typedKey, $k)) {
                    $similar = true;
                    break;
                }
                foreach ($typedTokens as $t) {
                    if (self::closeEnough($t, $k)) {
                        $similar = true;
                        break 2;
                    }
                }
            }

            if ($similar) {
                $found[$company->id] = ['company' => $company, 'match' => 'similar'];
            }
        }

        return array_values($found);
    }

    /**
     * The one catalogue company a typed name unmistakably refers to — same name once spacing/punctuation/"Ltd" are ignored, or
     * within a typo of exactly one company — else null (and the caller creates a new company).
     */
    public function findMatch(string $typed): ?Company
    {
        $typedKey = self::key($typed);
        if ($typedKey === '') {
            return null;
        }

        $exact = [];
        $close = [];
        foreach ($this->catalogue() as $company) {
            $key = self::key($company->name);
            if ($key === '') {
                continue;
            }
            if ($key === $typedKey) {
                $exact[] = $company;
            } elseif (self::closeEnough($typedKey, $key)) {
                $close[] = $company;
            }
        }

        if ($exact !== []) {
            // Several records with the same name is already a mess; the oldest is the original.
            usort($exact, fn ($a, $b) => $a->id <=> $b->id);

            return $exact[0];
        }

        // A typo that could mean two different companies is not a typo we should guess at.
        return count($close) === 1 ? $close[0] : null;
    }

    /** @return Collection<int, Company> */
    private function catalogue(): Collection
    {
        return Company::query()->get(['id', 'name', 'slug', 'logo', 'industry', 'overview']);
    }
}
