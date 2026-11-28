<?php

namespace Tests\Feature;

use App\Mail\AccountCredentialsMail;
use App\Mail\MockInterviewScheduleMail;
use App\Mail\NewsletterWelcomeMail;
use App\Mail\PasswordResetOtpMail;
use App\Mail\StudentBulkNotificationMail;
use App\Models\College;
use App\Models\Company;
use App\Models\Interview;
use App\Models\NewsletterSubscriber;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * Every e-mail AptRun sends carries the same Mellow Vault footer as the landing page (the product, who makes it, support, legal line),
 * and AptRun — not "Mellow" — is the one that sets up accounts.
 */
class EmailBrandingTest extends TestCase
{
    use RefreshDatabase;

    private function html(\Illuminate\Mail\Mailable $mail): string
    {
        return $mail->render();
    }

    public function test_the_footer_carries_the_mellow_vault_identity_the_landing_page_shows(): void
    {
        $college = College::create(['name' => 'Footer College', 'short_code' => 'FC']);
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id]);

        $html = $this->html(new AccountCredentialsMail($student, 'TempPass-123'));

        $this->assertStringContainsString('AptRun is a product of', $html);
        $this->assertStringContainsString('Mellow Vault', $html);
        $this->assertStringContainsString('https://mellowvault.com', $html);
        $this->assertStringContainsString(config('brand.support_email'), $html);
        $this->assertStringContainsString('+91 93111 48660', $html);
        $this->assertStringContainsString('PRAYUKTI DEVELOPMENT PRIVATE LIMITED', $html);
        $this->assertStringContainsString('CIN U62099UP2024PTC207212', $html);
        $this->assertStringContainsString('© '.date('Y').' AptRun. All Rights Reserved.', html_entity_decode($html));
        $this->assertStringContainsString(date('Y'), $html);
        foreach (['LinkedIn', 'Instagram', 'YouTube', 'Facebook'] as $social) {
            $this->assertStringContainsString($social, $html);
        }
        foreach (['/about', '/pricing', '/contact', '/privacy', '/terms'] as $path) {
            $this->assertStringContainsString($path, $html);
        }
    }

    public function test_the_footer_panel_reads_like_mellow_vaults_own_e_mails(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]);

        $html = $this->html(new PasswordResetOtpMail($student, '123456'));

        // why you are getting it, the four links a reader may want, and a "need help" line
        $this->assertStringContainsString('You are receiving this transactional email regarding your registered AptRun account.', $html);
        foreach (['Sign in' => '/login', 'Help &amp; contact' => '/contact', 'Privacy Policy' => '/privacy', 'Terms of Service' => '/terms'] as $label => $path) {
            $this->assertMatchesRegularExpression('#href="[^"]*'.preg_quote($path, '#').'"[^>]*>'.preg_quote($label, '#').'</a>#', $html, $label);
        }
        $this->assertStringContainsString('Need help? Contact us anytime at', $html);
        $this->assertStringContainsString('mailto:'.config('brand.support_email'), $html);
        // the card tells the reader what kind of message it is, before a word of it is read
        $this->assertStringContainsString('Security', $html);
        // dark mode is declared, and the colours that matter are still inline for clients that strip <style>
        $this->assertStringContainsString('prefers-color-scheme: dark', $html);
        $this->assertStringContainsString('background-color:#FFFFFF', $html);
    }

    public function test_every_link_and_image_points_at_the_public_site_never_at_where_the_app_happens_to_run(): void
    {
        // An e-mail is opened on someone else's machine: a localhost logo or login link is broken there.
        config(['app.frontend_url' => 'http://127.0.0.1:3000']);
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]);

        foreach ([new PasswordResetOtpMail($student, '123456'), new AccountCredentialsMail($student, 'TempPass-123'), new \App\Mail\WelcomeMail($student)] as $mail) {
            $html = $this->html($mail);

            $this->assertStringNotContainsString('127.0.0.1', $html);
            $this->assertStringNotContainsString('localhost', $html);
            $this->assertStringContainsString('src="https://aptrun.com/brand/aptrun-logo-email.png"', $html);
            foreach (['/login' => 'Sign in', '/contact' => 'Help &amp; contact', '/privacy' => 'Privacy Policy', '/terms' => 'Terms of Service'] as $path => $label) {
                $this->assertStringContainsString('href="https://aptrun.com'.$path.'"', $html, $label);
            }
        }

        // and it follows the setting when the site moves
        config(['brand.site_url' => 'https://staging.aptrun.example/']);
        $this->assertStringContainsString('href="https://staging.aptrun.example/login"', $this->html(new PasswordResetOtpMail($student, '123456')));
    }

    public function test_the_footer_carries_the_four_real_social_links_as_icons(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]);
        $html = $this->html(new PasswordResetOtpMail($student, '123456'));

        foreach (config('brand.socials') as $social) {
            $this->assertStringContainsString('href="'.$social['url'].'"', $html, $social['label']);
            $this->assertStringContainsString('src="https://aptrun.com/brand/email/'.strtolower($social['label']).'.png"', $html);
            $this->assertStringContainsString('alt="'.$social['label'].'"', $html);
        }

        // the files ship with the frontend, so none of these is an image that 404s (skipped when the frontend is not beside the backend)
        if (is_dir(base_path('../frontend/public/brand'))) {
            foreach (config('brand.socials') as $social) {
                $this->assertFileExists(base_path('../frontend/public/brand/email/'.strtolower($social['label']).'.png'));
            }
            $this->assertFileExists(base_path('../frontend/public/brand/aptrun-logo-email.png'));
        }
    }

    public function test_a_message_to_someone_without_an_account_says_why_they_got_it(): void
    {
        $html = (new NewsletterWelcomeMail(new NewsletterSubscriber(['email' => 'reader@example.com'])))->render();

        $this->assertStringContainsString('you subscribed to AptRun product updates', $html);
        $this->assertStringNotContainsString('registered AptRun account', $html);
    }

    public function test_the_brand_lines_match_the_landing_page_footer_source(): void
    {
        $path = base_path('../frontend/src/components/layout/Footer.tsx');

        if (! is_file($path)) {
            $this->markTestSkipped('The frontend is not next to the backend in this checkout.');
        }

        $footer = File::get($path);

        // One source of truth must not drift from the page it mirrors.
        $this->assertStringContainsString(config('brand.legal_entity'), $footer);
        $this->assertStringContainsString(config('brand.cin'), $footer);
        $this->assertStringContainsString(config('brand.support_email'), $footer);
        $this->assertStringContainsString(config('brand.support_phone'), $footer);
        foreach (config('brand.socials') as $social) {
            $this->assertStringContainsString($social['url'], $footer, "{$social['label']} link matches the website");
        }
    }

    public function test_account_creation_says_aptrun_set_up_the_account_for_every_role(): void
    {
        $college = College::create(['name' => 'Role College', 'short_code' => 'RC']);
        $company = Company::create(['name' => 'Acme Hiring', 'slug' => 'acme-hiring']);

        $cases = [
            'tpo' => User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]),
            'student' => User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id]),
            'coordinator' => User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $college->id, 'section' => 'CSE_A']),
            'company' => User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]),
            'staff' => User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]),
            'marketing' => User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING]),
            'direct' => User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]),
        ];

        foreach ($cases as $label => $user) {
            $html = $this->html(new AccountCredentialsMail($user->fresh(), 'TempPass-123'));

            $this->assertStringContainsString('AptRun has set up your', $html, "{$label}: says AptRun set up the account");
            $this->assertStringNotContainsString('Mellow has', $html, "{$label}: Mellow is not the one acting");
            $this->assertStringNotContainsString('contact Mellow support', $html, "{$label}: support is AptRun's");
            $this->assertStringContainsString('TempPass-123', $html);
        }
    }

    public function test_no_template_speaks_as_mellow(): void
    {
        $offenders = [];

        foreach (File::allFiles(resource_path('views/emails')) as $file) {
            $text = File::get($file->getPathname());

            // "Mellow Vault" (the company) and "Mellow Academy" (a product) are names; "Mellow has / Mellow staff / Mellow support / the Mellow team"
            // are the sender's voice, which is AptRun's.
            if (preg_match('/Mellow (has|staff|support|team|created|set up)|the Mellow team/i', $text) === 1) {
                $offenders[] = $file->getFilename();
            }
        }

        $this->assertSame([], $offenders, 'these templates still speak as "Mellow"');
    }

    public function test_other_mails_share_the_footer_and_the_new_wording(): void
    {
        $college = College::create(['name' => 'Wording College', 'short_code' => 'WC']);
        $direct = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]);
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id]);
        $interview = Interview::create(['title' => 'DBMS Mock', 'slug' => 'dbms-mock', 'status' => 'published', 'interview_type' => 'tpo_mock', 'owning_college_id' => $college->id, 'opens_at' => now()->addDay(), 'closes_at' => now()->addDays(3)]);

        $bulk = $this->html(new StudentBulkNotificationMail($direct));
        $this->assertStringContainsString('An update from the AptRun team', $bulk);
        $this->assertStringContainsString('AptRun is a product of', $bulk);

        $this->assertStringContainsString('AptRun is a product of', $this->html(new PasswordResetOtpMail($student, '123456')));

        foreach (['scheduled', 'changed', 'opening_soon', 'closing_soon'] as $kind) {
            $html = $this->html(new MockInterviewScheduleMail($student, $interview, $kind));
            $this->assertStringContainsString('DBMS Mock', $html, $kind);
            $this->assertStringContainsString('IST', $html, $kind);
            $this->assertStringContainsString('AptRun is a product of', $html, $kind);
            $this->assertStringContainsString('/dashboard/interviews', $html, $kind);
        }
    }
}
