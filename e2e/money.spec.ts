import { expect, test } from "@playwright/test";

import { formatCents, formatPay, formatPayCap, parseMoneyToCents } from "../src/lib/money";

// Pure checks on the money helpers (no browser needed).
test("parses money strings into integer cents", () => {
  expect(parseMoneyToCents("5")).toBe(500);
  expect(parseMoneyToCents("5.5")).toBe(550);
  expect(parseMoneyToCents("12.05")).toBe(1205);
  expect(parseMoneyToCents("$1,250.00")).toBe(125000);
  expect(parseMoneyToCents("0.10")).toBe(10);
  expect(parseMoneyToCents("1.005")).toBeNull();
  expect(parseMoneyToCents("-5")).toBeNull();
  expect(parseMoneyToCents("abc")).toBeNull();
  expect(parseMoneyToCents("")).toBeNull();
});

test("formats cents and pay", () => {
  expect(formatCents(500)).toBe("$5");
  expect(formatCents(550)).toBe("$5.50");
  expect(formatCents(125000)).toBe("$1,250");
  const perClip = { pay_cents: 500, pay_type: "per_unit", unit_label: "clip", max_units: 20 };
  expect(formatPay(perClip)).toBe("$5 per clip");
  expect(formatPayCap(perClip)).toBe("max 20 clips · up to $100");
  const fixed = { pay_cents: 2500, pay_type: "fixed", unit_label: null, max_units: null };
  expect(formatPay(fixed)).toBe("$25");
  expect(formatPayCap(fixed)).toBeNull();
});
