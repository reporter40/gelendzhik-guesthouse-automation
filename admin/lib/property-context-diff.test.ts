import { describe, expect, test } from "vitest";
import { computePropertyContextMapDiff } from "@/lib/property-context-diff";

describe("computePropertyContextMapDiff", () => {
  test("added key", () => {
    const d = computePropertyContextMapDiff({}, { "50": "A" });
    expect(d.added_keys).toEqual(["50"]);
    expect(d.removed_keys).toEqual([]);
    expect(d.changed_keys).toEqual([]);
    expect(d.previous_size).toBe(0);
    expect(d.next_size).toBe(1);
  });

  test("removed key", () => {
    const d = computePropertyContextMapDiff({ "50": "A", "40": "B" }, { "50": "A" });
    expect(d.removed_keys).toEqual(["40"]);
    expect(d.added_keys).toEqual([]);
    expect(d.changed_keys).toEqual([]);
  });

  test("changed key", () => {
    const d = computePropertyContextMapDiff({ "50": "A" }, { "50": "B" });
    expect(d.changed_keys).toEqual(["50"]);
    expect(d.added_keys).toEqual([]);
    expect(d.removed_keys).toEqual([]);
    expect(d.unchanged_keys_count).toBe(0);
  });

  test("same map → empty structural diff", () => {
    const d = computePropertyContextMapDiff({ b: "2", a: "1" }, { a: "1", b: "2" });
    expect(d.added_keys).toEqual([]);
    expect(d.removed_keys).toEqual([]);
    expect(d.changed_keys).toEqual([]);
    expect(d.unchanged_keys_count).toBe(2);
  });

  test("key order ignored for unchanged", () => {
    const d = computePropertyContextMapDiff({ x: "1", y: "2" }, { y: "2", x: "1" });
    expect(d).toMatchObject({
      added_keys: [],
      removed_keys: [],
      changed_keys: [],
      unchanged_keys_count: 2,
    });
  });
});
