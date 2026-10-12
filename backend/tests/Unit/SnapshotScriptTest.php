<?php

namespace Tests\Unit;

use App\Services\Workspaces\SnapshotScript;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * The submission archive's rules — what a reviewer receives and, more
 * importantly, what must never leave the workspace.
 */
class SnapshotScriptTest extends TestCase
{
    private function script(array $overrides = []): string
    {
        return SnapshotScript::build($overrides + (array) config('workspaces.snapshot'));
    }

    public function test_it_is_a_find_into_tar_pipeline_that_fails_loudly(): void
    {
        $script = $this->script();

        $this->assertStringContainsString('set -o pipefail', $script);
        $this->assertStringContainsString("cd '/home/workspace' || exit 2", $script);
        $this->assertStringContainsString('-print0', $script);
        $this->assertStringContainsString('tar --null --no-recursion -czf', $script);
        $this->assertStringContainsString('-regextype posix-extended', $script);
        $this->assertStringContainsString("stat -c %s '".SnapshotScript::OUTPUT."'", $script);
    }

    public function test_only_regular_files_are_archived_so_symlinks_cannot_smuggle_things_in(): void
    {
        $this->assertStringContainsString('-type f', $this->script());
    }

    public function test_dependency_directories_and_tool_caches_are_pruned(): void
    {
        $script = $this->script();

        // Pruned at any depth by `-name`, so they appear as written…
        foreach (['node_modules', '__pycache__', '.venv', 'venv', '.next'] as $dir) {
            $this->assertStringContainsString("-name '$dir'", $script, "$dir must be excluded");
        }
        // …and the root-level / shallow ones by regex, so they appear regex-escaped.
        foreach (['vendor', 'dist', 'build', 'target', '.cache', '.npm', '.m2', '.openvscode-server'] as $dir) {
            $this->assertStringContainsString(preg_quote($dir, '/'), $script, "$dir must be excluded");
        }
        $this->assertStringContainsString('-prune', $script);
    }

    public function test_git_hook_samples_and_shell_dotfiles_are_left_out_as_noise(): void
    {
        $script = $this->script();

        $this->assertStringContainsString("-path '*/.git/hooks'", $script);
        foreach (['.bashrc', '.bash_history', '.profile'] as $name) {
            $this->assertStringContainsString("-name '$name'", $script);
        }
    }

    public function test_secret_looking_files_are_skipped_but_env_templates_are_kept(): void
    {
        $script = $this->script();

        foreach (['.env', '.env.*', '*.pem', '*.key', 'id_rsa', 'id_ed25519'] as $name) {
            $this->assertStringContainsString("-name '$name'", $script, "$name must be skipped");
        }
        foreach (['.env.example', '.env.sample', '.env.template'] as $name) {
            $this->assertStringContainsString("! \\( -name '.env.example'", $script);
            $this->assertStringContainsString("-name '$name'", $script);
        }
    }

    public function test_hostile_configuration_cannot_break_out_of_its_quoting(): void
    {
        $script = $this->script([
            'skip_files' => ["x'; touch /tmp/pwned; echo '"],
            'prune_anywhere' => ["y'; touch /tmp/pwned2; echo '"],
            'prune_shallow' => ["z'; touch /tmp/pwned3; echo '"],
        ]);

        // A closing quote inside a name is escaped as '\'' and so cannot end the quoted string.
        $this->assertStringNotContainsString("-name 'x'; touch", $script);
        $this->assertStringContainsString("'\\''", $script);
    }

    public function test_the_archive_is_written_outside_the_students_folder_so_it_cannot_contain_itself(): void
    {
        $this->assertStringStartsNotWith('/home/workspace', SnapshotScript::OUTPUT);
        $this->assertStringStartsWith('/var/tmp/', SnapshotScript::OUTPUT, '/var/tmp is on the container layer; docker cp cannot read tmpfs');
    }

    /**
     * Runs the real script against a real directory tree. Needs GNU find + tar +
     * bash on a Linux host, i.e. CI or the workspace image — skipped elsewhere.
     */
    public function test_it_archives_exactly_the_right_files_when_run_for_real(): void
    {
        if (PHP_OS_FAMILY !== 'Linux' || ! is_executable('/bin/bash') || (new Process(['find', '--version']))->run() !== 0) {
            $this->markTestSkipped('Needs bash + GNU find/tar on Linux.');
        }

        $root = sys_get_temp_dir().'/aptrun-snap-'.bin2hex(random_bytes(4));
        $files = [
            'README.md' => 'keep',
            'src/app.js' => 'keep',
            'backend/app/Http/Kernel.php' => 'keep',
            'backend/.env.example' => 'keep',
            'backend/app/build/Helper.php' => 'keep',                 // a source folder called "build", deeper in: kept
            'node_modules/x/index.js' => 'DROP',
            'frontend/node_modules/y/index.js' => 'DROP',
            'backend/vendor/autoload.php' => 'DROP',
            'frontend/dist/bundle.js' => 'DROP',
            '.env' => 'DROP',
            'backend/.env' => 'DROP',
            'backend/.env.production' => 'DROP',
            'keys/server.pem' => 'DROP',
            'id_rsa' => 'DROP',
            'laravel.log' => 'DROP',
            '.cache/pip/x' => 'DROP',
            '.npm/_cacache/x' => 'DROP',
            '.bashrc' => 'DROP',
            'project/.git/hooks/pre-commit.sample' => 'DROP',
            'project/.git/HEAD' => 'keep',                            // history is kept, only the sample hooks go
            '.aptrun/SOW.md' => 'DROP',
            'app/__pycache__/m.pyc' => 'DROP',
        ];

        foreach ($files as $path => $content) {
            @mkdir(dirname("$root/$path"), 0777, true);
            file_put_contents("$root/$path", $content);
        }
        symlink('/etc/passwd', "$root/link-to-passwd");

        $out = sys_get_temp_dir().'/aptrun-snap-'.bin2hex(random_bytes(4)).'.tgz';
        // The script is written for /home/workspace and /var/tmp; point both at the fixture.
        $script = str_replace([SnapshotScript::ROOT, SnapshotScript::OUTPUT], [$root, $out], $this->script());

        $process = new Process(['/bin/bash', '-c', $script]);
        $process->run();

        $this->assertSame(0, $process->getExitCode(), $process->getErrorOutput());
        $this->assertSame((string) filesize($out), trim($process->getOutput()), 'the script prints the archive size');

        $list = new Process(['tar', '-tzf', $out]);
        $list->mustRun();
        $archived = array_map(fn ($p) => ltrim($p, './'), array_filter(explode("\n", trim($list->getOutput()))));
        sort($archived);

        $expected = array_keys(array_filter($files, fn ($v) => $v === 'keep'));
        sort($expected);

        $this->assertSame($expected, $archived);
        $this->assertNotContains('link-to-passwd', $archived);

        (new Process(['rm', '-rf', $root, $out]))->run();
    }
}
