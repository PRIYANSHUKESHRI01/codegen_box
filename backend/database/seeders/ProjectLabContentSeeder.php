<?php

namespace Database\Seeders;

use App\Models\ProjectTopic;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Loads the Project Lab projects written as files in
 * database/seeders/data/project-lab/ — one `<slug>.json` (title, summary,
 * stack, outcomes, milestones and their acceptance criteria) next to one
 * `<slug>.md` (the SOW itself).
 *
 * Files rather than a giant PHP array so a SOW is written and reviewed as the
 * document it is, and adding project number 51 is "drop in two files and run
 * the seeder". The same projects can also be written in the admin editor; the
 * two ways meet in the same tables.
 *
 * Safe to re-run: a project whose slug already exists is left exactly as it is,
 * so editing a SOW in the admin editor is never overwritten by a deploy.
 *
 *   php artisan db:seed --class=ProjectLabContentSeeder
 */
class ProjectLabContentSeeder extends Seeder
{
    public const DIRECTORY = 'seeders/data/project-lab';

    public function run(): void
    {
        $directory = database_path(self::DIRECTORY);
        $author = User::where('role', User::ROLE_SUPERADMIN)->orderBy('id')->value('id');

        foreach (glob($directory.'/*.json') ?: [] as $file) {
            $stem = basename($file, '.json');
            $meta = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            $slug = $meta['slug'] ?? $stem;

            if (ProjectTopic::where('slug', $slug)->exists()) {
                $this->command?->info("Project Lab: '{$slug}' already exists, left untouched.");

                continue;
            }

            $sow = (string) file_get_contents($directory.'/'.$stem.'.md');

            DB::transaction(function () use ($meta, $slug, $sow, $author) {
                $topic = ProjectTopic::create([
                    'slug' => $slug,
                    'title' => $meta['title'],
                    'category' => $meta['category'],
                    'summary' => $meta['summary'],
                    'difficulty' => $meta['difficulty'],
                    'estimated_hours' => $meta['estimated_hours'],
                    'tech_stack' => $meta['tech_stack'] ?? [],
                    'outcomes' => $meta['outcomes'] ?? [],
                    'sow_markdown' => $sow,
                    'status' => $meta['status'] ?? ProjectTopic::STATUS_DRAFT,
                    'is_free_sample' => (bool) ($meta['is_free_sample'] ?? false),
                    'authorship_mode' => $meta['authorship_mode'] ?? ProjectTopic::AUTHORSHIP_STRICT,
                    'icon' => $meta['icon'] ?? null,
                    'display_order' => $meta['display_order'] ?? 0,
                    'created_by' => $author,
                    'published_at' => ($meta['status'] ?? null) === ProjectTopic::STATUS_PUBLISHED ? now() : null,
                ]);

                foreach (array_values($meta['milestones'] ?? []) as $position => $milestone) {
                    $topic->milestones()->create([
                        'position' => $position,
                        'title' => $milestone['title'],
                        'description' => $milestone['description'] ?? null,
                        'acceptance_criteria' => array_values($milestone['acceptance_criteria'] ?? []),
                        'estimated_hours' => $milestone['estimated_hours'] ?? 4,
                    ]);
                }
            });

            $this->command?->info("Project Lab: added '{$slug}'.");
        }
    }
}
