<?php

namespace Tests\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * An in-memory PayU: the hosted checkout page that takes our signed form, the bank behind it, and the
 * server-to-server API (verify_payment, check_action_status, cancel_refund_transaction) — with the field
 * names, statuses and hash formulas PayU's documentation gives (https://docs.payu.in).
 *
 * The hash code here is written from the documentation and is deliberately NOT shared with the app's
 * PayuClient: a test that signs with the app's own code would pass however wrong that code was. If the app
 * and this fake agree, the app agrees with PayU's published formula.
 *
 * Stateful on purpose — a transaction paid here is what verify_payment returns, a refund shows up in
 * check_action_status — so a test reads like the real sequence of events. Server-to-server calls must carry
 * the right key and sha512(key|command|var1|salt) hash, like the real API, or PayU's "Invalid Hash" answer.
 */
class FakePayuGateway
{
    public const KEY = 'FakePayuKey01';

    public const SALT = 'fake-payu-salt-for-tests-only-0123456789abcdef';

    public const WEBHOOK_TOKEN = 'fake-payu-webhook-token';

    /** @var array<string, array<string, mixed>> txnid => transaction */
    public array $transactions = [];

    /** @var array<string, array<string, mixed>> PayU request id => refund row */
    public array $refunds = [];

    /** Every call fails as if the network were down. */
    public bool $down = false;

    /** @var array<string, int> command => HTTP status to answer with instead, until cleared */
    public array $failures = [];

    private int $sequence = 0;

    /** Route every PayU API call to this fake. Call once per test. */
    public function install(): self
    {
        Http::fake([
            'test.payu.in/merchant/*' => fn (Request $request) => $this->handle($request),
            'info.payu.in/merchant/*' => fn (Request $request) => $this->handle($request),
        ]);

        return $this;
    }

    // ───────────────────────────── the hosted page ─────────────────────────────

    /**
     * The student's browser POSTs our signed form to PayU's page. PayU rejects what it would really reject
     * (wrong key or hash, missing fields, over-long values, a txnid already paid) — as an exception, so a
     * test that sent PayU something it would refuse fails loudly rather than carrying on.
     *
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed> the transaction PayU now holds (status `initiated`)
     */
    public function submitCheckout(array $fields): array
    {
        foreach (['key', 'txnid', 'amount', 'productinfo', 'firstname', 'email', 'surl', 'furl', 'hash'] as $required) {
            if (blank($fields[$required] ?? null)) {
                throw new \RuntimeException("PayU would reject this checkout form: `{$required}` is missing.");
            }
        }

        if ($fields['key'] !== self::KEY) {
            throw new \RuntimeException('PayU would reject this checkout form: unknown merchant key.');
        }

        // PayU: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
        $expected = hash('sha512', implode('|', [
            $fields['key'], $fields['txnid'], $fields['amount'], $fields['productinfo'], $fields['firstname'], $fields['email'],
            $fields['udf1'] ?? '', $fields['udf2'] ?? '', $fields['udf3'] ?? '', $fields['udf4'] ?? '', $fields['udf5'] ?? '',
            '', '', '', '', '',
            self::SALT,
        ]));

        if (! hash_equals($expected, strtolower((string) $fields['hash']))) {
            throw new \RuntimeException('PayU would reject this checkout form: hash mismatch (the formula, a field or the salt is wrong).');
        }

        // The limits PayU documents ("Additional Info for Payment APIs").
        foreach (['txnid' => 25, 'productinfo' => 100, 'firstname' => 20, 'email' => 50, 'surl' => 50, 'furl' => 50, 'curl' => 50, 'udf1' => 255] as $name => $max) {
            if (strlen((string) ($fields[$name] ?? '')) > $max) {
                throw new \RuntimeException("PayU would reject this checkout form: `{$name}` is longer than {$max} characters.");
            }
        }

        if (preg_match('/[|&<>"\']/', $fields['productinfo'].$fields['firstname'])) {
            throw new \RuntimeException('PayU would reject this checkout form: productinfo/firstname hold characters that break the hash string.');
        }

        if (! preg_match('/^\d+\.\d{2}$/', (string) $fields['amount'])) {
            throw new \RuntimeException("PayU would reject this checkout form: amount `{$fields['amount']}` is not a two-decimal number.");
        }

        if (($this->transactions[$fields['txnid']]['status'] ?? null) === 'success') {
            throw new \RuntimeException('PayU would reject this checkout form: duplicate transaction id (already paid).');
        }

        return $this->transactions[$fields['txnid']] = [
            'txnid' => $fields['txnid'],
            'request' => $fields,
            'mihpayid' => (string) (403993715520000000 + ++$this->sequence),
            'status' => 'pending',
            'unmappedstatus' => 'initiated',
            'mode' => '',
            'error' => 'E000',
            'error_Message' => 'No Error',
            'bank_ref_num' => '',
        ];
    }

