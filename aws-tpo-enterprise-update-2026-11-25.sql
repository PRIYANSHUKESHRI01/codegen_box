-- ============================================================================
-- AptRun AWS RDS Production Update: TPO Enterprise Features (2026-11-25)
-- Safe, additive-only & idempotent SQL for MySQL 8.x
-- Run in a maintenance window or online (all columns nullable / defaulted).
-- ============================================================================

-- 1. USERS: 10th/12th marks, placement outcome status, academic verification lock
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tenth_percentage');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `tenth_percentage` DECIMAL(5,2) NULL AFTER `cgpa`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'twelfth_percentage');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `twelfth_percentage` DECIMAL(5,2) NULL AFTER `tenth_percentage`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'placement_status');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `placement_status` VARCHAR(30) NOT NULL DEFAULT ''seeking'' AFTER `backlogs`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'academics_locked_at');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `academics_locked_at` TIMESTAMP NULL AFTER `placement_status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. COLLEGES: Placement policy rules (offer cap, dream multiplier & CTC threshold)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'colleges' AND COLUMN_NAME = 'max_offers_per_student');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `colleges` ADD COLUMN `max_offers_per_student` TINYINT UNSIGNED NULL AFTER `exam_networks`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'colleges' AND COLUMN_NAME = 'dream_offer_multiplier');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `colleges` ADD COLUMN `dream_offer_multiplier` DECIMAL(4,2) NULL AFTER `max_offers_per_student`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'colleges' AND COLUMN_NAME = 'dream_offer_min_ctc');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `colleges` ADD COLUMN `dream_offer_min_ctc` DECIMAL(8,2) NULL AFTER `dream_offer_multiplier`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'colleges' AND COLUMN_NAME = 'block_placed_from_lower_ctc');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `colleges` ADD COLUMN `block_placed_from_lower_ctc` TINYINT(1) NOT NULL DEFAULT 0 AFTER `dream_offer_min_ctc`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. PLACEMENT_DRIVES: 10th/12th cutoffs, eligible batch years, drive tier
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'placement_drives' AND COLUMN_NAME = 'min_tenth_percentage');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `placement_drives` ADD COLUMN `min_tenth_percentage` DECIMAL(5,2) NULL AFTER `max_backlogs`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'placement_drives' AND COLUMN_NAME = 'min_twelfth_percentage');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `placement_drives` ADD COLUMN `min_twelfth_percentage` DECIMAL(5,2) NULL AFTER `min_tenth_percentage`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'placement_drives' AND COLUMN_NAME = 'eligible_years');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `placement_drives` ADD COLUMN `eligible_years` JSON NULL AFTER `eligible_branches`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'placement_drives' AND COLUMN_NAME = 'drive_tier');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `placement_drives` ADD COLUMN `drive_tier` VARCHAR(20) NOT NULL DEFAULT ''standard'' AFTER `source`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. DRIVE_COLLEGE_MAPPINGS: Per-college overrides for 10th/12th/eligible years
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drive_college_mappings' AND COLUMN_NAME = 'min_tenth_override');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `drive_college_mappings` ADD COLUMN `min_tenth_override` DECIMAL(5,2) NULL AFTER `max_backlogs_override`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drive_college_mappings' AND COLUMN_NAME = 'min_twelfth_override');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `drive_college_mappings` ADD COLUMN `min_twelfth_override` DECIMAL(5,2) NULL AFTER `min_tenth_override`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drive_college_mappings' AND COLUMN_NAME = 'eligible_years_override');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `drive_college_mappings` ADD COLUMN `eligible_years_override` JSON NULL AFTER `eligible_branches_override`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. DRIVE_APPLICATIONS: Post-offer joining tracking
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drive_applications' AND COLUMN_NAME = 'joining_status');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `drive_applications` ADD COLUMN `joining_status` VARCHAR(30) NULL AFTER `notes`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drive_applications' AND COLUMN_NAME = 'joined_at');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `drive_applications` ADD COLUMN `joined_at` TIMESTAMP NULL AFTER `joining_status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. COLLEGE_COMPANY_CONTACTS: TPO Recruiter CRM
CREATE TABLE IF NOT EXISTS `college_company_contacts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `college_id` BIGINT UNSIGNED NOT NULL,
  `company_id` BIGINT UNSIGNED NOT NULL,
  `contact_name` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(150) NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(40) NULL,
  `relationship_status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `last_contacted_at` TIMESTAMP NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  INDEX `college_company_contacts_college_id_company_id_index` (`college_id`, `company_id`),
  CONSTRAINT `ccc_college_fk` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ccc_company_fk` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ccc_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Backfill placement_status & joining_status safely
UPDATE `users` u
INNER JOIN `drive_applications` da ON da.`user_id` = u.`id` AND da.`stage` = 'offer_accepted'
SET u.`placement_status` = 'placed'
WHERE u.`role` = 'user' AND (u.`placement_status` IS NULL OR u.`placement_status` = 'seeking');

UPDATE `drive_applications`
SET `joining_status` = 'pending'
WHERE `stage` = 'offer_accepted' AND `joining_status` IS NULL;
