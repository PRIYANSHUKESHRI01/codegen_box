<?php

/*
|--------------------------------------------------------------------------
| Project Lab: where the code comes from
|--------------------------------------------------------------------------
|
| A student's project is written in the AptRun editor (the browser workspace) and handed in from it: AptRun itself packs the code out
| of the live workspace — there is no upload. These settings keep that true and make it visible to a reviewer. They live here, not in
| config/workspaces.php, so the workspace host configuration is left exactly as it is deployed.
|
*/

return [

    // A submission must carry the snapshot AptRun took from the open workspace. false restores the old behaviour in which a repository
    // link alone could be submitted (kept only as a way back; it is the loophole this switch closes).
    'require_snapshot' => (bool) env('PROJECT_LAB_REQUIRE_SNAPSHOT', true),

    // "Save progress": checkpoints of the workspace kept on AptRun, newest first. Older ones are removed.
    'saves' => [
        'keep' => (int) env('PROJECT_LAB_SAVES_KEEP', 10),
        'min_interval_seconds' => (int) env('PROJECT_LAB_SAVE_INTERVAL', 15),
    ],

    // Evidence that code was brought in from outside instead of written in the editor. A file inside the snapshot whose modification time
    // is from before the workspace existed was copied in (an unzipped project, `cp -p`, `rsync -a`): a file written in the editor, by a
    // tool, or by `git clone` is stamped with the time it was written. It is evidence for the reviewer always; it BLOCKS a submission only
    // when most of the project is like that (below).
    'provenance' => [
        'enforce' => (bool) env('PROJECT_LAB_PROVENANCE_ENFORCE', true),
        // Clock difference between the workspace host and the app that is tolerated.
        'slack_minutes' => 30,
        // Block only a project of at least this many files, of which at least this share predate the workspace.
        'min_files' => 10,
        'block_ratio' => 0.8,
        // Archives inside the project are listed for the reviewer.
        'archive_extensions' => ['zip', 'rar', '7z', 'tar', 'tgz', 'gz', 'bz2', 'xz', 'jar', 'war'],
        'max_entries' => 100000,
    ],

    // Converting a stored snapshot (.tgz) to a .zip for download, and showing a reviewer what is inside it.
    'archive' => [
        'max_entries' => 20000,
        'max_bytes' => 600 * 1024 * 1024,
        'max_file_bytes' => 100 * 1024 * 1024,
        'list_limit' => 5000,
        'preview_bytes' => 256 * 1024,
    ],

];
