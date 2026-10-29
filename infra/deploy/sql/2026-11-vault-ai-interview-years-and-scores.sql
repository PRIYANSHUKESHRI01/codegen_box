-- =====================================================================================================================
-- AptRun: Vault AI Interview + year-wise cohorts + stored scores
-- Equivalent of these four Laravel migrations (generated with `php artisan migrate --pretend` on MariaDB 10.4):
--
--   2026_11_03_100000_create_vault_interview_qualifications_table     (NEW TABLE, #126)
--   2026_11_04_100000_add_ai_interview_fields_to_vault_profiles_table
--   2026_11_05_100000_add_study_year_and_first_login_to_users
--   2026_11_06_100000_add_stored_scores_to_users
--
-- Run it ONCE, against the live database, with the app in maintenance mode or at a quiet moment. It is a plain script:
-- a column or index that already exists makes MySQL stop with an error (it never half-overwrites). If a run stops part-way,
-- look at the error, undo nothing, and run only the statements below the one that failed (each step is independent).
--
-- The last step records the four migrations in the `migrations` table so that a later `php artisan migrate` does not try
-- to run them again.
--
--   mysql -u <user> -p <database> < 2026-11-vault-ai-interview-years-and-scores.sql
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. PRE-FLIGHT (read-only): the answers should be as written in the comments.
-- ---------------------------------------------------------------------------------------------------------------------
-- The last migration already on the server should be 2026_11_02_100700_limit_catalogue_to_main_branches (or later):
SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;
-- Should return 125 base tables before this script, 126 after:
SELECT COUNT(*) AS base_tables FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';
-- Should return 0 rows (none of the new columns exist yet):
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema = DATABASE()
   AND ((table_name = 'users' AND column_name IN ('graduation_year','first_login_at','vault_ai_unlocked_at','readiness_score','readiness_scored_at','vault_ai_score','vault_ai_scored_at'))
     OR (table_name = 'student_imports' AND column_name = 'study_year')
     OR (table_name = 'vault_profiles' AND column_name LIKE 'ai_interview_%'));
-- Should return 0 rows (the new table does not exist yet):
SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'vault_interview_qualifications';


-- ---------------------------------------------------------------------------------------------------------------------
-- 1. NEW TABLE: vault_interview_qualifications   (2026_11_03_100000)
--    One row per student per tech stack: which series they are on, the set scores, the average, the 45-day cooldown.
-- ---------------------------------------------------------------------------------------------------------------------
create table `vault_interview_qualifications` (
  `id` bigint unsigned not null auto_increment primary key,
  `user_id` bigint unsigned not null,
  `stack_key` varchar(50) not null,
  `role_key` varchar(50) not null,
  `current_attempt` tinyint unsigned not null default '1',
  `max_attempts` tinyint unsigned not null default '3',
  `status` varchar(30) not null default 'in_progress',
  `active_series_id` varchar(60) null,
  `series_scores` json null,
  `series_average` decimal(5, 2) null,
  `attempt_history` json null,
  `qualified_at` timestamp null,
  `cooldown_until` timestamp null,
  `created_at` timestamp null,
  `updated_at` timestamp null
) default character set utf8mb4 collate 'utf8mb4_unicode_ci';

alter table `vault_interview_qualifications` add constraint `vault_interview_qualifications_user_id_foreign` foreign key (`user_id`) references `users` (`id`) on delete cascade;
alter table `vault_interview_qualifications` add unique `uniq_user_stack_qualification`(`user_id`, `stack_key`);
alter table `vault_interview_qualifications` add index `vault_interview_qualifications_user_id_status_index`(`user_id`, `status`);
alter table `vault_interview_qualifications` add index `vault_interview_qualifications_stack_key_index`(`stack_key`);
alter table `vault_interview_qualifications` add index `vault_interview_qualifications_role_key_index`(`role_key`);
alter table `vault_interview_qualifications` add index `vault_interview_qualifications_status_index`(`status`);
alter table `vault_interview_qualifications` add index `vault_interview_qualifications_cooldown_until_index`(`cooldown_until`);


-- ---------------------------------------------------------------------------------------------------------------------
-- 2. vault_profiles: the Vault AI Interview result that qualified the student   (2026_11_04_100000)
-- ---------------------------------------------------------------------------------------------------------------------
alter table `vault_profiles` add `ai_interview_score` decimal(5, 2) null after `qualification_source`;
alter table `vault_profiles` add `ai_interview_stack` varchar(50) null after `ai_interview_score`;
alter table `vault_profiles` add `ai_interview_role` varchar(50) null after `ai_interview_stack`;
alter table `vault_profiles` add `ai_interview_scores` json null after `ai_interview_role`;
alter table `vault_profiles` add `ai_interview_attempt` tinyint unsigned null after `ai_interview_scores`;
alter table `vault_profiles` add `ai_interview_qualified_at` timestamp null after `ai_interview_attempt`;
alter table `vault_profiles` add index `vault_profiles_ai_interview_score_index`(`ai_interview_score`);
alter table `vault_profiles` add index `vault_profiles_ai_interview_stack_index`(`ai_interview_stack`);
alter table `vault_profiles` add index `vault_profiles_ai_interview_role_index`(`ai_interview_role`);
alter table `vault_profiles` add index `vault_profiles_ai_interview_qualified_at_index`(`ai_interview_qualified_at`);


-- ---------------------------------------------------------------------------------------------------------------------
-- 3. users + student_imports: year of study and the first sign-in   (2026_11_05_100000)
--    graduation_year   the year the student passes out (their 2nd/3rd/4th year is worked out from it)
--    first_login_at    first real sign-in; starts the 45 / 90 day wait for the Vault AI Interview
--    vault_ai_unlocked_at  when a college student unlocked the interview (kept for good)
-- ---------------------------------------------------------------------------------------------------------------------
alter table `users` add `graduation_year` smallint unsigned null after `section`;
alter table `users` add `first_login_at` timestamp null after `last_seen_at`;
alter table `users` add `vault_ai_unlocked_at` timestamp null after `first_login_at`;
alter table `users` add index `users_college_graduation_year_index`(`college_id`, `graduation_year`);

alter table `student_imports` add `study_year` tinyint unsigned null after `department_code`;

-- DATA: students already using the platform keep their place - their clock is taken to have started when the account was
-- created, so nobody restarts the 45 / 90 day wait on deploy. (Accounts never opened stay NULL until their first sign-in.)
update `users` set `first_login_at` = created_at where `role` = 'user' and `last_seen_at` is not null and `first_login_at` is null;


-- ---------------------------------------------------------------------------------------------------------------------
-- 4. users: the two scores kept on the student for filtering   (2026_11_06_100000)
-- ---------------------------------------------------------------------------------------------------------------------
alter table `users` add `readiness_score` tinyint unsigned null after `vault_ai_unlocked_at`;
alter table `users` add `readiness_scored_at` timestamp null after `readiness_score`;
alter table `users` add `vault_ai_score` decimal(5, 2) null after `readiness_scored_at`;
alter table `users` add `vault_ai_scored_at` timestamp null after `vault_ai_score`;
alter table `users` add index `users_readiness_score_index`(`readiness_score`);
alter table `users` add index `users_vault_ai_score_index`(`vault_ai_score`);

-- DATA: best Vault AI Interview series average per student. (Matches no rows on a first deploy: the table above is new and empty.)
UPDATE users SET vault_ai_score = (SELECT MAX(q.series_average) FROM vault_interview_qualifications q WHERE q.user_id = users.id AND q.series_average IS NOT NULL), vault_ai_scored_at = CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM vault_interview_qualifications q2 WHERE q2.user_id = users.id AND q2.series_average IS NOT NULL);

