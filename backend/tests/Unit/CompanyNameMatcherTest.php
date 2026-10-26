<?php

namespace Tests\Unit;

use App\Support\CompanyNameMatcher as M;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class CompanyNameMatcherTest extends TestCase
{
    public function test_the_key_ignores_case_spacing_punctuation_and_company_suffixes(): void
    {
        $this->assertSame('capgemini', M::key('Capgemini'));
        $this->assertSame('capgemini', M::key('  CAPGEMINI India Pvt. Ltd.  '));
        $this->assertSame('techmahindra', M::key('Tech-Mahindra Limited'));
        $this->assertSame('infosys', M::key('Infosys Ltd'));
        $this->assertSame('', M::key('Pvt Ltd'));
    }

    public function test_swapping_two_neighbouring_letters_is_one_typo(): void
    {
        $this->assertSame(1, M::distance('cognizant', 'congizant'));
        $this->assertSame(0, M::distance('wipro', 'wipro'));
        $this->assertSame(1, M::distance('infosys', 'infosis'));
        $this->assertSame(2, M::distance('capegemni', 'capgemini'));
        $this->assertSame(3, M::distance('abc', ''));
    }

    public static function typos(): array
    {
        return [
            'dropped and shuffled letters (the one in the bug report)' => ['capegemni', 'capgemini'],
            'one wrong letter' => ['infosis', 'infosys'],
            'k for c' => ['kapgemini', 'capgemini'],
            'swapped letters' => ['congizant', 'cognizant'],
            'a missing letter' => ['acenture', 'accenture'],
            'a doubled letter' => ['wiipro', 'wipro'],
            'two typos in a long name' => ['techmahendra', 'techmahindra'],
        ];
    }

    #[DataProvider('typos')]
    public function test_a_typo_is_close_enough(string $typed, string $known): void
    {
        $this->assertTrue(M::closeEnough($typed, $known), "$typed should be taken for $known");
    }

    public static function strangers(): array
    {
        return [
            'a different company' => ['infoseek', 'infosys'],
            'half the letters' => ['accentia', 'accenture'],
            'short names must be exact (TCS)' => ['tcl', 'tcs'],
            'short names must be exact (HCL)' => ['hcm', 'hcl'],
            'too far at five letters' => ['wiper', 'wipro'],
            'nothing' => ['', 'wipro'],
            'wildly different length' => ['capgeminiconsultinggroup', 'capgemini'],
        ];
    }

    #[DataProvider('strangers')]
    public function test_a_different_name_is_not(string $typed, string $known): void
    {
        $this->assertFalse(M::closeEnough($typed, $known), "$typed must not be taken for $known");
    }
}
