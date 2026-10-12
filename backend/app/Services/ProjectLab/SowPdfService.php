<?php

namespace App\Services\ProjectLab;

use App\Models\ProjectTopic;
use App\Models\User;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Str;

/**
 * Renders a topic's SOW to a PDF stamped with the student it was issued to.
 * The SOW is paid content: every page carries the student's name and email in
 * the footer plus a faint diagonal watermark, so a PDF that circulates can be
 * traced to the account it came from. It is the same text the student can read
 * on screen — the stamp is the only difference.
 *
 * The Markdown is authored by Mellow staff, but is still rendered with raw HTML
 * stripped and unsafe links off, so a pasted <script>/<iframe> or javascript:
 * link can never reach the renderer.
 */
class SowPdfService
{
    /** Hard cap on SOW size; also bounds CommonMark's table-scan cost on a pathological document. */
    public const MAX_MARKDOWN_CHARS = 200_000;

    public function render(ProjectTopic $topic, User $student): string
    {
        $topic->loadMissing('milestones');

        $body = Str::markdown((string) $topic->sow_markdown, [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
        ]);

        $html = view('project-lab.sow-pdf', [
            'topic' => $topic,
            'body' => $body,
            'student' => $student,
            'issuedOn' => now()->format('j M Y'),
        ])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('tempDir', $this->workDirectory());
        $options->set('chroot', [base_path('resources'), public_path()]);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4');
        $dompdf->loadHtml($html);
        $dompdf->render();

        $this->stamp($dompdf, $student);

        return $dompdf->output();
    }

    public function filename(ProjectTopic $topic): string
    {
        return 'SOW-'.$topic->slug.'-v'.$topic->sow_version.'.pdf';
    }

    private function stamp(Dompdf $dompdf, User $student): void
    {
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('DejaVu Sans');
        $width = $canvas->get_width();
        $height = $canvas->get_height();
        $who = $student->name.' <'.$student->email.'>';

        // Footer on every page: who it was issued to, and the page count.
        $canvas->page_text(40, $height - 30, "Licensed to {$who}  |  AptRun Project Lab  |  Page {PAGE_NUM} of {PAGE_COUNT}", $font, 8, [0.4, 0.4, 0.4]);

        // Faint diagonal watermark, centred on every page.
        $canvas->page_text($width / 2 - 170, $height / 2 + 120, $student->email, $font, 34, [0.88, 0.88, 0.88], 0, 0, 38);
    }

    private function workDirectory(): string
    {
        $dir = storage_path('app/private/dompdf');

        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        return $dir;
    }
}
