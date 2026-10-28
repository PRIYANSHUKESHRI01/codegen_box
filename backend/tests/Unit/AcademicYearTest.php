<?php

namespace Tests\Unit;

use App\Support\AcademicYear;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The year of study is derived, never stored: a student filed as "3rd year" in October 2026 must read as 4th year from July 2027
 * without anyone touching the record.
 */
class AcademicYearTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['academic.year_starts_in_month' => 7, 'academic.programme_years' => 4]);
    }

    public function test_the_academic_year_turns_over_in_july(): void
    {
        $this->assertSame(2025, AcademicYear::startYear(Carbon::parse('2026-06-30')));
        $this->assertSame(2026, AcademicYear::startYear(Carbon::parse('2026-07-01')));
        $this->assertSame(2026, AcademicYear::startYear(Carbon::parse('2027-01-15')));
    }

    public function test_a_year_of_study_and_its_passing_out_year_round_trip(): void
    {
        $now = Carbon::parse('2026-10-28');

        // Academic year 2026-27: the 4th year passes out in 2027, the 3rd in 2028, the 2nd in 2029, the 1st in 2030.
        $this->assertSame(2027, AcademicYear::graduationYearFor(4, $now));
        $this->assertSame(2028, AcademicYear::graduationYearFor(3, $now));
        $this->assertSame(2029, AcademicYear::graduationYearFor(2, $now));
        $this->assertSame(2030, AcademicYear::graduationYearFor(1, $now));

        foreach ([1, 2, 3, 4] as $year) {
            $this->assertSame($year, AcademicYear::studyYearOf(AcademicYear::graduationYearFor($year, $now), $now));
        }
    }

    public function test_a_student_moves_up_a_year_by_themselves_in_july(): void
    {
        $filedAs3rdYear = AcademicYear::graduationYearFor(3, Carbon::parse('2026-10-28'));

        $this->assertSame(3, AcademicYear::studyYearOf($filedAs3rdYear, Carbon::parse('2027-06-30')));
        $this->assertSame(4, AcademicYear::studyYearOf($filedAs3rdYear, Carbon::parse('2027-07-01')));
        $this->assertSame(5, AcademicYear::studyYearOf($filedAs3rdYear, Carbon::parse('2028-07-01')), 'past the programme = passed out');
        $this->assertSame('Passed out', AcademicYear::label(5));
    }

    public function test_no_passing_out_year_means_no_year(): void
    {
        $this->assertNull(AcademicYear::studyYearOf(null));
        $this->assertNull(AcademicYear::label(null));
        $this->assertNull(AcademicYear::label(0));
    }

    public function test_labels_read_naturally(): void
    {
        $this->assertSame('1st year', AcademicYear::label(1));
        $this->assertSame('2nd year', AcademicYear::label(2));
        $this->assertSame('3rd year', AcademicYear::label(3));
        $this->assertSame('4th year', AcademicYear::label(4));
        $this->assertSame('11th', AcademicYear::ordinal(11));
        $this->assertSame('22nd', AcademicYear::ordinal(22));
    }

    #[DataProvider('writtenYears')]
    public function test_a_year_is_read_the_way_people_write_it(mixed $written, ?int $expected): void
    {
        $this->assertSame($expected, AcademicYear::parse($written, Carbon::parse('2026-10-28')));
    }

    public static function writtenYears(): array
    {
        return [
            'digit' => ['3', 3],
            'int' => [3, 3],
            'float from excel' => [3.0, 3],
            'ordinal' => ['3rd', 3],
            'with the word year' => ['3rd year', 3],
            'capitals' => ['Third Year', 3],
            'year first' => ['Year 4', 4],
            'roman' => ['III', 3],
            'roman with year' => ['II Year', 2],
            'first' => ['first', 1],
            'final year' => ['Final year', 4],
            'a programme and a year' => ['B.Tech 2nd Year', 2],
            'passing-out year' => ['2028', 3],
            'passing-out year, this year' => ['2027', 4],
            'a batch range names the year they leave' => ['2024-2028', 3],
            'padding' => ['  4th  ', 4],
            'blank' => ['', null],
            'nonsense' => ['soon', null],
            'a fifth year does not exist' => ['5', null],
            'zero' => ['0', null],
            'already passed out' => ['2024', null],
            'not started yet' => ['2035', null],
        ];
    }

    public function test_only_the_programmes_years_can_be_filed(): void
    {
        $this->assertSame([1, 2, 3, 4], AcademicYear::selectableYears());
        $this->assertTrue(AcademicYear::isSelectable(3));
        $this->assertFalse(AcademicYear::isSelectable(0));
        $this->assertFalse(AcademicYear::isSelectable(5));
        $this->assertFalse(AcademicYear::isSelectable('3'));
    }
}
