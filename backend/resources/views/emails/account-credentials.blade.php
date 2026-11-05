@include('emails.partials.header', ['category' => 'Account', 'preheader' => 'AptRun has set up your account. Sign in with the temporary password below.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Account Ready
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">AptRun has set up your account</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                @if ($user->role === 'admin_tpo')
                                    AptRun has set up your Training &amp; Placement Officer account for {{ $user->college?->name ?? 'your campus' }}.
                                    Use the credentials below to sign in and start running placement drives.
                                @elseif ($user->role === 'admin_internal')
                                    AptRun has set up your internal staff account. Use the credentials below to sign in.
                                @elseif ($user->role === 'admin_marketing')
                                    AptRun has set up your marketing team account. Use the credentials below to sign in.
                                @elseif ($user->role === 'section_coordinator')
                                    AptRun has set up your Section Coordinator account for Section {{ $user->section }} at {{ $user->college?->name ?? 'your college' }}.
                                    Use the credentials below to sign in and look after your section's students.
                                @elseif ($user->role === 'admin_company')
                                    AptRun has set up your Hiring Team account for {{ $user->company?->name ?? 'your company' }}.
                                    Use the credentials below to sign in and start running your hiring pipeline.
                                @elseif ($user->college)
                                    AptRun has set up your account, added by {{ $user->college->name }} to help you prepare for placements and sharpen your
                                    skills. Use the credentials below to sign in.
                                @elseif ($user->invitedByCompany)
                                    AptRun has set up your account so you can apply to {{ $user->invitedByCompany->name }}. Use the credentials below
                                    to sign in and complete your assessment.
                                @else
                                    AptRun has set up your account. Use the credentials below to sign in and start practising.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Email</p>
                                        <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0 0 14px 0; font-family: 'SF Mono', Consolas, monospace;">{{ $user->email }}</p>
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Temporary Password</p>
                                        <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0; font-family: 'SF Mono', Consolas, monospace;">{{ $plainPassword }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/login" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Sign in to AptRun
                            </a>
                        </td>
                    </tr>
@php
    $note = "This is a one-time password: the first time you sign in, you'll be asked to verify this email with a code and set your own permanent password before you can continue. AptRun will never ask you for your password. "
        .($user->role === 'user' && $user->college ? "If you weren't expecting this email, contact your college's placement office." : "If you weren't expecting this email, contact AptRun support at ".config('brand.support_email').'.');
@endphp
@include('emails.partials.footer', ['note' => $note])
