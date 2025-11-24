import { expect, test, describe } from "bun:test";

describe("2 + 2", () => {
  test("should be 4", () => {
    expect(2 + 2).toBe(4);
  });
  test("should not be 5", () => {
    expect(2 + 2).not.toBe(5);
  });
});
