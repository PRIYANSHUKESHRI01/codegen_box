<?php

namespace App\Services\Core;

use App\Models\CoreSubject;
use App\Models\CoreTopic;

/**
 * Subject / topic lookups for importing and validating questions — by code OR by name (case and
 * punctuation-insensitive), so a content vendor's "Analog Circuits" and "analog_circuits" both land
 * on the same subject. Loaded once per request/job and answered from memory.
 */
final class CoreTaxonomy
{
    /** @var array<string, array<string, array{id:int, code:string, name:string, discipline:string}>>|null discipline → lookup key → subject */
    private ?array $subjects = null;

    /** @var array<int, array<string, array{id:int, code:string, name:string, subject_id:int}>>|null subject id → lookup key → topic */
    private ?array $topics = null;

    /** @var array<int, array{id:int, code:string, name:string, discipline:string}> */
    private array $subjectsById = [];

    /** @return list<string> */
    public function disciplines(): array
    {
        $this->load();

        return array_keys($this->subjects);
    }

    public function hasDiscipline(string $discipline): bool
    {
        $this->load();

        return isset($this->subjects[$discipline]);
    }

    /** @return array{id:int, code:string, name:string, discipline:string}|null */
    public function subject(string $discipline, string $codeOrName): ?array
    {
        $this->load();

        return $this->subjects[$discipline][self::key($codeOrName)] ?? null;
    }

    /** @return array{id:int, code:string, name:string, discipline:string}|null */
    public function subjectById(int $id): ?array
    {
        $this->load();

        return $this->subjectsById[$id] ?? null;
    }

    /** @return array{id:int, code:string, name:string, subject_id:int}|null */
    public function topic(int $subjectId, string $codeOrName): ?array
    {
        $this->load();

        return $this->topics[$subjectId][self::key($codeOrName)] ?? null;
    }

    public function topicBelongsTo(int $topicId, int $subjectId): bool
    {
        $this->load();

        foreach ($this->topics[$subjectId] ?? [] as $topic) {
            if ($topic['id'] === $topicId) {
                return true;
            }
        }

        return false;
    }

    public function flush(): void
    {
        $this->subjects = $this->topics = null;
        $this->subjectsById = [];
    }

    /** "Analog Circuits" / "analog_circuits" / "analog-circuits" → "analog circuits". */
    public static function key(string $value): string
    {
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', mb_strtolower($value)));
    }

    private function load(): void
    {
        if ($this->subjects !== null) {
            return;
        }

        $this->subjects = [];
        $this->topics = [];

        foreach (CoreSubject::query()->where('is_active', true)->orderBy('sort')->get() as $subject) {
            $row = ['id' => $subject->id, 'code' => $subject->code, 'name' => $subject->name, 'discipline' => $subject->discipline_code];
            $this->subjectsById[$subject->id] = $row;
            $this->subjects[$subject->discipline_code][self::key($subject->code)] = $row;
            $this->subjects[$subject->discipline_code][self::key($subject->name)] = $row;
        }

        foreach (CoreTopic::query()->where('is_active', true)->orderBy('sort')->get() as $topic) {
            $row = ['id' => $topic->id, 'code' => $topic->code, 'name' => $topic->name, 'subject_id' => $topic->subject_id];
            $this->topics[$topic->subject_id][self::key($topic->code)] = $row;
            $this->topics[$topic->subject_id][self::key($topic->name)] = $row;
        }
    }
}
