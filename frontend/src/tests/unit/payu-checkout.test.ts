import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { PayuRedirectError, forgetPayuAttempt, readPayuAttempt, rememberPayuAttempt, submitToPayu } from "@/lib/payu";
import type { PayuCheckoutOptions } from "@/types/payments";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body) } };
});

import { resumeAfterRedirect, runCheckout } from "@/lib/checkout";

const request = { planCode: "expert", expectedTotal: 1199, planName: "Expert" };
const fast = { intervalMs: 1, maxMs: 60 };

const payuCheckout: PayuCheckoutOptions = {
  gateway: "payu",
  action: "https://test.payu.in/_payment",
  method: "POST",
  fields: {
    key: "gtKFFx",
    txnid: "01JREFERENCE0000000000000",
    amount: "1199.00",
    productinfo: "AptRun Expert - 1 year",
    firstname: "Asha",
    email: "asha@example.com",
    phone: "9876543210",
    surl: "https://api.aptrun.test/api/payu/return",
    furl: "https://api.aptrun.test/api/payu/return",
    curl: "https://api.aptrun.test/api/payu/return",
    udf1: "01JREFERENCE00000000000000",
    hash: "a".repeat(128),
  },
  amount: 119900,
  currency: "INR",
  reference: "01JREFERENCE00000000000000",
  test_mode: true,
};

const created = (checkout: Partial<PayuCheckoutOptions> = {}) => ({ checkout: { ...payuCheckout, ...checkout }, quote: { total: 1199, currency: "INR" } });

const paidReceipt = { id: payuCheckout.reference, status: "paid", amount: 1199, description: "Expert" };

