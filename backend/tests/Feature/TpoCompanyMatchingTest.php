<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A TPO scheduling a drive types the company by hand. A typo must find the catalogue company they meant — so the drive lands on
 * the real record (its prep content, its logo) — instead of quietly creating "Capegemni" next to "Capgemini".
 */
class TpoCompanyMatchingTest extends TestCase
{
    use RefreshDatabase;

    private User $tpo;

    protected function setUp(): void
    {
        parent::setUp();

        $college = College::create(['name' => 'College APX', 'short_code' => 'APX', 'tier' => 'Standard']);
        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);

        foreach ([['Capgemini', 'capgemini'], ['Infosys', 'infosys'], ['TCS (Tata Consultancy Services)', 'tcs-digital'], ['Wipro', 'wipro'], ['Wipro Consumer Care', 'wipro-consumer-care']] as [$name, $slug]) {
            Company::create(['name' => $name, 'slug' => $slug, 'is_active' => true]);
        }

        Sanctum::actingAs($this->tpo);
    }

    private function search(string $q): array
    {
        return $this->getJson('/api/tpo/companies/search?q='.urlencode($q))->assertOk()->json('companies');
    }

    private function schedule(string $companyName): array
    {
        return $this->postJson('/api/tpo/drives', [
            'company_name' => $companyName,
            'title' => 'Campus Hiring 2026',
            'role_title' => 'Graduate Engineer',
            'drive_date' => now()->addDays(10)->toDateString(),
        ])->assertCreated()->json('drive');
    }

    public function test_searching_still_finds_names_that_contain_the_text_first(): void
    {
        $hits = $this->search('wipro');

        $this->assertSame(['Wipro', 'Wipro Consumer Care'], array_column($hits, 'name'));
        $this->assertSame(['exact', 'exact'], array_column($hits, 'match'));
    }

    public function test_a_typo_finds_the_catalogue_company_and_says_it_is_only_similar(): void
    {
        $hits = $this->search('capegemni');

        $this->assertSame(['Capgemini'], array_column($hits, 'name'));
        $this->assertSame('similar', $hits[0]['match']);
        $this->assertSame('capgemini', $hits[0]['slug']);

        $this->assertSame('Infosys', $this->search('Infosis')[0]['name']);
        $this->assertSame('TCS (Tata Consultancy Services)', $this->search('consultancy')[0]['name']);
    }

    public function test_an_unrelated_name_finds_nothing(): void
    {
        $this->assertSame([], $this->search('zzzzzz'));
        $this->assertSame([], $this->search('Zoho'));
    }

    public function test_scheduling_a_drive_for_a_typo_reuses_the_real_company_instead_of_creating_a_duplicate(): void
    {
        $before = Company::count();

        $drive = $this->schedule('capegemni');

        $this->assertSame(Company::where('slug', 'capgemini')->value('id'), $drive['company_id']);
        $this->assertSame('Capgemini', $drive['company']['name']);
        $this->assertSame($before, Company::count(), 'no junk "capegemni" company was created');
    }

    public function test_spacing_case_and_company_suffixes_do_not_make_a_new_company_either(): void
    {
        $before = Company::count();

        $this->assertSame('Infosys', $this->schedule('INFOSYS LIMITED')['company']['name']);
        $this->assertSame('Capgemini', $this->schedule('  Capgemini India Pvt. Ltd.  ')['company']['name']);
        $this->assertSame($before, Company::count());
    }

    public function test_a_genuinely_different_company_is_still_created_and_a_close_cousin_is_not_swallowed(): void
    {
        $before = Company::count();

        $zoho = $this->schedule('Zoho');
        $this->assertSame('Zoho', $zoho['company']['name']);
        $this->assertSame($before + 1, Company::count());

        // "Wipro Consumer Care" exists on its own, so this must not be folded into "Wipro" (nor create a second one).
        $cousin = $this->schedule('Wipro Consumer Care');
        $this->assertSame('Wipro Consumer Care', $cousin['company']['name']);
        $this->assertSame($before + 1, Company::count());

        $this->assertSame(2, PlacementDrive::count());
    }

    public function test_a_typo_that_could_mean_two_companies_is_not_guessed_at(): void
    {
        Company::create(['name' => 'Wiprr', 'slug' => 'wiprr', 'is_active' => true]);
        $before = Company::count();

        // "wipra" is one letter from both "wipro" and "wiprr": ambiguous, so a new company is made rather than a wrong one reused.
        $this->schedule('Wipra');

        $this->assertSame($before + 1, Company::count());
    }
}
