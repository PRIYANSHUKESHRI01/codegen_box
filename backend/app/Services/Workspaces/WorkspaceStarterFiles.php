<?php

namespace App\Services\Workspaces;

use App\Models\ProjectTopic;

/**
 * The few files dropped into a workspace so the student starts from the SOW
 * rather than a blank folder. SOW.md and MILESTONES.md live under .aptrun/ and
 * are refreshed on every start (they are reference material, not the
 * student's work); START-HERE.md is written once and then left alone.
 */
final class WorkspaceStarterFiles
{
    /** @return array<string, string> path relative to /home/workspace => content, always overwritten */
    public static function managed(ProjectTopic $topic): array
    {
        $files = [];

        if ($topic->hasSow()) {
            $files['.aptrun/SOW.md'] = "<!-- Managed by AptRun. Edits here are overwritten each time the workspace starts. -->\n\n".$topic->sow_markdown."\n";
        }

        $files['.aptrun/MILESTONES.md'] = self::milestones($topic);

        return $files;
    }

    public static function startHere(ProjectTopic $topic): string
    {
        return <<<MD
# {$topic->title}

Welcome to your workspace. This is a full VS Code with a terminal, git and the
tools for Node, PHP/Laravel, Python and Java installed. Everything in this
folder is saved for you between sessions.

## Where to look

- `.aptrun/SOW.md` — your Statement of Work. Follow it.
- `.aptrun/MILESTONES.md` — the milestones and the acceptance criteria a reviewer
  will check. Tick them off in the project page as you go.

## Running your app

Start your dev server in the terminal (for example `npm run dev`, `php artisan serve --host=0.0.0.0`,
`python manage.py runserver 0.0.0.0:8000`). Then open **Preview** at the top of
the page and enter the port. Bind to `0.0.0.0`, not `localhost`, or the preview
cannot reach it. Ports 1024 and above work except `13370` (the editor itself).

## Databases

Start one from the terminal; its data is kept in this folder:

```
lab-db start mysql      # MariaDB on 127.0.0.1:3306  (user: root, no password)
lab-db start postgres   # PostgreSQL on 127.0.0.1:5432  (user: postgres, no password)
lab-db start redis      # Redis on 127.0.0.1:6379
lab-db status
lab-db stop mysql
```

SQLite needs nothing. MongoDB is not installed — use a free MongoDB Atlas cluster.

## Good to know

- Put your work under this folder. Dependency folders (`node_modules`, `vendor`) and
  `.env` files are **not** included when you submit — keep a `.env.example`.
- Commit as you go (`git init` first). Your commit history shows how you worked.
- The workspace stops after 15 minutes without the project page open, or when you
  press Stop. Your files stay.
MD;
    }

    private static function milestones(ProjectTopic $topic): string
    {
        $lines = ["# Milestones — {$topic->title}", ''];

        foreach ($topic->milestones as $i => $milestone) {
            $n = $i + 1;
            $lines[] = "## {$n}. {$milestone->title}";
            $lines[] = '';

            if (filled($milestone->description)) {
                $lines[] = $milestone->description;
                $lines[] = '';
            }

            foreach ((array) $milestone->acceptance_criteria as $criterion) {
                $lines[] = "- [ ] {$criterion}";
            }

            $lines[] = '';
        }

        if ($topic->milestones->isEmpty()) {
            $lines[] = 'This project has no milestones listed. Follow the SOW.';
        }

        return implode("\n", $lines)."\n";
    }
}
