<?php

namespace App\Services\Reports;

use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * Turns a Blade view into a PDF with AptRun's running header and footer on every page. One place for the Dompdf
 * options so every report (student, interview, section) is rendered the same way, and the same hardening as
 * SowPdfService applies: no remote fetches, no PHP in templates, files only from resources/ and public/.
 *
 * Reports are laid out with tables and plain boxes — Dompdf is a CSS 2.1 renderer, so no flexbox or grid.
 */
class PdfRenderer
{
    /**
     * @param  array<string, mixed>  $data  passed to the view; `$logo` (a data: URI) is added for the header
     * @param  string  $footer  the left-hand footer line, e.g. "Report AR-01HX… · Confidential"
     * @return array{binary: string, pages: int}
     */
    public function render(string $view, array $data, string $footer): array
    {
        $html = view($view, $data + ['logo' => $this->logo()])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('dpi', 96);
        $options->set('tempDir', $this->workDirectory());
        $options->set('chroot', [base_path('resources'), public_path()]);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4');
        $dompdf->loadHtml($html);
        $dompdf->render();

        $this->stamp($dompdf, $footer);

        return ['binary' => (string) $dompdf->output(), 'pages' => (int) $dompdf->getCanvas()->get_page_count()];
    }

    /** The AptRun wordmark as a data: URI (the renderer is not allowed to fetch anything). Empty string if the file is missing. */
    public function logo(): string
    {
        static $cached = null;

        if ($cached === null) {
            $path = resource_path('brand/aptrun-logo.png');
            $cached = is_file($path) ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($path)) : '';
        }

        return $cached;
    }

    private function stamp(Dompdf $dompdf, string $footer): void
    {
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('DejaVu Sans');
        $width = $canvas->get_width();
        $height = $canvas->get_height();

        $canvas->line(36, $height - 38, $width - 36, $height - 38, [0.89, 0.91, 0.94], 0.6);
        $canvas->page_text(36, $height - 30, $footer, $font, 7, [0.42, 0.45, 0.5]);
        $canvas->page_text($width - 36 - 62, $height - 30, 'Page {PAGE_NUM} of {PAGE_COUNT}', $font, 7, [0.42, 0.45, 0.5]);
        $canvas->page_text(36, $height - 20, 'AptRun is a product of Mellow Vault  |  mellowvault.com  |  support@mellowvault.com', $font, 6.5, [0.62, 0.64, 0.68]);
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
