<?php

/*
|--------------------------------------------------------------------------
| The academic calendar
|--------------------------------------------------------------------------
|
| A college student's "year" (2nd year, 3rd year …) is NOT stored as a number: next July the same student is a year
| further on and a stored "3" would be quietly wrong. What is stored is the year they pass out (users.graduation_year),
| and the year they are in is worked out from it against this calendar — see App\Support\AcademicYear.
|
*/

return [

    // The month an academic year begins (7 = July: the Indian June/July intake). From this month on, everyone is a year further on.
    'year_starts_in_month' => (int) env('ACADEMIC_YEAR_START_MONTH', 7),

    // Years in a programme: the final year is the 4th. A 4th-year student passes out at the end of this academic year.
    'programme_years' => 4,

];
