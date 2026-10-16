<?php

namespace App\Services\Payments;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The only code that speaks PayU's wire format (docs: https://docs.payu.in/docs/generate-hash-payu-hosted).
 *
 * PayU Hosted Checkout works with ONE secret, the merchant Salt, and ONE primitive, SHA-512:
 *
 *   request hash   sha512(key|txnid|amount|productinfo|firstname|email|udf1..udf5|<5 empty>|SALT)
 *                  — proves to PayU that the amount and buyer in the form were set by us, not edited
 *                  in the browser it passes through.
 *   response hash  sha512(SALT|status|<5 empty>|udf5..udf1|email|firstname|productinfo|amount|txnid|key)
 *                  — proves to us that the result POSTed to the return URL (or to a webhook) was
 *                  produced by PayU. It is the same string reversed, so it covers the amount and txnid.
 *   API hash       sha512(key|command|var1|SALT)  — every server-to-server call (verify_payment,
 *                  check_action_status, cancel_refund_transaction).
 *
 * The Salt never leaves this class and is never logged, sent to the browser or put in a URL. Amounts
 * travel as decimal rupees ("1199.00"); the rest of the app speaks integer paise, so the conversion
 * happens here and nowhere else. Reads are retried on a dropped connection; writes (refunds) are not —
 * a refund that timed out may have happened, and retrying it blind is how you refund twice.
 */
class PayuClient
{
    private const CHECKOUT_URL = ['test' => 'https://test.payu.in/_payment', 'live' => 'https://secure.payu.in/_payment'];

    private const API_URL = [
        'test' => 'https://test.payu.in/merchant/postservice.php?form=2',
        'live' => 'https://info.payu.in/merchant/postservice.php?form=2',
    ];

    /** PayU's own limit on surl / furl / curl. A longer URL is refused or cut short — never silently honoured. */
    public const MAX_RETURN_URL_LENGTH = 50;

    // ───────────────────────────── configuration ─────────────────────────────

    public function isConfigured(): bool
    {
        return $this->key() !== '' && $this->salt() !== '';
    }

    public function key(): string
    {
        return trim((string) config('billing.payu.key'));
    }

    /** `live` only when explicitly asked for — a forgotten setting means PayU's sandbox, not real money. */
    public function mode(): string
    {
        return strtolower(trim((string) config('billing.payu.mode'))) === 'live' ? 'live' : 'test';
    }

    /** Where the browser is sent (a form POST) to pay. */
    public function checkoutUrl(): string
    {
        $override = trim((string) config('billing.payu.checkout_url'));

        return $override !== '' ? $override : self::CHECKOUT_URL[$this->mode()];
    }

    /**
     * Where PayU sends the student's browser back to, by POST, once they have paid, failed or cancelled.
     * One URL for success, failure and cancel: the handler reads the result from what PayU posts.
     *
     * An explicit PAYU_RETURN_URL always wins. Otherwise: the configured APP_URL when it is a real address,
     * and the address the current request came in on when APP_URL is still the localhost placeholder — so
     * local development works with no setup, and a deployed server behind a proxy that hides https from
     * PHP still hands PayU an https URL (a POST to http:// that is redirected to https loses its body).
     */
    public function returnUrl(): string
    {
        $configured = trim((string) config('billing.payu.return_url'));

        if ($configured !== '') {
            return $configured;
        }

        $app = rtrim((string) config('app.url'), '/');
        $host = strtolower((string) parse_url($app, PHP_URL_HOST));

        if ($app !== '' && ! in_array($host, ['', 'localhost', '127.0.0.1', '::1'], true)) {
            return $app.'/api/payu/return';
        }

        return url('/api/payu/return');
    }

    public function webhookToken(): string
    {
        return trim((string) config('billing.payu.webhook_token'));
    }

    /** @return list<string> */
    public function webhookAllowedIps(): array
    {
        return array_values(array_filter(array_map('trim', explode(',', (string) config('billing.payu.webhook_allowed_ips')))));
    }

    private function salt(): string
    {
        return trim((string) config('billing.payu.salt'));
    }

    private function apiUrl(): string
    {
        $override = trim((string) config('billing.payu.api_url'));

        return $override !== '' ? $override : self::API_URL[$this->mode()];
    }

    // ───────────────────────────── hashes ─────────────────────────────

