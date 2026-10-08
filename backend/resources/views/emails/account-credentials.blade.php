@include('emails.partials.header', ['preheader' => 'Your AptRun account is ready — sign in with the temporary password below.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Account Ready
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Your account is ready</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                @if ($user->role === 'admin_tpo')
                                    Mellow has set up your Training &amp; Placement Officer account for {{ $user->college?->name ?? 'your campus' }}
                                    on AptRun. Use the credentials below to sign in and start running placement drives.
                                @elseif ($user->role === 'admin_internal')
                                    Mellow has created your internal staff account on AptRun. Use the credentials below to sign in.
                                @elseif ($user->role === 'section_coordinator')
                                    {{ $user->college?->name ?? 'Your college' }} has set up your Section Coordinator account for
                                    Section {{ $user->section }} on AptRun. Use the credentials below to sign in and manage your section's roster.
                                @elseif ($user->role === 'admin_company')
                                    Mellow has set up your Hiring Team account for {{ $user->company?->name ?? 'your company' }}
                                    on AptRun. Use the credentials below to sign in and start running your hiring pipeline.
                                @elseif ($user->college)
                                    {{ $user->college->name }} has added you to AptRun to prepare for placements and sharpen your
                                    coding skills. Use the credentials below to sign in.
                                @elseif ($user->invitedByCompany)
                                    {{ $user->invitedByCompany->name }} has invited you to apply on AptRun. Use the credentials below
                                    to sign in and complete your assessment.
                                @else
                                    your AptRun account is ready. Use the credentials below to sign in and start practicing.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Email</p>
                                        <p style="font-size:14px; color:#111827; margin:0 0 14px 0; font-family: 'SF Mono', Consolas, monospace;">{{ $user->email }}</p>
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Temporary Password</p>
                                        <p style="font-size:14px; color:#111827; margin:0; font-family: 'SF Mono', Consolas, monospace;">{{ $plainPassword }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/login" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Sign in to AptRun
                            </a>
                        </td>
                    </tr>
@php
    $note = "This is a one-time password — the first time you sign in, you'll be asked to verify this email with a code and set your own permanent password before you can continue. "
        .($user->role === 'user' && $user->college ? "If you weren't expecting this email, contact your college's placement office." : "If you weren't expecting this email, contact Mellow support.");
@endphp
@include('emails.partials.footer', ['note' => $note])
