{{-- Closes the card/table/body/html opened by emails.partials.header. $note: the per-email disclaimer line ("if you weren't expecting this..."). $unsubscribeUrl (optional): adds the unsubscribe line every engagement email must carry. --}}
                    <tr>
                        <td style="padding:0 32px 28px 32px;">
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                {{ $note }}
                            </p>
                            @if (!empty($unsubscribeUrl))
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:10px 0 0 0;">
                                Don't want these reminders? <a href="{{ $unsubscribeUrl }}" style="color:#6B7280; text-decoration:underline;">Unsubscribe</a> &mdash; we'll still email you about your account, payments and security.
                            </p>
                            @endif
                            <p style="font-size:11px; line-height:1.6; color:#C4C8D4; margin:16px 0 0 0;">
                                AptRun &middot; The placement sandbox for colleges.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