    // ───────────────────────────── what the customer does at the bank ─────────────────────────────

    /**
     * The customer pays. A successful, captured card payment for the form's exact amount unless overridden
     * (`status`, `unmappedstatus`, `mode`, `amount`…).
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public function pay(string $txnid, array $overrides = []): array
    {
        $this->assertKnown($txnid);

        return $this->transactions[$txnid] = array_merge($this->transactions[$txnid], [
            'status' => 'success',
            'unmappedstatus' => 'captured',
            'mode' => 'CC',
            'bank_ref_num' => 'BANKREF'.str_pad((string) ++$this->sequence, 8, '0', STR_PAD_LEFT),
            'error' => 'E000',
            'error_Message' => 'No Error',
            'field9' => 'Transaction Completed Successfully',
        ], $overrides);
    }

    /** A declined / failed attempt, the way PayU reports one. */
    public function fail(string $txnid, string $message = 'Bank denied transaction on the card.'): array
    {
        return $this->pay($txnid, [
            'status' => 'failure',
            'unmappedstatus' => 'failed',
            'error' => 'E325',
            'error_Message' => $message,
            'field9' => $message,
        ]);
    }

    /** The customer pressed Cancel on PayU's page. */
    public function cancel(string $txnid): array
    {
        return $this->pay($txnid, ['status' => 'failure', 'unmappedstatus' => 'userCancelled', 'mode' => '', 'error' => 'E1604', 'error_Message' => 'Cancelled by user']);
    }

    /** The customer is still on PayU's page / 3DS is in progress. */
    public function pending(string $txnid, string $unmapped = 'in progress'): array
    {
        return $this->pay($txnid, ['status' => 'pending', 'unmappedstatus' => $unmapped, 'error' => 'E000']);
    }

    public function lastTxnid(): string
    {
        return (string) array_key_last($this->transactions);
    }

    // ───────────────────────────── what PayU POSTs to us ─────────────────────────────

