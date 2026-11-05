-- =====================================================================================================================
-- AptRun: AWS DATABASE UPDATE  (everything after aws-db-update-2026-11-05.sql: Vault AI Interview results + Project Lab saves)
--
-- Brings an EXISTING AptRun database up to date WITHOUT replacing it. It is the SQL equivalent of
--       php artisan migrate --force
--   (2026_11_18_100000 create_vault_ai_results_table, 2026_11_18_100100 create_project_saves_table)
-- and it records the 2 migrations in the `migrations` table, so a later `php artisan migrate` will not run them again.
--
-- WHAT IT DOES
--   PART 1  schema : 2 NEW tables and nothing else
--                      vault_ai_results   one row per student and Vault AI stack: the FINAL AVERAGE of the three sets of the best
--                                         series, every attempt that led there, and the stored PDF report
--                      project_saves      "Save progress" checkpoints of a Project Lab editor (the zip AptRun packs from the workspace)
--   PART 2  records the migrations
--   PART 3  read-only verification
--
-- SAFE TO RE-RUN: every table uses IF NOT EXISTS and the migrations are recorded only when missing.
-- NOT touched: users, colleges, plans, subscriptions, interviews, contests, results, workspaces, or any other existing data.
-- No seed data is needed. Students who completed a Vault AI series BEFORE this update get their result row (and can generate their
-- PDF) the first time they, their TPO or the superadmin opens the results screen. To fill them all at once, on the server:
--       php artisan vault-ai:rebuild-results --reports
--
-- TAKE A BACKUP FIRST (RDS snapshot or mysqldump), then:
--       mysql -h <host> -u <user> -p --default-character-set=utf8mb4 <database> < aws-db-update-2026-11-06.sql
--
-- AFTER the SQL, on the server (code/cache steps, not SQL):
--       php artisan route:cache && php artisan config:cache     (new routes and config/project_lab.php)
--       deploy the new frontend build
--       NOTHING under infra/workspaces or app/Services/Workspaces changed: the running workspace hosts do not need a restart.
--       optional .env: PROJECT_LAB_REQUIRE_SNAPSHOT=true (default; false brings back repository-link-only hand-ins)
--                      PROJECT_LAB_PROVENANCE_ENFORCE=true (default; false makes the "copied in from outside" check evidence-only)
--                      PROJECT_LAB_SAVES_KEEP=10
-- =====================================================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================================================
-- PART 1 - SCHEMA
-- =====================================================================================================================

-- vault_ai_results
CREATE TABLE IF NOT EXISTS `vault_ai_results` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `college_id` bigint(20) unsigned DEFAULT NULL,
  `stack_key` varchar(60) NOT NULL,
  `role_key` varchar(60) DEFAULT NULL,
  `stack_name` varchar(120) DEFAULT NULL,
  `best_average` decimal(5,2) DEFAULT NULL,
  `best_scores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`best_scores`)),
  `best_series` tinyint(3) unsigned DEFAULT NULL,
  `best_at` datetime DEFAULT NULL,
  `last_average` decimal(5,2) DEFAULT NULL,
  `last_scores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`last_scores`)),
  `last_at` datetime DEFAULT NULL,
  `attempts` smallint(5) unsigned NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'in_progress',
  `ever_qualified` tinyint(1) NOT NULL DEFAULT 0,
  `first_completed_at` datetime DEFAULT NULL,
  `history` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`history`)),
  `report_id` varchar(26) DEFAULT NULL,
  `report_generated_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vault_ai_results_user_id_stack_key_unique` (`user_id`,`stack_key`),
  KEY `vault_ai_results_college_id_best_average_index` (`college_id`,`best_average`),
  KEY `vault_ai_results_stack_key_index` (`stack_key`),
  CONSTRAINT `vault_ai_results_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- project_saves
CREATE TABLE IF NOT EXISTS `project_saves` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `project_enrollment_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `snapshot_path` varchar(255) NOT NULL,
  `snapshot_size_bytes` bigint(20) unsigned NOT NULL DEFAULT 0,
  `snapshot_sha256` varchar(64) DEFAULT NULL,
  `files_count` int(10) unsigned NOT NULL DEFAULT 0,
  `milestones_done` smallint(5) unsigned NOT NULL DEFAULT 0,
  `milestones_total` smallint(5) unsigned NOT NULL DEFAULT 0,
  `provenance` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`provenance`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_saves_user_id_foreign` (`user_id`),
  KEY `project_saves_project_enrollment_id_id_index` (`project_enrollment_id`,`id`),
  CONSTRAINT `project_saves_project_enrollment_id_foreign` FOREIGN KEY (`project_enrollment_id`) REFERENCES `project_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_saves_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================================================
-- PART 2 - RECORD THE MIGRATIONS (so `php artisan migrate` on the server will not run them a second time and fail with "already exists")
-- =====================================================================================================================
INSERT INTO migrations (migration, batch)
SELECT m.name, (SELECT COALESCE(MAX(b.batch), 0) + 1 FROM (SELECT batch FROM migrations) b)
  FROM (
    SELECT '2026_11_18_100000_create_vault_ai_results_table' AS name UNION ALL
    SELECT '2026_11_18_100100_create_project_saves_table'
  ) m
 WHERE NOT EXISTS (SELECT 1 FROM migrations x WHERE x.migration = m.name);

-- =====================================================================================================================
-- PART 3 - VERIFY (read-only). Expected on a first run:
--   new tables present .................. 2
--   migrations recorded ................. 2
-- =====================================================================================================================
SELECT 'new tables present' AS check_name, COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('vault_ai_results','project_saves')
UNION ALL SELECT 'migrations recorded', COUNT(*) FROM migrations WHERE migration IN ('2026_11_18_100000_create_vault_ai_results_table','2026_11_18_100100_create_project_saves_table');