/** jsdom does not navigate: the form is captured instead of submitted. */
let submitted: HTMLFormElement | null;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  submitted = null;
  window.sessionStorage.clear();
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (this: HTMLFormElement) {
    submitted = this;
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("paying through PayU's hosted page", () => {
  it("posts the server's signed form to PayU and leaves, handing back no result (the student returns through the app)", async () => {
    post.mockResolvedValueOnce(created());
    const phases: string[] = [];

    const outcome = await runCheckout(request, { onPhase: (p) => phases.push(p) }, fast);

    expect(outcome).toEqual({ kind: "redirecting", reference: payuCheckout.reference });
    expect(post).toHaveBeenCalledWith("/me/checkout", { plan_code: "expert", expected_total: 1199 });
    expect(phases).toEqual(["creating", "redirecting"]);

    expect(submitted).not.toBeNull();
    expect(submitted!.method.toLowerCase()).toBe("post");
    expect(submitted!.action).toBe("https://test.payu.in/_payment");
  });

  it("submits exactly the fields the server signed — nothing added, nothing changed, no secret", async () => {
    post.mockResolvedValueOnce(created());

    await runCheckout(request, {}, fast);

    const sent = Object.fromEntries(new FormData(submitted!).entries());
    expect(sent).toEqual(payuCheckout.fields);
    expect(Object.keys(sent)).not.toContain("salt");
    expect(submitted!.querySelectorAll("input[type=hidden]")).toHaveLength(Object.keys(payuCheckout.fields).length);
  });

  it("sends the mobile number the student typed, when there is one, and not an empty field when there is not", async () => {
    post.mockResolvedValueOnce(created());
    await runCheckout({ ...request, phone: "9876543210" }, {}, fast);
    expect(post).toHaveBeenLastCalledWith("/me/checkout", { plan_code: "expert", expected_total: 1199, phone: "9876543210" });

    post.mockResolvedValueOnce(created());
    await runCheckout(request, {}, fast);
    expect(post).toHaveBeenLastCalledWith("/me/checkout", { plan_code: "expert", expected_total: 1199 });
  });

  it("writes the attempt down before leaving, so the billing page can look into it if the student comes back by the Back button", async () => {
    post.mockResolvedValueOnce(created());

    await runCheckout(request, {}, fast);

    expect(readPayuAttempt()).toMatchObject({ reference: payuCheckout.reference, planName: "Expert" });
  });

  it("lets the server's refusals reach the caller untouched, and sends nothing to PayU", async () => {
    post.mockRejectedValueOnce(new ApiError("Please add your mobile number.", 422, undefined, "phone_required"));

    await expect(runCheckout(request, {}, fast)).rejects.toMatchObject({ code: "phone_required" });
    expect(submitted).toBeNull();
    expect(readPayuAttempt()).toBeNull();
  });

  it.each([
    ["a script URL", "javascript:alert(1)"],
    ["an unencrypted site", "http://payments.evil.example/_payment"],
    ["something that is not a URL", "not a url"],
  ])("will not post a payment form to %s", async (_label, action) => {
    post.mockResolvedValueOnce(created({ action }));
    const phases: string[] = [];

    await expect(runCheckout(request, { onPhase: (p) => phases.push(p) }, fast)).rejects.toBeInstanceOf(PayuRedirectError);

    expect(submitted).toBeNull();
    expect(readPayuAttempt()).toBeNull();
    expect(phases.at(-1)).toBe("idle");
  });

  it("does allow a plain-http fake PayU on the developer's own machine", () => {
    submitToPayu({ ...payuCheckout, action: "http://127.0.0.1:4020/_payment" });
    expect(submitted!.action).toBe("http://127.0.0.1:4020/_payment");

    submitted = null;
    submitToPayu({ ...payuCheckout, action: "http://localhost:4020/_payment" });
    expect(submitted!.action).toBe("http://localhost:4020/_payment");
  });
});

describe("the remembered attempt", () => {
  it("is forgotten on request, after two hours, and when it is garbage", () => {
    rememberPayuAttempt({ reference: "R1", planName: "Expert" });
    expect(readPayuAttempt()).toMatchObject({ reference: "R1" });

    forgetPayuAttempt();
    expect(readPayuAttempt()).toBeNull();

    window.sessionStorage.setItem("aptrun.payu.attempt", JSON.stringify({ reference: "R2", planName: "", startedAt: Date.now() - 3 * 60 * 60 * 1000 }));
    expect(readPayuAttempt()).toBeNull();
    expect(window.sessionStorage.getItem("aptrun.payu.attempt")).toBeNull();

    window.sessionStorage.setItem("aptrun.payu.attempt", "{not json");
    expect(readPayuAttempt()).toBeNull();

    window.sessionStorage.setItem("aptrun.payu.attempt", JSON.stringify({ reference: 5 }));
    expect(readPayuAttempt()).toBeNull();
  });
});

describe("coming back from PayU", () => {
  /** The status endpoint, and the subscription it follows. */
  const serverSays = (status: string, extra: Record<string, unknown> = {}) =>
    get.mockImplementation(async (path: string) => {
      if (path === "/me/subscription") return { scope: "individual", coverage: { source: "individual", plan: { code: "expert", name: "Expert" } } };
      return { payment: { ...paidReceipt, status, ...extra } };
    });

  it("reports a paid order straight away, with the new subscription state", async () => {
    serverSays("paid");

    const outcome = await resumeAfterRedirect(payuCheckout.reference, "paid", fast);

    expect(outcome).toMatchObject({ kind: "paid", state: { coverage: { plan: { code: "expert" } }, payment: { status: "paid" } } });
    expect(get).toHaveBeenCalledWith(`/me/payments/${payuCheckout.reference}`);
  });

  it("believes the server over the hint: a 'failed' hint on an order that is in fact paid is a paid order", async () => {
    serverSays("paid");

    expect((await resumeAfterRedirect(payuCheckout.reference, "failed", fast)).kind).toBe("paid");
    expect((await resumeAfterRedirect(payuCheckout.reference, "cancelled", fast)).kind).toBe("paid");
  });

  it("never treats the hint as proof of payment: 'paid' on an order the server has not seen paid keeps asking, then says pending", async () => {
    serverSays("pending");

    const outcome = await resumeAfterRedirect(payuCheckout.reference, "paid", fast);

    expect(outcome).toMatchObject({ kind: "pending", reference: payuCheckout.reference });
    expect(get.mock.calls.length).toBeGreaterThan(2);
  });

  it("finishes as soon as the order turns paid while it waits", async () => {
    let calls = 0;
    get.mockImplementation(async (path: string) => {
      if (path === "/me/subscription") return { coverage: { source: "individual" } };
      calls += 1;
      return { payment: { ...paidReceipt, status: calls < 3 ? "pending" : "paid" } };
    });

    const outcome = await resumeAfterRedirect(payuCheckout.reference, "pending", { intervalMs: 1, maxMs: 500 });

    expect(outcome.kind).toBe("paid");
  });

  it("treats cancelling on PayU's page as a plain dismissal, with no waiting", async () => {
    serverSays("pending");

    expect(await resumeAfterRedirect(payuCheckout.reference, "cancelled", fast)).toEqual({ kind: "dismissed" });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("words a failed payment with the reason the server recorded, and does not wait for it", async () => {
    serverSays("failed", { failure_reason: "Insufficient funds in the account." });

    expect(await resumeAfterRedirect(payuCheckout.reference, "failed", fast)).toEqual({ kind: "failed", message: "Insufficient funds in the account." });
    expect(get).toHaveBeenCalledTimes(1);

    serverSays("pending", { failure_reason: null });
    expect(await resumeAfterRedirect(payuCheckout.reference, "failed", fast)).toMatchObject({ kind: "failed", message: expect.stringContaining("haven't been charged") });
  });

  it("says a payment that needs a person is on its way to being sorted, not that it failed", async () => {
    serverSays("processing");

    expect(await resumeAfterRedirect(payuCheckout.reference, "processing", fast)).toMatchObject({ kind: "pending", message: expect.stringContaining("couldn't activate your plan automatically") });
  });

  it("says a refunded payment did not buy the plan", async () => {
    serverSays("refunded");

    expect(await resumeAfterRedirect(payuCheckout.reference, null, fast)).toMatchObject({ kind: "failed", message: expect.stringContaining("refunded") });
  });

  it("keeps trying through a flaky network instead of giving up or claiming failure", async () => {
    let calls = 0;
    get.mockImplementation(async (path: string) => {
      calls += 1;
      if (calls <= 2) throw new TypeError("Failed to fetch");
      if (path === "/me/subscription") return { coverage: { source: "individual" } };
      return { payment: paidReceipt };
    });

    expect((await resumeAfterRedirect(payuCheckout.reference, "pending", { intervalMs: 1, maxMs: 500 })).kind).toBe("paid");
  });
});
