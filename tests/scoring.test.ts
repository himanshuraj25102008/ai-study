import assert from "node:assert/strict";
import test from "node:test";
import { isAnswerCorrect, nextStreak } from "../lib/scoring";
import { isAdminEmail } from "../lib/admin";

test("integer answers accept signed whole numbers and reject decimals", () => {
  assert.equal(isAnswerCorrect("integer", "-12", "-12"), true);
  assert.equal(isAnswerCorrect("integer", "12", "12.0"), false);
  assert.equal(isAnswerCorrect("integer", "12", " 12 "), true);
});

test("optional numeric answers support decimals and reject invalid numbers", () => {
  assert.equal(isAnswerCorrect("number", "2.75", "2.75"), true);
  assert.equal(isAnswerCorrect("number", "-0.5", " -0.5 "), true);
  assert.equal(isAnswerCorrect("number", "2.750", "02.75"), true);
  assert.equal(isAnswerCorrect("number", "2.75", "2.7"), false);
  assert.equal(isAnswerCorrect("number", "2.75", "Infinity"), false);
  assert.equal(isAnswerCorrect("number", "9007199254740992.1", "9007199254740992.2"), false);
});

test("integer questions do not accept decimal notation", () => {
  assert.equal(isAnswerCorrect("integer", "3", "3.0"), false);
});

test("choice answers match after trimming whitespace", () => {
  assert.equal(isAnswerCorrect("choice", "Option A", " Option A "), true);
  assert.equal(isAnswerCorrect("choice", "Option A", "option a"), false);
});

test("correct answers extend the streak and a wrong answer resets it", () => {
  assert.equal(nextStreak(3, true), 4);
  assert.equal(nextStreak(3, false), 0);
  assert.equal(nextStreak(0, true), 1);
});

test("admin email matching is case-insensitive and rejects other accounts", () => {
  assert.equal(isAdminEmail("Himanshuraj25102008@gmail.com", "admin@example.com"), false);
  assert.equal(isAdminEmail(" ADMIN@example.com ", "admin@example.com"), true);
  assert.equal(isAdminEmail(undefined, "admin@example.com"), false);
});
