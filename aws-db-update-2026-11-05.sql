-- =====================================================================================================================
-- AptRun: AWS DATABASE UPDATE  (everything after aws-db-update-2026-11-04.sql: Live Activity tracking + the weekly voucher ledger)
--
-- Brings an EXISTING AptRun database up to date WITHOUT replacing it. It is the SQL equivalent of
--       php artisan migrate --force
--   (2026_11_17_100000 create_activity_tracking_tables, 2026_11_17_100100 create_weekly_reward_winners_table)
-- and it records the 2 migrations in the `migrations` table, so a later `php artisan migrate` will not run them again.
--
-- WHAT IT DOES
--   PART 1  schema : 5 NEW tables and nothing else
--                      activity_visits        one row per visit of a signed-in person (when, how long, what they are on right now)
--                      activity_page_views    one row per screen opened in a visit (which screen, for how long, how far scrolled)
--                      user_activity_days     one row per person per day (what daily / weekly / monthly active counts are read from)
--                      auth_events            the sign-in log: every login, failed login, one-time-password use and password step
--                      weekly_reward_winners  the ledger of weekly leaderboard voucher winners and whether each was sent
--   PART 2  records the migrations
--   PART 3  read-only verification
--
-- SAFE TO RE-RUN: every table uses IF NOT EXISTS and the migrations are recorded only when missing.
-- NOT touched: users, colleges, plans, subscriptions, contests, results, or any other existing data. No seed data is needed:
-- the tables start empty and fill as people use the product (Live Activity starts counting from the moment the new
-- frontend is deployed; weekly voucher choices live in the existing platform_modules table).
--
-- TAKE A BACKUP FIRST (RDS snapshot or mysqldump), then:
--       mysql -h <host> -u <user> -p --default-character-set=utf8mb4 <database> < aws-db-update-2026-11-05.sql
--
-- AFTER the SQL, on the server (code/cache steps, not SQL):
--       php artisan route:cache && php artisan config:cache     (new routes, config/activity.php, new limiters)
--       the scheduler cron (* * * * * php artisan schedule:run) now also runs, by itself:
--            rewards:finalize-weekly  daily 00:15 IST   closes out last week's leaderboard (winners ledger + bell notification)
--            activity:prune           daily 03:55       drops activity data past its retention (page views 90 d, visits 180 d)
--            scheduler:heartbeat      every minute      what "The scheduler is not running" on the Overview is measured against
--       deploy the new frontend build (the tracker that reports screens/time/scroll is part of it)
--       optional .env: ACTIVITY_TRACKING=true (default) | ACTIVITY_REPORT_EVERY=60 | ACTIVITY_ONLINE_WINDOW=150 | ACTIVITY_DORMANT_DAYS=7
-- =====================================================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================================================
-- PART 1 - SCHEMA
-- =====================================================================================================================

-- activity_visits
CREATE TABLE IF NOT EXISTS `activity_visits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `college_id` bigint(20) unsigned DEFAULT NULL,
  `role` varchar(30) NOT NULL,
  `token` varchar(40) NOT NULL,
  `started_at` datetime NOT NULL,
  `last_seen_at` datetime NOT NULL,
  `active_seconds` int(10) unsigned NOT NULL DEFAULT 0,
  `pages` smallint(5) unsigned NOT NULL DEFAULT 0,
  `current_path` varchar(190) DEFAULT NULL,
  `current_section` varchar(80) DEFAULT NULL,
  `entry_path` varchar(190) DEFAULT NULL,
  `device` varchar(12) DEFAULT NULL,
  `browser` varchar(30) DEFAULT NULL,
  `os` varchar(30) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_visits_user_id_token_unique` (`user_id`,`token`),
  KEY `activity_visits_last_seen_at_index` (`last_seen_at`),
  KEY `activity_visits_college_id_last_seen_at_index` (`college_id`,`last_seen_at`),
  KEY `activity_visits_user_id_started_at_index` (`user_id`,`started_at`),
  KEY `activity_visits_started_at_index` (`started_at`),
  CONSTRAINT `activity_visits_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- activity_page_views
CREATE TABLE IF NOT EXISTS `activity_page_views` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `visit_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `college_id` bigint(20) unsigned DEFAULT NULL,
  `seq` smallint(5) unsigned NOT NULL,
  `path` varchar(190) NOT NULL,
  `section` varchar(80) NOT NULL,
  `entered_at` datetime NOT NULL,
  `active_seconds` int(10) unsigned NOT NULL DEFAULT 0,
  `max_scroll` tinyint(3) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_page_views_visit_id_seq_unique` (`visit_id`,`seq`),
  KEY `activity_page_views_user_id_entered_at_index` (`user_id`,`entered_at`),
  KEY `activity_page_views_college_id_entered_at_index` (`college_id`,`entered_at`),
  KEY `activity_page_views_section_entered_at_index` (`section`,`entered_at`),
  KEY `activity_page_views_entered_at_index` (`entered_at`),
  CONSTRAINT `activity_page_views_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_page_views_visit_id_foreign` FOREIGN KEY (`visit_id`) REFERENCES `activity_visits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_activity_days
