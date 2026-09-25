<?php

namespace App\Services;

use App\Mail\WeeklyReadinessReportMail;
use App\Models\College;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Mail;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Builds the "students below 60% readiness" Excel report and mails it to a
 * college's TPO(s) — the one piece of logic shared by the weekly cron
 * (SendWeeklyReadinessReports) and any future "generate this now" button,
 * so the two can never compute the at-risk list differently.
 */
class WeeklyReadinessReportService
{
    public const AT_RISK_THRESHOLD = 60;

    /** @return Collection<int, User> */
    public function atRiskStudents(College $college): Collection
    {
        return User::where('college_id', $college->id)
            ->where('role', User::ROLE_USER)
            ->get()
            ->filter(fn (User $student) => $student->readinessScore() < self::AT_RISK_THRESHOLD)
            ->sortBy(fn (User $student) => $student->readinessScore())
            ->values();
    }

    /**
     * @param  Collection<int, User>  $students
     * @return string absolute path to a temp .xlsx file — caller deletes it once sent.
     */
    public function generateExcel(College $college, Collection $students): string
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('At-Risk Students');

        $headers = ['Name', 'Email', 'Roll Number', 'Branch', 'CGPA', 'Backlogs', 'Readiness Score', 'Readiness Tier', 'Practice Score (7d)'];
        $sheet->fromArray($headers, null, 'A1');

        $headerRange = 'A1:'.chr(64 + count($headers)).'1';
        $sheet->getStyle($headerRange)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle($headerRange)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('4F46E5');

        $row = 2;
        foreach ($students as $student) {
            $sheet->fromArray([
                $student->name,
                $student->email,
                $student->roll_number ?? '—',
                $student->branch ?? '—',
                $student->cgpa ?? '—',
                $student->backlogs ?? '—',
                $student->readinessScore(),
                $student->readinessTier(),
                $student->practiceScore(),
            ], null, "A{$row}");
            $row++;
        }

        foreach (range('A', chr(64 + count($headers))) as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $path = tempnam(sys_get_temp_dir(), 'readiness-report-').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return $path;
    }

    /** @return int number of at-risk students reported */
    public function sendToTpos(College $college): int
    {
        $atRisk = $this->atRiskStudents($college);

        $tpos = User::where('college_id', $college->id)
            ->where('role', User::ROLE_ADMIN_TPO)
            ->get();

        if ($tpos->isEmpty()) {
            return $atRisk->count();
        }

        $excelPath = $this->generateExcel($college, $atRisk);

        try {
            foreach ($tpos as $tpo) {
                Mail::to($tpo->email)->send(new WeeklyReadinessReportMail($tpo, $college, $atRisk->count(), $excelPath));
            }
        } finally {
            @unlink($excelPath);
        }

        return $atRisk->count();
    }
}