    /**
     * The hash that goes in the checkout form. `$fields` must carry exactly the key, txnid, amount,
     * productinfo, firstname, email and udf1–5 that are being posted (udfs not posted count as empty).
     *
     * @param  array<string, mixed>  $fields
     */
    public function requestHash(array $fields): string
    {
        $parts = [
            $fields['key'] ?? '',
            $fields['txnid'] ?? '',
            $fields['amount'] ?? '',
            $fields['productinfo'] ?? '',
            $fields['firstname'] ?? '',
            $fields['email'] ?? '',
            $fields['udf1'] ?? '',
            $fields['udf2'] ?? '',
            $fields['udf3'] ?? '',
            $fields['udf4'] ?? '',
            $fields['udf5'] ?? '',
            '', '', '', '', '',   // five reserved slots (udf6–udf10) — always empty, but their pipes are part of the string
            $this->salt(),
        ];

        return hash('sha512', implode('|', array_map('strval', $parts)));
    }

    /**
     * Is this response — the POST to our return URL, or a payment webhook — really from PayU?
     *
     * The hash is recomputed from the fields it echoes, in reverse order, and compared in constant time.
     * PayU prepends `additionalCharges` (when a convenience fee applies) and `splitInfo` (split-settlement
     * accounts) to the string; whether they take part depends on the account, so every layout the docs
     * describe is tried. That is safe: any of them needs the Salt to produce a match.
     *
     * @param  array<string, mixed>  $post
     */
    public function verifyResponseHash(array $post): bool
    {
        $given = strtolower(trim((string) ($post['hash'] ?? '')));

        if ($this->salt() === '' || $given === '' || ! isset($post['status'], $post['txnid'], $post['amount'], $post['key'])) {
            return false;
        }

        // A response meant for a different merchant account is not ours, however well it is signed.
        if (! hash_equals($this->key(), (string) $post['key'])) {
            return false;
        }

        $field = fn (string $name): string => (string) ($post[$name] ?? '');

        $core = [
            $field('status'),
            '', '', '', '', '',   // the same five reserved slots, mirrored
            $field('udf5'), $field('udf4'), $field('udf3'), $field('udf2'), $field('udf1'),
            $field('email'), $field('firstname'), $field('productinfo'), $field('amount'), $field('txnid'), $field('key'),
        ];

        $charges = array_key_exists('additionalCharges', $post) ? $field('additionalCharges') : (array_key_exists('additional_charges', $post) ? $field('additional_charges') : null);
        $split = array_key_exists('splitInfo', $post) ? $field('splitInfo') : null;

        $candidates = [];

        foreach ([null, $charges] as $prefix) {
            foreach ([null, $split] as $splitInfo) {
                $parts = $core;

                if ($splitInfo !== null) {
                    array_splice($parts, 1, 0, [$splitInfo]);   // right after `status`
                }

                array_unshift($parts, $this->salt());

                if ($prefix !== null) {
                    array_unshift($parts, $prefix);
                }

                $candidates[hash('sha512', implode('|', $parts))] = true;
            }
        }

        foreach (array_keys($candidates) as $expected) {
            if (hash_equals($expected, $given)) {
                return true;
            }
        }

        return false;
    }

    /** sha512(key|command|var1|salt) — what every postservice command is signed with. */
    private function commandHash(string $command, string $var1): string
    {
        return hash('sha512', $this->key().'|'.$command.'|'.$var1.'|'.$this->salt());
    }

    // ───────────────────────────── webhook gate ─────────────────────────────

    /** True when no token is configured (nothing to check) or the one in the URL matches, in constant time. */
    public function webhookTokenMatches(?string $given): bool
    {
        $expected = $this->webhookToken();

        return $expected === '' || ($given !== null && hash_equals($expected, $given));
    }

    // ───────────────────────────── server-to-server API ─────────────────────────────

    /**
     * What PayU itself says about one of our transactions — the authority every other signal (the browser
     * return, a webhook) is checked against before a plan is handed over.
     *
     * @return ?array<string, mixed> PayU's record of the transaction; null when PayU has never seen this txnid
     *
     * @throws GatewayRequestException PayU could not be reached or did not answer properly
     */
    public function verifyPayment(string $txnid): ?array
    {
        $answer = $this->command('verify_payment', $txnid);
        $details = $answer['transaction_details'] ?? null;

        if (! is_array($details)) {
            // Wrong key/salt/hash is the usual cause. Never the student's problem, always ours to fix.
            Log::error('PayU verify_payment gave no transaction_details', ['msg' => $answer['msg'] ?? null]);

            throw new GatewayRequestException('PayU did not answer the payment verification.', 200, null, (string) ($answer['msg'] ?? ''));
        }

        $entry = $details[$txnid] ?? null;

        if (! is_array($entry) || ($entry['mihpayid'] ?? 'Not Found') === 'Not Found' || ($entry['status'] ?? '') === 'Not Found') {
            return null;
        }

        return $entry;
    }

