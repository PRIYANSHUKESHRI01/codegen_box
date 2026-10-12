<?php

namespace Tests\Feature;

use App\Models\ProjectTopic;
use App\Models\User;
use App\Services\ProjectLab\SowPdfService;
use Database\Seeders\ProjectLabContentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * The projects that ship as files (database/seeders/data/project-lab/*.json + .md).
 *
 * Every project added there — the first, and the fiftieth — is held to the same
 * bar by these tests: it must be accepted by the very validation the admin
 * editor uses, keep its numbers honest (milestone hours add up, a milestone
 * only cites requirement ids that exist), follow the standard SOW shape, and
 * render to a PDF. A mistake in a SOW should fail here, not in front of a student.
 */
class ProjectLabContentTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    /** Headings every SOW has, whatever the project (see frontend lib/sowTemplate.ts). */
    private const REQUIRED_HEADINGS = [
        'background', 'objectives', 'in scope', 'out of scope', 'users and roles',
        'functional requirements', 'non-functional requirements', 'data model',
        'deliverables', 'evaluation', 'assumptions',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    /** @return array<int, array{string, array<string, mixed>, string}> [stem, metadata, sow] */
    private function projects(): array
    {
        $directory = database_path(ProjectLabContentSeeder::DIRECTORY);
        $projects = [];

        foreach (glob($directory.'/*.json') as $file) {
            $stem = basename($file, '.json');
            $projects[] = [
                $stem,
                json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR),
                (string) file_get_contents($directory.'/'.$stem.'.md'),
            ];
        }

        return $projects;
    }

    public function test_there_is_at_least_one_bundled_project(): void
    {
        $this->assertNotEmpty($this->projects());
    }

    public function test_every_bundled_project_is_accepted_by_the_admin_editor_validation(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        foreach ($this->projects() as [$stem, $meta, $sow]) {
            $payload = collect($meta)->except(['slug'])->all() + ['sow_markdown' => $sow];

            $response = $this->postJson('/api/admin/project-lab/topics', $payload);

            $this->assertSame(201, $response->getStatusCode(), "{$stem} was rejected by the editor's validation: ".$response->getContent());
        }
    }

    public function test_every_bundled_project_keeps_its_numbers_honest(): void
    {
        foreach ($this->projects() as [$stem, $meta, $sow]) {
            $this->assertSame($stem, $meta['slug'] ?? $stem, "{$stem}: the file name and the slug must match");
            $this->assertSame(Str::slug($meta['slug']), $meta['slug'], "{$stem}: the slug must be a plain slug");

            $hours = array_sum(array_column($meta['milestones'], 'estimated_hours'));
            $this->assertSame($meta['estimated_hours'], $hours, "{$stem}: the milestone hours ({$hours}) must add up to the project's estimated_hours");

            // A criterion may cite requirements in brackets, "(AUTH-1)" or "(AUD-1, AUD-2)"; each must exist
            // in the SOW's tables. Only bracketed ids count: "UHID-000042" in a criterion is an example value.
            foreach ($meta['milestones'] as $milestone) {
                foreach ($milestone['acceptance_criteria'] as $criterion) {
                    preg_match_all('/\(([A-Z]{2,5}-\d+(?:,\s*[A-Z]{2,5}-\d+)*)\)/', $criterion, $groups);
                    $ids = array_map('trim', explode(',', implode(',', $groups[1])));

                    foreach (array_filter($ids) as $id) {
                        $this->assertStringContainsString("| `{$id}` |", $sow, "{$stem}: '{$milestone['title']}' cites {$id}, which is not a requirement in the SOW");
                    }
                }
            }
        }
    }

    public function test_every_bundled_sow_follows_the_standard_shape(): void
    {
        foreach ($this->projects() as [$stem, $meta, $sow]) {
            preg_match_all('/^#{2,3}\s+(.+)$/m', $sow, $matches);
            $headings = Str::lower(implode("\n", $matches[1]));

            foreach (self::REQUIRED_HEADINGS as $heading) {
                $this->assertStringContainsString($heading, $headings, "{$stem}: the SOW has no '{$heading}' section");
            }

            $this->assertStringNotContainsString('- [ ]', $sow, "{$stem}: task-list checkboxes print badly in the PDF; use plain bullets");

            // The reader only turns a fenced block into a dark, copyable code block when the fence names a language.
            $inside = false;
            foreach (preg_split('/\R/', $sow) as $number => $line) {
                if (! str_starts_with($line, '```')) {
                    continue;
                }

                if (! $inside) {
                    $this->assertNotSame('```', rtrim($line), "{$stem}: the code fence on line ".($number + 1).' needs a language (```bash, ```php…)');
                }

                $inside = ! $inside;
            }

            $this->assertFalse($inside, "{$stem}: a code fence is never closed");
        }
    }

    public function test_a_project_that_refuses_outside_pasting_tells_students_the_rule_and_which_blocks_may_be_pasted(): void
    {
        foreach ($this->projects() as [$stem, $meta, $sow]) {
            $mode = $meta['authorship_mode'] ?? 'strict';
            $this->assertContains($mode, ProjectTopic::AUTHORSHIP_MODES, "{$stem}: authorship_mode must be strict or open");

            if ($mode === 'open') {
                continue;
            }

            // Students are told BEFORE they start, in the document itself, that pasting from outside is refused.
            $this->assertMatchesRegularExpression('/paste/i', $sow, "{$stem}: a strict project's SOW must tell students that pasting from outside is refused");
            $this->assertStringContainsString('inside', Str::lower($sow), "{$stem}: the SOW must say that copy-and-paste inside the workspace works");

            // Only bash/sh fences are pasteable (see the editor guard): code in other fences must be typed. So a
            // command block must hold commands, never application code the student is meant to write.
            preg_match_all('/```(?:bash|sh|shell|zsh|console|terminal)
(.*?)
```/s', $sow, $blocks);
            foreach ($blocks[1] as $block) {
                $this->assertDoesNotMatchRegularExpression('/<\?php|^\s*(class|function|namespace)\s|@foreach|@section/m', $block, "{$stem}: a bash block contains application code, which students could paste: move it to a php/blade fence");
            }
        }
    }

    public function test_every_bundled_sow_renders_to_a_pdf(): void
    {
        $student = $this->student(['name' => 'Asha Verma', 'email' => 'asha@example.test']);

        foreach ($this->projects() as [$stem, $meta, $sow]) {
            $topic = $this->topic(['slug' => $stem, 'title' => $meta['title'], 'sow_markdown' => $sow]);

            $pdf = app(SowPdfService::class)->render($topic, $student);

            $this->assertStringStartsWith('%PDF-', $pdf, "{$stem}: the SOW did not render to a PDF");
        }
    }

    // ───────────────────────────── the seeder ─────────────────────────────

    public function test_the_seeder_adds_each_project_published_with_its_milestones_in_order(): void
    {
        User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        $this->seed(ProjectLabContentSeeder::class);

        foreach ($this->projects() as [$stem, $meta, $sow]) {
            $topic = ProjectTopic::where('slug', $stem)->firstOrFail();

            $this->assertSame(ProjectTopic::STATUS_PUBLISHED, $topic->status);
            $this->assertNotNull($topic->published_at);
            $this->assertSame($sow, $topic->sow_markdown);
            $this->assertSame(1, $topic->sow_version);
            $this->assertSame(
                array_column($meta['milestones'], 'title'),
                $topic->milestones->pluck('title')->all(),
            );
        }
    }

    public function test_re_running_the_seeder_never_overwrites_an_edited_project(): void
    {
        $this->seed(ProjectLabContentSeeder::class);
        $slug = $this->projects()[0][0];

        ProjectTopic::where('slug', $slug)->update(['title' => 'Edited in the admin editor', 'sow_version' => 4]);
        $milestones = ProjectTopic::where('slug', $slug)->firstOrFail()->milestones()->count();

        $this->seed(ProjectLabContentSeeder::class);

        $topic = ProjectTopic::where('slug', $slug)->firstOrFail();
        $this->assertSame('Edited in the admin editor', $topic->title);
        $this->assertSame(4, $topic->sow_version);
        $this->assertSame($milestones, $topic->milestones()->count());
        $this->assertSame(count($this->projects()), ProjectTopic::count());
    }
}
