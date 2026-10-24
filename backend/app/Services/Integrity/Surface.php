<?php

namespace App\Services\Integrity;

use App\Models\ContestProblem;
use App\Models\CoreTestProctoringSession;
use App\Models\InterviewProctoringSession;
use App\Models\InterviewSession;
use App\Models\IntegritySession;
use App\Models\ProctoringSession;
use App\Models\SoftSkillProctoringSession;
use App\Models\StudySitting;
use App\Services\Core\CoreTestProctoringService;
use App\Services\InterviewProctoringService;
use App\Services\ProctoringService;
use App\Services\SoftSkillProctoringService;
use App\Services\StudySittingService;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * The five proctored surfaces behind one interface. Each surface already has its own proctoring record and its own
 * service that counts strikes and performs the lock (auto-submit the code, grade the saved answers, end the sitting).
 * The integrity layer does NOT replace those: it decides WHAT a finding is worth and hands the resulting strikes to the
 * surface's own service, so locking behaves exactly as it always has.
 *
 * `$record` is always the surface's own proctoring record: ProctoringSession (contest), InterviewProctoringSession,
 * SoftSkillProctoringSession, CoreTestProctoringSession, or the StudySitting itself.
 */
final class Surface
{
    private function __construct(public readonly string $key) {}

    public static function for(string $key): self
    {
        if (! in_array($key, IntegritySession::SURFACES, true)) {
            throw new InvalidArgumentException("Unknown proctored surface [{$key}].");
        }

        return new self($key);
    }

    /** @return class-string<Model> */
    public function modelClass(): string
    {
        return match ($this->key) {
            'contest' => ProctoringSession::class,
            'interview' => InterviewProctoringSession::class,
            'soft_skill' => SoftSkillProctoringSession::class,
            'core_test' => CoreTestProctoringSession::class,
            'study' => StudySitting::class,
        };
    }

    public function find(int $id): ?Model
    {
        return ($this->modelClass())::find($id);
    }

    public function ownerId(Model $record): int
    {
        return match ($this->key) {
            'contest' => (int) $record->contestParticipant->user_id,
            'interview' => (int) $record->interviewSession->user_id,
            'soft_skill' => (int) $record->softSkillSession->user_id,
            'core_test' => (int) $record->testSession->user_id,
            'study' => (int) $record->user_id,
        };
    }

    public function isLocked(Model $record): bool
    {
        return $record->status === 'locked';
    }

    /** The attempt is over (submitted, ended, or the contest closed): nothing left to protect, so no strikes. */
    public function isFinished(Model $record): bool
    {
        return match ($this->key) {
            'contest' => $record->status === ProctoringSession::STATUS_COMPLETED || (bool) $record->contestParticipant->contest->hasEnded(),
            'interview' => $record->interviewSession->status === InterviewSession::STATUS_COMPLETED,
            'soft_skill' => (bool) $record->softSkillSession->isCompleted(),
            'core_test' => (bool) $record->testSession->isCompleted(),
            'study' => $record->isCompleted(),
        };
    }

    /**
     * Costs the attempt `$strikes` strikes through the surface's own service (which does the counting, the row lock, and the
     * lock side effects). Returns the refreshed record and whether THIS call locked the attempt.
     *
     * @param  array<string, mixed>  $meta
     * @param  array<string, mixed>  $context  contest only: contest_problem_id, code, language (so a locking strike can still submit the open code)
     * @return array{record: Model, locked: bool}
     */
    public function strike(Model $record, string $type, ?string $ip, array $meta, array $context, int $strikes): array
    {
        switch ($this->key) {
            case 'contest':
                $problemId = (int) ($context['contest_problem_id'] ?? 0);
                $problem = $problemId > 0
                    ? ContestProblem::where('id', $problemId)->where('contest_id', $record->contestParticipant->contest_id)->first()
                    : null;
                $result = app(ProctoringService::class)->recordViolation(
                    $record, $type, $problem, $ip, $meta,
                    isset($context['code']) ? (string) $context['code'] : null,
                    isset($context['language']) ? (string) $context['language'] : null,
                    $strikes,
                );
                break;

            case 'interview':
                $result = app(InterviewProctoringService::class)->recordViolation($record, $type, null, $ip, $meta, $strikes);
                break;

            case 'soft_skill':
                $result = app(SoftSkillProctoringService::class)->recordViolation($record, $type, $ip, $meta, $strikes);
                break;

            case 'core_test':
                $result = app(CoreTestProctoringService::class)->recordViolation($record, $type, $ip, $meta, $strikes);
                break;

            default:
                $result = app(StudySittingService::class)->recordViolation($record, $type, $ip, $meta, $strikes);
                $result['session'] = $result['sitting'];
        }

        return ['record' => $result['session'], 'locked' => (bool) $result['locked']];
    }

    /**
     * Logs a non-strike finding in the surface's own violation table too, so the existing review screens (which read
     * those tables) show everything — not just the strikes. Goes through the same service as a strike, with 0 strikes.
     *
     * @param  array<string, mixed>  $meta
     * @param  array<string, mixed>  $context
     */
    public function note(Model $record, string $type, ?string $ip, array $meta, array $context): Model
    {
        return $this->strike($record, $type, $ip, $meta, $context, 0)['record'];
    }

    /** The JSON every surface's start/violations endpoints already return (frontend ProctoringSessionState). */
    public function payload(Model $record): array
    {
        return [
            'status' => $record->status,
            'violation_count' => (int) $record->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked_at' => $record->locked_at,
        ];
    }
}