    /**
     * The fields PayU POSTs to our `surl` / `furl` (and to a payment webhook): everything echoed back plus the
     * outcome, signed with PayU's reverse hash —
     * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key).
     *
     * @param  array<string, mixed>  $override  applied BEFORE signing (a different status, amount…), as if PayU said it
     * @return array<string, string>
     */
    public function responseFields(string $txnid, array $override = []): array
    {
        $this->assertKnown($txnid);

        $t = array_merge($this->transactions[$txnid], $override);
        $r = $t['request'];

        $fields = [
            'mihpayid' => (string) $t['mihpayid'],
            'mode' => (string) $t['mode'],
            'status' => (string) $t['status'],
            'unmappedstatus' => (string) $t['unmappedstatus'],
            'key' => self::KEY,
            'txnid' => $txnid,
            'amount' => (string) ($t['amount'] ?? $r['amount']),
            'discount' => '0.00',
            'net_amount_debit' => $t['status'] === 'success' ? (string) ($t['amount'] ?? $r['amount']) : '0',
            'addedon' => '2026-10-15 10:00:00',
            'productinfo' => (string) $r['productinfo'],
            'firstname' => (string) $r['firstname'],
            'lastname' => '',
            'address1' => '', 'address2' => '', 'city' => '', 'state' => '', 'country' => '', 'zipcode' => '',
            'email' => (string) $r['email'],
            'phone' => (string) ($r['phone'] ?? ''),
            'udf1' => (string) ($r['udf1'] ?? ''), 'udf2' => (string) ($r['udf2'] ?? ''), 'udf3' => (string) ($r['udf3'] ?? ''),
            'udf4' => (string) ($r['udf4'] ?? ''), 'udf5' => (string) ($r['udf5'] ?? ''),
            'udf6' => '', 'udf7' => '', 'udf8' => '', 'udf9' => '', 'udf10' => '',
            'field9' => (string) ($t['field9'] ?? ''),
            'payment_source' => 'payu',
            'PG_TYPE' => 'CC-PG',
            'bank_ref_num' => (string) $t['bank_ref_num'],
            'bankcode' => 'CC',
            'error' => (string) $t['error'],
            'error_Message' => (string) $t['error_Message'],
        ];

        $fields['hash'] = $this->reverseHash($fields);

        return $fields;
    }

    /** PayU's response hash over `$fields` — written from the docs, independent of the app. */
    public function reverseHash(array $fields): string
    {
        return hash('sha512', implode('|', [
            self::SALT, $fields['status'],
            '', '', '', '', '',
            $fields['udf5'] ?? '', $fields['udf4'] ?? '', $fields['udf3'] ?? '', $fields['udf2'] ?? '', $fields['udf1'] ?? '',
            $fields['email'], $fields['firstname'], $fields['productinfo'], $fields['amount'], $fields['txnid'], $fields['key'],
        ]));
    }

    /** A refund webhook body (JSON), as PayU sends it for the refund with this request id. @return array<string, mixed> */
    public function refundWebhook(string $requestId, ?string $status = null): array
    {
        $row = $this->refunds[$requestId] ?? throw new \RuntimeException("Unknown refund {$requestId}");

        return [
            'additionalValue1' => null,
            'bank_arn' => null,
            'refund_mode' => 'Back to Source',
            'bank_ref_num' => $row['bank_ref_num'],
            'key' => self::KEY,
            'amt' => $row['amt'],
            'remark' => null,
            'status' => $status ?? $row['status'],
            'token' => $row['token'],
            'mihpayid' => $row['mihpayid'],
            'request_id' => $requestId,
            'merchantTxnId' => $row['txnid'],
            'additionalValue2' => null,
            'action' => 'refund',
        ];
    }

    /** A chargeback webhook body (JSON). @return array<string, mixed> */
    public function disputeWebhook(string $mihpayid, string $cbStatus = 'New', string $cbId = '1761758'): array
    {
        return [
            'type' => 'payments',
            'event' => 'dispute',
            'reason_code' => 'Fraud - Card Present Environment',
            'created_at' => '2026-10-15T21:28:25.000+05:30',
            'updated_at' => '2026-10-15T22:08:16.000+05:30',
            'mid' => '2',
            'cb_id' => (int) $cbId,
            'txn_id' => $mihpayid,
            'cb_type' => 'RBI/BO',
            'due_date' => '2026-11-30',
            'cb_amount' => '1.0',
            'cb_status' => $cbStatus,
        ];
    }

