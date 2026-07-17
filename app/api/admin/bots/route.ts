import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity } from "@/lib/admin-session";
import { DEFAULT_BOT_DISCLOSURE, DEFAULT_BOT_FALLBACK, DEFAULT_BOT_LIBRARY } from "@/lib/bot-response-library";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin } from "@/lib/request-security";

type CreatorRow = {
  creator_user_id: string;
  profile_id: string;
  display_name: string;
  email: string | null;
  enabled: boolean | null;
  disclosure_label: string | null;
  fallback_response: string | null;
};

type RuleRow = {
  id: string;
  creator_user_id: string;
  label: string;
  match_phrases: string[];
  response: string;
  priority: number;
  enabled: boolean;
};

export async function GET(request: NextRequest) {
  if (!adminIdentity(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  try {
    const creators = await query<CreatorRow>(`
      SELECT u.id AS creator_user_id, p.id AS profile_id, p.display_name, u.email,
        settings.enabled, settings.disclosure_label, settings.fallback_response
      FROM users u JOIN profiles p ON p.user_id = u.id
      LEFT JOIN creator_bot_settings settings ON settings.creator_user_id = u.id
      WHERE u.account_type = 'CREATOR' AND u.status = 'ACTIVE'
      ORDER BY p.display_name
    `);
    const creatorIds = creators.rows.map((creator) => creator.creator_user_id);
    const rules = creatorIds.length ? await query<RuleRow>(`
      SELECT id, creator_user_id, label, match_phrases, response, priority, enabled
      FROM creator_bot_rules WHERE creator_user_id = ANY($1::uuid[])
      ORDER BY priority, created_at
    `, [creatorIds]) : { rows: [] as RuleRow[] };
    return NextResponse.json({
      creators: creators.rows.map((creator) => {
        const savedRules = rules.rows.filter((rule) => rule.creator_user_id === creator.creator_user_id);
        return {
          creatorUserId: creator.creator_user_id,
          profileId: creator.profile_id,
          name: creator.display_name,
          email: creator.email,
          enabled: Boolean(creator.enabled),
          disclosureLabel: creator.disclosure_label || DEFAULT_BOT_DISCLOSURE,
          fallbackResponse: creator.fallback_response || DEFAULT_BOT_FALLBACK,
          rules: (savedRules.length ? savedRules : DEFAULT_BOT_LIBRARY).map((rule) => ({
            id: "id" in rule ? rule.id : undefined,
            label: rule.label,
            matchPhrases: "match_phrases" in rule ? rule.match_phrases : rule.matchPhrases,
            response: rule.response,
            priority: rule.priority,
            enabled: rule.enabled !== false
          }))
        };
      })
    });
  } catch (error) {
    console.error("Admin bot settings load failed", error);
    return NextResponse.json({ error: "Automated assistants could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as {
    creatorUserId?: string; enabled?: boolean; disclosureLabel?: string; fallbackResponse?: string;
    rules?: Array<{ label?: string; matchPhrases?: string[]; response?: string; priority?: number; enabled?: boolean }>;
  } | null;
  const creatorUserId = typeof input?.creatorUserId === "string" ? input.creatorUserId : "";
  const disclosureLabel = typeof input?.disclosureLabel === "string" ? input.disclosureLabel.trim().slice(0, 80) : DEFAULT_BOT_DISCLOSURE;
  const fallbackResponse = typeof input?.fallbackResponse === "string" ? input.fallbackResponse.trim().slice(0, 800) : "";
  const rules = Array.isArray(input?.rules) ? input.rules.slice(0, 25).map((rule, index) => ({
    label: String(rule.label || "Rule").trim().slice(0, 80),
    matchPhrases: Array.isArray(rule.matchPhrases) ? rule.matchPhrases.map((phrase) => String(phrase).trim().slice(0, 80)).filter(Boolean).slice(0, 15) : [],
    response: String(rule.response || "").trim().slice(0, 800),
    priority: Number.isFinite(rule.priority) ? Math.max(0, Math.min(10000, Number(rule.priority))) : (index + 1) * 10,
    enabled: rule.enabled !== false
  })) : [];
  if (!creatorUserId || !fallbackResponse || rules.some((rule) => !rule.label || !rule.response || !rule.matchPhrases.length)) {
    return NextResponse.json({ error: "Every enabled response needs a label, trigger phrase, and response." }, { status: 400 });
  }
  try {
    await transaction(async (client) => {
      const creator = await client.query(`SELECT 1 FROM users WHERE id = $1 AND account_type = 'CREATOR'`, [creatorUserId]);
      if (!creator.rowCount) throw new Error("CREATOR_NOT_FOUND");
      await client.query(`
        INSERT INTO creator_bot_settings (creator_user_id, enabled, disclosure_label, fallback_response)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (creator_user_id) DO UPDATE SET enabled = EXCLUDED.enabled,
          disclosure_label = EXCLUDED.disclosure_label, fallback_response = EXCLUDED.fallback_response, updated_at = now()
      `, [creatorUserId, Boolean(input?.enabled), disclosureLabel || DEFAULT_BOT_DISCLOSURE, fallbackResponse]);
      await client.query(`DELETE FROM creator_bot_rules WHERE creator_user_id = $1`, [creatorUserId]);
      for (const rule of rules) {
        await client.query(`
          INSERT INTO creator_bot_rules (id, creator_user_id, label, match_phrases, response, priority, enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [randomUUID(), creatorUserId, rule.label, rule.matchPhrases, rule.response, rule.priority, rule.enabled]);
      }
      await client.query(`
        INSERT INTO admin_bot_audit (id, creator_user_id, actor_email, enabled, rule_count)
        VALUES ($1, $2, $3, $4, $5)
      `, [randomUUID(), creatorUserId, actor, Boolean(input?.enabled), rules.length]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "CREATOR_NOT_FOUND") return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    console.error("Admin bot settings save failed", error);
    return NextResponse.json({ error: "Automated assistant settings could not be saved." }, { status: 503 });
  }
}
