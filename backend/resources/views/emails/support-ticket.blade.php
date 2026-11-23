@include('emails.partials.header', ['category' => 'Support Ticket', 'preheader' => 'New AptBot support inquiry #'.$ticket->ticket_number.' from '.$ticket->name.'.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#EEF2FF; color:#4F46E5; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:8px; border:1px solid #C7D2FE;">
                                Ticket #{{ $ticket->ticket_number }} · {{ strtoupper($ticket->category) }}
                            </span>
                            <h1 class="em-h" style="font-size:22px; line-height:1.3; font-weight:800; letter-spacing:-0.02em; margin:10px 0 8px 0; color:#0F172A;">
                                {{ $ticket->subject }}
                            </h1>
                            <p class="em-p" style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px 0;">
                                A student submitted an unresolved query through <strong>AptBot</strong>. You can reply directly to this email to contact the student.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td class="em-muted" style="padding:5px 0; font-size:12px; color:#64748B; width:30%;">Student Name</td>
                                                <td class="em-h" style="padding:5px 0; font-size:13px; color:#0F172A; font-weight:700;">{{ $ticket->name }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:5px 0; font-size:12px; color:#64748B;">Email Address</td>
                                                <td class="em-h" style="padding:5px 0; font-size:13px; color:#4F46E5; font-weight:700; font-family:'SF Mono', Consolas, monospace;">{{ $ticket->email }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:5px 0; font-size:12px; color:#64748B;">Category</td>
                                                <td class="em-h" style="padding:5px 0; font-size:13px; color:#0F172A; font-weight:700;">{{ ucfirst(str_replace('_', ' ', $ticket->category)) }}</td>
                                            </tr>
                                            @if ($ticket->user && $ticket->user->college)
                                            <tr>
                                                <td class="em-muted" style="padding:5px 0; font-size:12px; color:#64748B;">College</td>
                                                <td class="em-h" style="padding:5px 0; font-size:13px; color:#0F172A; font-weight:700;">{{ $ticket->user->college->name }}</td>
                                            </tr>
                                            @endif
                                            @if ($ticket->user && $ticket->user->roll_number)
                                            <tr>
                                                <td class="em-muted" style="padding:5px 0; font-size:12px; color:#64748B;">Roll Number</td>
                                                <td class="em-h" style="padding:5px 0; font-size:13px; color:#0F172A; font-weight:700; font-family:'SF Mono', Consolas, monospace;">{{ $ticket->user->roll_number }}</td>
                                            </tr>
                                            @endif
                                            @if ($ticket->user && $ticket->user->graduation_year)
                                            <tr>
                                                <td class="em-muted" style="padding:5px 0; font-size:12px; color:#64748B;">Graduation Year</td>
                                                <td class="em-h" style="padding:5px 0; font-size:13px; color:#0F172A; font-weight:700;">{{ $ticket->user->graduation_year }}</td>
                                            </tr>
                                            @endif
                                        </table>

                                        <div style="margin-top:16px; pt:16px; border-top:1px solid #E2E8F0;">
                                            <p class="em-muted" style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.06em; margin:14px 0 6px 0;">Detailed Query Description</p>
                                            <div style="background-color:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; padding:14px; font-size:13px; line-height:1.6; color:#1E293B; white-space:pre-wrap;">{{ $ticket->message }}</div>
                                        </div>

                                        @if (!empty($ticket->metadata))
                                        <div style="margin-top:14px; padding-top:12px; border-top:1px dashed #CBD5E1; font-size:11px; color:#64748B;">
                                            <strong>Context:</strong>
                                            @if (!empty($ticket->metadata['current_url']))
                                                Page: {{ $ticket->metadata['current_url'] }} &bull;
                                            @endif
                                            @if (!empty($ticket->metadata['user_agent']))
                                                Browser: {{ Str::limit($ticket->metadata['user_agent'], 80) }}
                                            @endif
                                        </div>
                                        @endif
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:22px 32px 10px 32px;">
                            <a href="mailto:{{ $ticket->email }}?subject={{ rawurlencode('Re: [AptBot Support #'.$ticket->ticket_number.'] '.$ticket->subject) }}" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; letter-spacing:0.01em; padding:12px 26px; border-radius:10px; border:1px solid #4338CA; box-shadow:0 6px 14px -6px rgba(79,70,229,0.65);">
                                Reply to Student Directly
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', [
    'note' => 'This inquiry was submitted via AptBot interactive support. Reply-To is set directly to '.$ticket->name.' <'.$ticket->email.'>.',
    'reason' => 'You are receiving this operational alert as an administrator of support@mellowvault.com.',
])