    /**
     * A refund finance starts from PayU's dashboard — no API call from us. Returns PayU's request id for it.
     * `$amount` defaults to the whole payment.
     */
    public function dashboardRefund(string $txnid, ?string $amount = null, string $status = 'success'): string
    {
        $this->assertKnown($txnid);

        $t = $this->transactions[$txnid];
        $requestId = (string) (7000000000 + ++$this->sequence);

        $this->refunds[$requestId] = [
            'mihpayid' => $t['mihpayid'], 'txnid' => $txnid, 'token' => 'DASH'.$requestId,
            'amt' => $amount ?? (string) ($t['amount'] ?? $t['request']['amount']),
            'status' => $status, 'bank_ref_num' => 'RFBANK'.$requestId,
        ];

        return $requestId;
    }

    /** The bank finishes a refund PayU had queued: flips its status and returns the webhook PayU would send. @return array<string, mixed> */
    public function settleRefund(string $requestId, string $status = 'success'): array
    {
        $this->refunds[$requestId]['status'] = $status;

        return $this->refundWebhook($requestId);
    }

    /** Number of API calls made so far for a command, e.g. `calls('verify_payment')`. */
    public function calls(string $command): int
    {
        return Http::recorded()->filter(function (array $pair) use ($command) {
            /** @var Request $request */
            [$request] = $pair;

            return ($request->data()['command'] ?? null) === $command;
        })->count();
    }

    // ───────────────────────────── the fake API ─────────────────────────────

    private function handle(Request $request)
    {
        if ($this->down) {
            throw new ConnectionException('cURL error 7: Failed to connect to test.payu.in (fake outage)');
        }

        $data = $request->data();
        $command = (string) ($data['command'] ?? '');
        $var1 = (string) ($data['var1'] ?? '');

        if (isset($this->failures[$command])) {
            return Http::response('Service Unavailable', $this->failures[$command]);
        }

        // PayU authenticates every command with the merchant key and sha512(key|command|var1|salt).
        $hash = hash('sha512', ($data['key'] ?? '').'|'.$command.'|'.$var1.'|'.self::SALT);

        if (($data['key'] ?? '') !== self::KEY || ! hash_equals($hash, (string) ($data['hash'] ?? ''))) {
            return Http::response(['status' => 0, 'msg' => 'Invalid Hash']);
        }

        return match ($command) {
            'verify_payment' => $this->verifyPayment($var1),
            'check_action_status' => $this->checkActionStatus($var1),
            'cancel_refund_transaction' => $this->cancelRefund($var1, $data),
            default => Http::response(['status' => 0, 'msg' => "Unknown command {$command}"]),
        };
    }

    private function verifyPayment(string $var1)
    {
        $details = [];

        foreach (explode('|', $var1) as $txnid) {
            $t = $this->transactions[$txnid] ?? null;

            $details[$txnid] = $t === null ? ['mihpayid' => 'Not Found', 'status' => 'Not Found'] : [
                'mihpayid' => $t['mihpayid'],
                'request_id' => '',
                'bank_ref_num' => $t['bank_ref_num'],
                'amt' => $t['amount'] ?? $t['request']['amount'],
                'transaction_amount' => $t['amount'] ?? $t['request']['amount'],
                'txnid' => $txnid,
                'additional_charges' => '0.00',
                'productinfo' => $t['request']['productinfo'],
                'firstname' => $t['request']['firstname'],
                'bankcode' => 'CC',
                'udf1' => $t['request']['udf1'] ?? '',
                'udf2' => '', 'udf3' => '', 'udf4' => '', 'udf5' => '',
                'error_code' => $t['error'],
                'addedon' => '2026-10-15 10:00:00',
                'payment_source' => 'payu',
                'error_Message' => $t['error_Message'] === 'No Error' ? 'NO ERROR' : $t['error_Message'],   // PayU's verify_payment shouts the no-error case
                'net_amount_debit' => $t['status'] === 'success' ? ($t['amount'] ?? $t['request']['amount']) : '0.00',
                'disc' => '0.00',
                'mode' => $t['mode'],
                'PG_TYPE' => 'CC-PG',
                'card_no' => 'XXXXXXXXXXXX2346',
                'status' => $t['status'],
                'unmappedstatus' => $t['unmappedstatus'],
            ];
        }

        $found = count(array_filter($details, fn ($d) => $d['mihpayid'] !== 'Not Found'));

        return Http::response([
            'status' => $found > 0 ? 1 : 0,
            'msg' => $found.' out of '.count($details).' Transactions Fetched Successfully',
            'transaction_details' => $details,
        ]);
    }

