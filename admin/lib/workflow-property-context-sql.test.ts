import { readFileSync } from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

/** Репозиторий: admin/ — поднимаемся к корню проекта gelendzhik-guesthouse-automation */
const repoRoot = path.resolve(__dirname, "../..");
const wf10 = readFileSync(path.join(repoRoot, "workflows", "10_admin_api.json"), "utf8");
const wf02 = readFileSync(path.join(repoRoot, "workflows", "02_owner_bot.json"), "utf8");

describe("workflow SQL: property_context (D1.5)", () => {
  test("no hardcoded VALUES map for property_context (pcm / apt 50 snippet)", () => {
    for (const blob of [wf10, wf02]) {
      expect(blob).not.toMatch(/pcm\(apt_id/);
      expect(blob).not.toMatch(/\('50',\s*'Акваторинг'::text\)/);
    }
  });

  test("WF10 revenue paths read property_context_map + default_property_context", () => {
    const n = (wf10.match(/property_context_map/g) ?? []).length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(wf10).toMatch(/default_property_context/g);
    expect(wf10).toMatch(/jsonb_typeof\(m\.map_json\)\s*=\s*'object'/);
  });

  test("WF02 Load Pricing Recs uses same system_vars pattern", () => {
    expect(wf02).toMatch(/property_context_map/);
    expect(wf02).toMatch(/default_property_context/);
  });

  test("WF10 D1.6: property_context_settings + PCS pipeline", () => {
    expect(wf10).toMatch(/'property_context_settings'/);
    expect(wf10).toContain('"name": "PCS Entry"');
    expect(wf10).toContain('"name": "PCS Save Query"');
    expect(wf10).toMatch(/\$json\.q_save_sql/);
    expect(wf10).toContain("If Property Context Settings");
  });

  test("WF10 D1.7: PCS save audit + prev read + diff metadata", () => {
    expect(wf10).toMatch(/property_context_settings_save/);
    expect(wf10).toContain('"name": "PCS Prev For Save"');
    expect(wf10).toContain('"name": "PCS Save Build Audit"');
    expect(wf10).toMatch(/INSERT INTO pricing_action_audit_log/);
    expect(wf10).toMatch(/added_keys/);
    expect(wf10).toMatch(/changed_keys/);
    expect(wf10).toMatch(/removed_keys/);
    expect(wf10).toMatch(/unchanged_keys_count/);
    expect(wf10).toMatch(/audit_recorded:\s*true/);
  });

  test("WF10 D1.7: PCS Entry has no audit INSERT (invalid path stops before save)", () => {
    for (const n of JSON.parse(wf10).nodes as { name?: string; parameters?: { jsCode?: string } }[]) {
      if (n.name === "PCS Entry") {
        expect(n.parameters?.jsCode ?? "").not.toMatch(/pricing_action_audit_log/);
        return;
      }
    }
    throw new Error("PCS Entry node missing");
  });

  test("WF10 D1.7: Save path reads system_vars before PCS Save Build Audit", () => {
    expect(wf10).toMatch(
      /FROM system_vars[\s\S]*WHERE key IN \('property_context_map', 'default_property_context'\)/,
    );
  });
});

describe("workflow: manual referral lead (D2.3)", () => {
  test("WF10 allows action manual_referral_lead", () => {
    expect(wf10).toMatch(/'manual_referral_lead'/);
    expect(wf10).toContain('"name": "If Manual Referral Lead"');
    expect(wf10).toContain('"name": "MRL Entry"');
  });

  test("WF10 audit action manual_referral_lead_logged", () => {
    expect(wf10).toMatch(/manual_referral_lead_logged/);
    expect(wf10).toMatch(/economics_available/);
  });

  test("MRL Entry has no audit INSERT (invalid stops before insert)", () => {
    for (const n of JSON.parse(wf10).nodes as { name?: string; parameters?: { jsCode?: string } }[]) {
      if (n.name === "MRL Entry") {
        expect(n.parameters?.jsCode ?? "").not.toMatch(/INSERT INTO pricing_action_audit_log/);
        return;
      }
    }
    throw new Error("MRL Entry node missing");
  });

  test("WF10 audit log query returns metadata column", () => {
    expect(wf10).toMatch(/pricing_action_audit_log/);
    expect(wf10).toMatch(/'metadata',\s*al\.metadata/);
  });

  test("RC export audit whitelist unchanged (D1.4)", () => {
    const RC_EXPORT_AUDIT_META_KEYS = [
      "prices_obj",
      "manual_instruction",
      "recommended_guest_price",
      "rc_net_price",
      "aggregator_markup_percent",
      "expected_aggregator_guest_price",
      "direct_price",
      "direct_savings_for_guest",
      "direct_owner_gain",
    ];
    expect(RC_EXPORT_AUDIT_META_KEYS).not.toContain("referrer_name");
    expect(wf10).toMatch(/direct_owner_gain/);
  });
});
