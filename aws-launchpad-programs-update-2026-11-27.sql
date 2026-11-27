-- =============================================================================
-- AptRun AWS Production MySQL Update — Launchpad 2026 Campaigns (2026-11-27)
-- Idempotent DDL for `launchpad_programs`, `launchpad_program_slots`,
-- and `launchpad_program_enrollments`
-- =============================================================================

CREATE TABLE IF NOT EXISTS `launchpad_programs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(190) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `track` VARCHAR(24) NOT NULL DEFAULT 'tech',
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `duration_days` SMALLINT UNSIGNED NOT NULL DEFAULT 21,
  `min_readiness_percent` DECIMAL(5,2) NOT NULL DEFAULT 60.00,
  `passing_score_percent` DECIMAL(5,2) NOT NULL DEFAULT 60.00,
  `enforce_proctoring` TINYINT(1) NOT NULL DEFAULT 1,
  `target_scope` JSON NULL,
  `starts_at` DATETIME NULL,
  `ends_at` DATETIME NULL,
  `published_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `launchpad_programs_slug_unique` (`slug`),
  KEY `launchpad_programs_track_status_idx` (`track`, `status`),
  CONSTRAINT `launchpad_programs_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `launchpad_program_slots` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `launchpad_program_id` BIGINT UNSIGNED NOT NULL,
  `assessment_number` TINYINT UNSIGNED NOT NULL,
  `set_number` TINYINT UNSIGNED NOT NULL,
  `college_assessment_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `launchpad_program_slot_unique` (`launchpad_program_id`, `assessment_number`, `set_number`),
  CONSTRAINT `lp_slots_program_fk` FOREIGN KEY (`launchpad_program_id`) REFERENCES `launchpad_programs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lp_slots_assessment_fk` FOREIGN KEY (`college_assessment_id`) REFERENCES `college_assessments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `launchpad_program_enrollments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `launchpad_program_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `college_id` BIGINT UNSIGNED NULL,
  `rotation_offset` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `assessment_1_set` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `assessment_2_set` TINYINT UNSIGNED NOT NULL DEFAULT 2,
  `assessment_3_set` TINYINT UNSIGNED NOT NULL DEFAULT 3,
  `assessment_1_id` BIGINT UNSIGNED NULL,
  `assessment_2_id` BIGINT UNSIGNED NULL,
  `assessment_3_id` BIGINT UNSIGNED NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'enrolled',
  `starts_at` DATETIME NULL,
  `ends_at` DATETIME NULL,
  `last_reminded_at` DATETIME NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `launchpad_enrollment_program_user_unique` (`launchpad_program_id`, `user_id`),
  KEY `launchpad_enrollment_program_college_idx` (`launchpad_program_id`, `college_id`),
  KEY `launchpad_enrollment_user_status_idx` (`user_id`, `status`),
  CONSTRAINT `lp_enroll_program_fk` FOREIGN KEY (`launchpad_program_id`) REFERENCES `launchpad_programs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lp_enroll_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lp_enroll_college_fk` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lp_enroll_a1_fk` FOREIGN KEY (`assessment_1_id`) REFERENCES `college_assessments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lp_enroll_a2_fk` FOREIGN KEY (`assessment_2_id`) REFERENCES `college_assessments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `lp_enroll_a3_fk` FOREIGN KEY (`assessment_3_id`) REFERENCES `college_assessments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
