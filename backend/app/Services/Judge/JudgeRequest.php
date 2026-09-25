<?php

namespace App\Services\Judge;

/**
 * Everything needed to judge one Run/Submit, as a small serialisable value.
 * The queued job carries this (a few KB) rather than Eloquent models, so a
 * queue full of 1,000 pending submissions stays tiny and the job always
 * judges against the *current* problem/test data when it actually runs.
 */
final class JudgeRequest
{
    public const KIND_RUN = 'run';

    public const KIND_SUBMIT = 'submit';

    public const QUEUE_CONTEST = 'contest';

    public const QUEUE_SUBMIT = 'submit';

    public const QUEUE_RUN = 'run';

    public function __construct(
        public readonly string $kind,
        public readonly string $queue,
        public readonly int $userId,
        public readonly int $problemId,
        public readonly string $language,
        public readonly string $code,
        public readonly ?int $contestId,
        public readonly ?int $contestProblemId,
        /** When the student clicked — contest penalties are computed from this, not from when a worker got to it. */
        public readonly string $requestedAt,
    ) {}

    public static function practice(string $kind, int $userId, int $problemId, string $language, string $code): self
    {
        return new self(
            $kind,
            $kind === self::KIND_SUBMIT ? self::QUEUE_SUBMIT : self::QUEUE_RUN,
            $userId,
            $problemId,
            $language,
            $code,
            null,
            null,
            now()->toIso8601String(),
        );
    }

    /** `$live` = the contest is still running; post-contest practice runs must not jump ahead of real participants. */
    public static function contest(string $kind, bool $live, int $userId, int $problemId, int $contestId, int $contestProblemId, string $language, string $code): self
    {
        return new self(
            $kind,
            $live ? self::QUEUE_CONTEST : self::QUEUE_RUN,
            $userId,
            $problemId,
            $language,
            $code,
            $contestId,
            $contestProblemId,
            now()->toIso8601String(),
        );
    }

    public function isContest(): bool
    {
        return $this->contestProblemId !== null;
    }

    /** Identical code for the same target = identical work; used for double-click dedupe and Run-result caching. */
    public function fingerprint(): string
    {
        return hash('sha256', implode('|', [
            $this->kind,
            $this->contestProblemId ?? 'p',
            $this->problemId,
            $this->language,
            $this->code,
        ]));
    }

    public function toArray(): array
    {
        return get_object_vars($this);
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['kind'],
            $data['queue'],
            $data['userId'],
            $data['problemId'],
            $data['language'],
            $data['code'],
            $data['contestId'] ?? null,
            $data['contestProblemId'] ?? null,
            $data['requestedAt'],
        );
    }
}