-- DATA: each student's latest readiness score, from the daily snapshots already on the server. Needs the `readiness_snapshots`
-- table (migration 2026_10_31). If that table is missing on your server, skip this one statement - the scores fill in by themselves
-- the next time readiness is refreshed.
UPDATE users SET readiness_score = (SELECT s.score FROM readiness_snapshots s WHERE s.user_id = users.id ORDER BY s.snapshot_date DESC LIMIT 1), readiness_scored_at = CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM readiness_snapshots s2 WHERE s2.user_id = users.id);


-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Tell Laravel these four migrations have run, so `php artisan migrate` on the server does not repeat them.
-- ---------------------------------------------------------------------------------------------------------------------
SET @batch = (SELECT COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`);
INSERT INTO `migrations` (`migration`, `batch`) VALUES
  ('2026_11_03_100000_create_vault_interview_qualifications_table', @batch),
  ('2026_11_04_100000_add_ai_interview_fields_to_vault_profiles_table', @batch),
  ('2026_11_05_100000_add_study_year_and_first_login_to_users', @batch),
  ('2026_11_06_100000_add_stored_scores_to_users', @batch);


-- ---------------------------------------------------------------------------------------------------------------------
-- 6. VERIFY (read-only)
-- ---------------------------------------------------------------------------------------------------------------------
SELECT COUNT(*) AS base_tables_now FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';   -- 126
SELECT COUNT(*) AS new_user_columns FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users'
  AND column_name IN ('graduation_year','first_login_at','vault_ai_unlocked_at','readiness_score','readiness_scored_at','vault_ai_score','vault_ai_scored_at');   -- 7
SELECT COUNT(*) AS new_vault_profile_columns FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vault_profiles' AND column_name LIKE 'ai_interview_%';   -- 6
SELECT COUNT(*) AS new_import_column FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'student_imports' AND column_name = 'study_year';   -- 1
SELECT migration, batch FROM migrations ORDER BY id DESC LIMIT 4;