    private function checkActionStatus(string $mihpayid)
    {
        $txn = collect($this->transactions)->first(fn ($t) => $t['mihpayid'] === $mihpayid);

        if ($txn === null) {
            return Http::response(['status' => 0, 'msg' => '0 out of 1 Transactions Fetched Successfully', 'transaction_details' => [$mihpayid => 'No action status found']]);
        }

        $rows = [];

        foreach ($this->refunds as $requestId => $refund) {
            if ($refund['mihpayid'] === $mihpayid) {
                $rows[$requestId] = [
                    'mihpayid' => $mihpayid, 'bank_ref_num' => $refund['bank_ref_num'], 'request_id' => (string) $requestId, 'amt' => $refund['amt'],
                    'mode' => $txn['mode'], 'action' => 'refund', 'token' => $refund['token'], 'status' => $refund['status'],
                    'bank_arn' => null, 'settlement_id' => null, 'amount_settled' => null, 'UTR_no' => null, 'value_date' => null, 'refund_mode' => 'Back to Source',
                ];
            }
        }

        return Http::response(['status' => 1, 'msg' => '1 out of 1 Transactions Fetched Successfully', 'transaction_details' => [$mihpayid => $rows]]);
    }

    private function cancelRefund(string $mihpayid, array $data)
    {
        $txn = collect($this->transactions)->first(fn ($t) => $t['mihpayid'] === $mihpayid);

        if ($txn === null) {
            return Http::response(['status' => 0, 'msg' => 'transaction not exists']);
        }

        $token = (string) ($data['var2'] ?? '');
        $amount = (string) ($data['var3'] ?? '');

        if ($token === '') {
            return Http::response(['status' => 0, 'msg' => 'token is empty', 'mihpayid' => $mihpayid]);
        }

        if (strlen($token) > 23) {
            return Http::response(['status' => 0, 'msg' => 'token length should not be greater than 23 characters']);
        }

        if ($amount === '') {
            return Http::response(['status' => 0, 'msg' => 'amount is empty']);
        }

        if ($txn['status'] !== 'success') {
            return Http::response(['status' => 0, 'msg' => 'Refund request failed']);
        }

        if (collect($this->refunds)->contains(fn ($r) => $r['token'] === $token)) {
            return Http::response(['status' => 0, 'msg' => 'token already used or request pending']);
        }

        $paid = (float) ($txn['amount'] ?? $txn['request']['amount']);
        $already = (float) collect($this->refunds)->where('mihpayid', $mihpayid)->where('status', '!=', 'failure')->sum(fn ($r) => (float) $r['amt']);

        if ((float) $amount + $already > $paid + 0.001) {
            return Http::response(['status' => 0, 'msg' => 'Refund request failed']);
        }

        $requestId = (string) (7000000000 + ++$this->sequence);

        $this->refunds[$requestId] = [
            'mihpayid' => $mihpayid, 'txnid' => $txn['txnid'], 'token' => $token, 'amt' => number_format((float) $amount, 2, '.', ''),
            'status' => 'queued', 'bank_ref_num' => 'RFBANK'.$requestId,
        ];

        return Http::response(['status' => 1, 'msg' => 'Refund Request Queued', 'request_id' => $requestId, 'bank_ref_num' => 'RFBANK'.$requestId, 'mihpayid' => $mihpayid]);
    }

    private function assertKnown(string $txnid): void
    {
        if (! isset($this->transactions[$txnid])) {
            throw new \RuntimeException("PayU has no transaction {$txnid} — submit the checkout form first.");
        }
    }
}