    /**
     * Every action PayU has taken on one payment (the capture, each refund) by its PayU id.
     *
     * @return array<string, array<string, mixed>> actions keyed by PayU's request id
     *
     * @throws GatewayRequestException
     */
    public function actionStatus(string $mihpayid): array
    {
        $answer = $this->command('check_action_status', $mihpayid, ['var2' => 'payuid']);
        $details = $answer['transaction_details'] ?? null;

        if (! is_array($details)) {
            Log::error('PayU check_action_status gave no transaction_details', ['msg' => $answer['msg'] ?? null]);

            throw new GatewayRequestException('PayU did not answer the action-status request.', 200, null, (string) ($answer['msg'] ?? ''));
        }

        $actions = $details[$mihpayid] ?? [];

        return is_array($actions) ? array_filter($actions, 'is_array') : [];
    }

    /**
     * Asks PayU to refund a captured payment (`cancel_refund_transaction`). PayU queues the refund and
     * settles it with the bank later — "accepted" here is not "money is back"; the refund webhook (or
     * actionStatus()) reports how it ended.
     *
     * `$token` must be new for every refund request — PayU rejects a reused one, which is what makes a
     * retry of the very same refund harmless.
     *
     * @return array<string, mixed>
     *
     * @throws GatewayRequestException
     */
    public function refund(string $mihpayid, string $token, int $amountPaise, string $remarks = ''): array
    {
        $extra = ['var2' => $token, 'var3' => $this->rupees($amountPaise)];

        // Remarks are optional, and PayU silently drops them when they hold any of: # $ % ^ & * + = [ ] \ ' ; / { } : < > ? ~
        $remarks = trim((string) preg_replace('/[^A-Za-z0-9 .,()_@-]/', '', $remarks));

        if ($remarks !== '') {
            $extra['var9'] = json_encode(['refundDetails' => ['remarks' => mb_substr($remarks, 0, 200)]]);
        }

        $answer = $this->command('cancel_refund_transaction', $mihpayid, $extra, retry: false);

        // `status` 1 is "request queued"; error_code 102 is documented as success too.
        if ((int) ($answer['status'] ?? 0) === 1 || (string) ($answer['error_code'] ?? '') === '102') {
            return $answer;
        }

        Log::error('PayU refund was refused', ['msg' => $answer['msg'] ?? null, 'error_code' => $answer['error_code'] ?? null]);

        throw new GatewayRequestException('PayU refused the refund.', 200, (string) ($answer['error_code'] ?? ''), (string) ($answer['msg'] ?? ''));
    }

    /**
     * @param  array<string, string>  $extra
     * @return array<string, mixed>
     *
     * @throws GatewayRequestException
     */
    private function command(string $command, string $var1, array $extra = [], bool $retry = true): array
    {
        if (! $this->isConfigured()) {
            throw new GatewayRequestException('PayU keys are not configured.');
        }

        $form = ['key' => $this->key(), 'command' => $command, 'var1' => $var1, 'hash' => $this->commandHash($command, $var1)] + $extra;

        try {
            $request = Http::asForm()
                ->acceptJson()
                ->connectTimeout(5)
                ->timeout((int) config('billing.payu.timeout_seconds', 15));

            // Only a connection failure is retried, and only for reads.
            if ($retry) {
                $request = $request->retry(2, 250, fn ($e) => $e instanceof ConnectionException, throw: false);
            }

            $response = $request->post($this->apiUrl(), $form);
        } catch (ConnectionException $e) {
            Log::warning('PayU unreachable', ['command' => $command, 'error' => $e->getMessage()]);

            throw new GatewayRequestException('PayU could not be reached.');
        }

        // What PayU said goes to the log, never to the student. No request body, no credentials, no card or buyer data.
        if (! $response->successful()) {
            Log::error('PayU request failed', ['command' => $command, 'status' => $response->status()]);

            throw new GatewayRequestException("PayU answered {$response->status()} for {$command}.", $response->status());
        }

        $json = $response->json();

        if (! is_array($json)) {
            Log::error('PayU answered with something that is not JSON', ['command' => $command, 'status' => $response->status()]);

            throw new GatewayRequestException("PayU did not answer {$command} with JSON.", $response->status());
        }

        return $json;
    }

    // ───────────────────────────── amounts ─────────────────────────────

    /** 119900 → "1199.00": the exact string that is hashed and posted, so both sides agree to the paisa. */
    public function rupees(int $paise): string
    {
        return number_format($paise / 100, 2, '.', '');
    }

    /** "1199.00" / 1199 / "1,199.00" → 119900. Anything that is not a number is -1, which never equals a real amount. */
    public static function toPaise(mixed $amount): int
    {
        $clean = str_replace(',', '', trim((string) $amount));

        return is_numeric($clean) ? (int) round(((float) $clean) * 100) : -1;
    }
}
