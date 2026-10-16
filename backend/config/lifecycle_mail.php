<?php

/*
|--------------------------------------------------------------------------
| Lifecycle e-mails — plan changes, reminders and nudges
|--------------------------------------------------------------------------
|
| Read by App\Services\LifecycleSweepService (the scheduled `lifecycle:send`
| command). The e-mails that happen in the moment — payment failed, refund,
| password changed, plan granted — have no settings here: they just go out.
|
| Everything below is about the e-mails WE start, so every number is a
| deliberate "how often is too often" decision. They are all environment- or
| config-tunable without touching code.
|
*/

return [

    /*
    | Master switch for the engagement e-mails (upgrade nudges, "you are close to
    | the Vault", win-backs, Vault-upgrade reminders). Plan-ending reminders are
    | not engagement mail and are not affected. Set to false to pause all nudging
    | without a deploy, e.g. while the mail domain is warming up.
    */
    'engagement_enabled' => (bool) env('LIFECYCLE_ENGAGEMENT_ENABLED', true),

    /*
    | The most engagement e-mails one `lifecycle:send` run will send. A plain
    | Gmail/Workspace mailbox has a hard daily sending limit (500 / 2,000); this
    | keeps the nudges from ever using up the room that receipts and password
    | codes need, and spreads a first run over a large existing student base across
    | several days instead of one burst.
    */
    'max_per_run' => (int) env('LIFECYCLE_MAX_PER_RUN', 300),

    /* When the daily run happens (it also runs the plan-ending reminders). */
    'run_at' => env('LIFECYCLE_RUN_AT', '11:00'),
    'timezone' => env('LIFECYCLE_TIMEZONE', 'Asia/Kolkata'),

    /* No student gets two engagement e-mails (of any kind) closer together than this. */
    'min_days_between_engagement' => 3,

    /*
    | Plan-ending reminders: how many days before a paid plan ends to remind. Each
    | day-count is sent once per plan; a plan with fewer days left than the first
    | gets only the closest reminder.
    */
    'plan_expiring_days' => [7, 1],

    /*
    | "Get a paid plan" nudges for free-plan students who have never paid: the Nth
    | message is sent once the account is days[N-1] old. `gap_days` is the least
    | time between two of them. Three messages, then silence — a student who has not
    | bought after three is not going to be persuaded by a fourth.
    */
    'upgrade_nudge' => [
        'days' => [3, 10, 24],
        'gap_days' => 5,
    ],

    /*
    | "You are N points from the Vault": students active in the last
    | `active_within_days` whose readiness score is between `from` and the Vault
    | entry score. At most `max` of them, `cooldown_days` apart.
    */
    'readiness_push' => [
        'from' => (int) env('LIFECYCLE_READINESS_PUSH_FROM', 45),
        'cooldown_days' => 10,
        'max' => 4,
        'active_within_days' => 30,
    ],

    /*
    | Students who reached the Vault score but whose plan does not include the
    | Vault. The first message goes out the moment they qualify; reminders follow
    | this many days after that first one (so: 2 reminders, then stop).
    */
    'vault_upgrade_reminder_days' => [14, 30],

    /*
    | Win-back for students who stopped coming: sent once the student has been away
    | days[0] days and again at days[1]. A student who then returns and drifts away
    | again is eligible again; the same absence is never mailed twice.
    */
    'inactivity' => [
        'days' => [14, 45],
        'give_up_after_days' => 90,
    ],

    /*
    | Run the default queue from the scheduler as well, so the e-mails that are
    | queued (bulk notifications, interview shortlists, drive proposals, proctoring
    | reports, and any single send that failed and was handed to the queue for a
    | retry) are delivered on a server whose only background process is the
    | `schedule:run` cron. Harmless next to a real `queue:work`: both claim jobs
    | atomically. Has no effect with QUEUE_CONNECTION=sync.
    */
    'drain_queue_from_scheduler' => (bool) env('QUEUE_DRAIN_FROM_SCHEDULER', true),

];