CREATE TABLE IF NOT EXISTS `user_activity_days` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `college_id` bigint(20) unsigned DEFAULT NULL,
  `role` varchar(30) NOT NULL,
  `day` date NOT NULL,
  `visits` smallint(5) unsigned NOT NULL DEFAULT 0,
  `page_views` int(10) unsigned NOT NULL DEFAULT 0,
  `active_seconds` int(10) unsigned NOT NULL DEFAULT 0,
  `first_seen_at` datetime NOT NULL,
  `last_seen_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_activity_days_user_id_day_unique` (`user_id`,`day`),
  KEY `user_activity_days_day_role_index` (`day`,`role`),
  KEY `user_activity_days_college_id_day_index` (`college_id`,`day`),
  CONSTRAINT `user_activity_days_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- auth_events
CREATE TABLE IF NOT EXISTS `auth_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `college_id` bigint(20) unsigned DEFAULT NULL,
  `role` varchar(30) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `event` varchar(24) NOT NULL,
  `reason` varchar(40) DEFAULT NULL,
  `portal` varchar(20) DEFAULT NULL,
  `device` varchar(12) DEFAULT NULL,
  `browser` varchar(30) DEFAULT NULL,
  `os` varchar(30) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `auth_events_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `auth_events_college_id_created_at_index` (`college_id`,`created_at`),
  KEY `auth_events_event_created_at_index` (`event`,`created_at`),
  KEY `auth_events_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- weekly_reward_winners
CREATE TABLE IF NOT EXISTS `weekly_reward_winners` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `week_key` date NOT NULL,
  `rank` smallint(5) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `user_name` varchar(190) NOT NULL,
  `user_handle` varchar(64) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `college` varchar(190) DEFAULT NULL,
  `contest_score` int(10) unsigned NOT NULL DEFAULT 0,
  `card` varchar(40) NOT NULL,
  `brand` varchar(80) NOT NULL,
  `amount` int(10) unsigned NOT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'pending',
  `voucher_code` text DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `handled_by` bigint(20) unsigned DEFAULT NULL,
  `notified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `weekly_reward_winners_week_key_user_id_unique` (`week_key`,`user_id`),
  KEY `weekly_reward_winners_user_id_foreign` (`user_id`),
  KEY `weekly_reward_winners_week_key_rank_index` (`week_key`,`rank`),
  KEY `weekly_reward_winners_status_index` (`status`),
  CONSTRAINT `weekly_reward_winners_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================================================
-- PART 2 - RECORD THE MIGRATIONS (so `php artisan migrate` on the server will not run them a second time and fail with "already exists")
-- =====================================================================================================================
INSERT INTO migrations (migration, batch)
SELECT m.name, (SELECT COALESCE(MAX(b.batch), 0) + 1 FROM (SELECT batch FROM migrations) b)
  FROM (
    SELECT '2026_11_17_100000_create_activity_tracking_tables' AS name UNION ALL
    SELECT '2026_11_17_100100_create_weekly_reward_winners_table'
  ) m
 WHERE NOT EXISTS (SELECT 1 FROM migrations x WHERE x.migration = m.name);

-- =====================================================================================================================
-- PART 3 - VERIFY (read-only). Expected on a first run:
--   new tables present .................. 5
--   migrations recorded ................. 2
-- =====================================================================================================================
SELECT 'new tables present' AS check_name, COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('activity_visits','activity_page_views','user_activity_days','auth_events','weekly_reward_winners')
UNION ALL SELECT 'migrations recorded', COUNT(*) FROM migrations WHERE migration IN ('2026_11_17_100000_create_activity_tracking_tables','2026_11_17_100100_create_weekly_reward_winners_table');
