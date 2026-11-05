<?php

namespace App\Services\Interviews;

use App\Models\Interview;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * The scheduling half of a TPO's mock-interview form, shared by every endpoint that reads or writes it: the validation rules,
 * turning a validated request into the columns to save, and the card the TPO's list shows.
 */
class CollegeInterviewForm
{
    public function __construct(private readonly InterviewAudience $audience) {}

    /** @return array<string, mixed> */
    public static function rules(): array
    {
        return [
            'opens_at' => ['sometimes', 'nullable', 'date'],
            'closes_at' => ['sometimes', 'nullable', 'date'],
            'qualifying_score_percent' => ['sometimes', 'nullable', 'numeric', 'min:1', 'max:100'],
            'audience_filter' => ['sometimes', 'nullable', 'array'],
            'audience_filter.years' => ['sometimes', 'nullable', 'array', 'max:8'],
            'audience_filter.years.*' => ['integer', 'min:1', 'max:8'],
            'audience_filter.sections' => ['sometimes', 'nullable', 'array', 'max:60'],
            'audience_filter.sections.*' => ['string', 'max:40'],
            'audience_filter.student_ids' => ['sometimes', 'nullable', 'array', 'max:500'],
            'audience_filter.student_ids.*' => ['integer'],
        ];
    }

    /**
     * The schedule columns to write for the keys the request actually carried (a key left out is left alone). Hand-picked student ids
     * are cut down to students of THIS college: an id from anywhere else is dropped without a word.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     *
     * @throws ValidationException when the closing time is not after the opening time
     */
    public function attributes(array $validated, int $collegeId, ?Interview $existing = null): array
    {
        $out = [];

        foreach (['opens_at', 'closes_at'] as $key) {
            if (array_key_exists($key, $validated)) {
                $out[$key] = $validated[$key] ? Carbon::parse($validated[$key]) : null;
            }
        }

        if (array_key_exists('qualifying_score_percent', $validated)) {
            $out['qualifying_score_percent'] = $validated['qualifying_score_percent'];
        }

        if (array_key_exists('audience_filter', $validated)) {
            $out['audience_filter'] = $this->cleanFilter($validated['audience_filter'], $collegeId);
        }

        $opens = array_key_exists('opens_at', $out) ? $out['opens_at'] : $existing?->opens_at;
        $closes = array_key_exists('closes_at', $out) ? $out['closes_at'] : $existing?->closes_at;

        if ($opens && $closes && ! $closes->gt($opens)) {
            throw ValidationException::withMessages(['closes_at' => 'The closing time must be after the opening time.']);
        }

        return $out;
    }

    /** @return array{years: list<int>, sections: list<string>, student_ids: list<int>}|null null when nothing narrows it */
    public function cleanFilter(?array $filter, int $collegeId): ?array
    {
        $f = InterviewAudience::normalize($filter);

        if ($f['student_ids'] !== []) {
            $f['student_ids'] = User::query()->where('role', User::ROLE_USER)->where('college_id', $collegeId)->whereIn('id', $f['student_ids'])->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return $f['years'] === [] && $f['sections'] === [] && $f['student_ids'] === [] ? null : $f;
    }

    /** The card a TPO's list shows: the interview plus its window, audience and how it is going. */
    public function present(Interview $interview, ?object $stats = null): array
    {
        $audienceSize = null;

        try {
            $audienceSize = count($this->audience->ids($interview));
        } catch (\Throwable $e) {
            report($e);
        }

        return $interview->toArray() + [
            'schedule_state' => $interview->scheduleState(),
            'audience_label' => $this->audience->describe($interview),
            'audience_size' => $audienceSize,
            'completed_count' => (int) ($stats->completed ?? 0),
            'in_progress_count' => (int) ($stats->in_progress ?? 0),
            'average_score' => isset($stats->average) && $stats->average !== null ? round((float) $stats->average, 1) : null,
            'question_count' => $interview->interviewQuestions()->count(),
        ];
    }
}
