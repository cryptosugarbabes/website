import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminIdentity, isAdminRequest } from "@/lib/admin-session";
import { query, transaction } from "@/lib/db";
import { requestHasTrustedOrigin } from "@/lib/request-security";
import { acceptanceComplete, type AcceptanceRecord } from "@/lib/legal-acceptance";
import { reportApplicationError } from "@/lib/observability";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  try {
    const [metrics, accounts, payments, audit, funnel, errors] = await Promise.all([
      query<{
        accounts: string; creators: string; customers: string; pending_profiles: string;
        open_reports: string; confirmed_payments: string; gross_usdc: string;
        creator_usdc: string; platform_usdc: string; deletion_requests: string;
      }>(`
        SELECT
          (SELECT count(*) FROM users)::text AS accounts,
          (SELECT count(*) FROM users WHERE account_type = 'CREATOR')::text AS creators,
          (SELECT count(*) FROM users WHERE account_type = 'CUSTOMER')::text AS customers,
          (SELECT count(*) FROM profiles WHERE review_status = 'PENDING_REVIEW')::text AS pending_profiles,
          (SELECT count(*) FROM safety_reports WHERE status IN ('OPEN', 'REVIEWING'))::text AS open_reports,
          (SELECT count(*) FROM support_events)::text AS confirmed_payments,
          COALESCE((SELECT sum(q.gross_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id), 0)::text AS gross_usdc,
          COALESCE((SELECT sum(q.creator_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id), 0)::text AS creator_usdc,
          COALESCE((SELECT sum(q.platform_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id), 0)::text AS platform_usdc,
          (SELECT count(*) FROM users WHERE deletion_requested_at IS NOT NULL)::text AS deletion_requests
      `),
      query<AcceptanceRecord & {
        id: string; email: string | null; wallet_address: string | null; wallet_chain: string | null;
        account_type: string | null; status: string; suspension_reason: string | null;
        deletion_requested_at: Date | null; created_at: Date; display_name: string | null;
        profile_status: string | null; conversations: string; messages: string;
        support_sent: string; creator_earned: string;
      }>(`
        SELECT u.id, u.email, u.wallet_address, u.wallet_chain, u.account_type, u.status,
          u.adult_attested_at, u.terms_accepted_at, u.terms_version,
          u.privacy_accepted_at, u.privacy_version,
          u.suspension_reason, u.deletion_requested_at, u.created_at,
          COALESCE(p.display_name, cp.display_name) AS display_name,
          p.review_status AS profile_status,
          (SELECT count(*) FROM conversations c WHERE c.customer_user_id = u.id OR c.creator_profile_id = p.id)::text AS conversations,
          (SELECT count(*) FROM messages m WHERE m.sender_user_id = u.id)::text AS messages,
          COALESCE((SELECT sum(q.gross_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id WHERE se.supporter_user_id = u.id), 0)::text AS support_sent,
          COALESCE((SELECT sum(q.creator_amount_usdc) FROM support_events se JOIN payment_quotes q ON q.id = se.quote_id WHERE se.creator_profile_id = p.id), 0)::text AS creator_earned
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        ORDER BY (u.deletion_requested_at IS NOT NULL) DESC, (u.status = 'SUSPENDED') DESC, u.created_at DESC
        LIMIT 500
      `),
      query<{
        id: string; kind: string; network: string; gross: string; creator_share: string;
        platform_share: string; created_at: Date; profile_name: string; supporter: string;
        hashes: string[];
      }>(`
        SELECT se.id, se.kind, q.network, q.gross_amount_usdc::text AS gross,
          q.creator_amount_usdc::text AS creator_share, q.platform_amount_usdc::text AS platform_share,
          se.created_at, p.display_name AS profile_name,
          COALESCE(buyer.email, buyer.wallet_address, 'Private account') AS supporter,
          COALESCE(array_agg(pt.transaction_hash ORDER BY pt.purpose) FILTER (WHERE pt.transaction_hash IS NOT NULL), '{}') AS hashes
        FROM support_events se
        JOIN payment_quotes q ON q.id = se.quote_id
        JOIN profiles p ON p.id = se.creator_profile_id
        JOIN users buyer ON buyer.id = se.supporter_user_id
        LEFT JOIN payment_transactions pt ON pt.quote_id = q.id
        GROUP BY se.id, q.id, p.id, buyer.id
        ORDER BY se.created_at DESC LIMIT 250
      `),
      query<{ id: string; action: string; note: string | null; created_at: Date; display_name: string | null; email: string | null; actor_email: string | null }>(`
        SELECT a.id, a.action, a.note, a.created_at, a.actor_email, COALESCE(p.display_name, cp.display_name) AS display_name, u.email
        FROM admin_user_audit a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        ORDER BY a.created_at DESC LIMIT 200
      `),
      query<{
        page_views: string; sign_in_opens: string; email_code_requests: string;
        email_verifications: string; roles_chosen: string; profiles_submitted: string;
        conversations_started: string; messages_sent: string; payments_started: string;
        payments_confirmed: string;
      }>(`
        SELECT
          (SELECT count(*) FROM product_events WHERE event_name = 'PAGE_VIEW' AND created_at >= now() - interval '30 days')::text AS page_views,
          (SELECT count(*) FROM product_events WHERE event_name = 'SIGN_IN_OPENED' AND created_at >= now() - interval '30 days')::text AS sign_in_opens,
          (SELECT count(*) FROM email_auth_challenges WHERE created_at >= now() - interval '30 days')::text AS email_code_requests,
          (SELECT count(*) FROM users WHERE email_verified_at >= now() - interval '30 days')::text AS email_verifications,
          (SELECT count(*) FROM users WHERE adult_attested_at >= now() - interval '30 days')::text AS roles_chosen,
          (SELECT count(*) FROM profiles WHERE created_at >= now() - interval '30 days')::text AS profiles_submitted,
          (SELECT count(*) FROM conversations WHERE created_at >= now() - interval '30 days')::text AS conversations_started,
          (SELECT count(*) FROM messages WHERE created_at >= now() - interval '30 days')::text AS messages_sent,
          (SELECT count(*) FROM payment_quotes WHERE created_at >= now() - interval '30 days')::text AS payments_started,
          ((SELECT count(*) FROM support_events WHERE created_at >= now() - interval '30 days')
            + (SELECT count(*) FROM message_unlocks WHERE created_at >= now() - interval '30 days'))::text AS payments_confirmed
      `),
      query<{ id: string; scope: string; message: string; occurrences: string; first_seen_at: Date; last_seen_at: Date }>(`
        SELECT id, scope, message, occurrences::text, first_seen_at, last_seen_at
        FROM application_errors
        WHERE last_seen_at >= now() - interval '30 days'
        ORDER BY last_seen_at DESC
        LIMIT 20
      `)
    ]);
    const summary = metrics.rows[0];
    const funnelSummary = funnel.rows[0];
    return NextResponse.json({
      metrics: {
        accounts: Number(summary.accounts), creators: Number(summary.creators), customers: Number(summary.customers),
        pendingProfiles: Number(summary.pending_profiles), openReports: Number(summary.open_reports),
        confirmedPayments: Number(summary.confirmed_payments), grossUsdc: Number(summary.gross_usdc),
        creatorUsdc: Number(summary.creator_usdc), platformUsdc: Number(summary.platform_usdc),
        deletionRequests: Number(summary.deletion_requests)
      },
      accounts: accounts.rows.map((item) => ({
        id: item.id, email: item.email, walletAddress: item.wallet_address, walletChain: item.wallet_chain,
        type: item.account_type, status: item.status, suspensionReason: item.suspension_reason,
        deletionRequestedAt: item.deletion_requested_at, createdAt: item.created_at,
        displayName: item.display_name, profileStatus: item.profile_status,
        acceptanceComplete: acceptanceComplete(item),
        adultAttestedAt: item.adult_attested_at,
        termsAcceptedAt: item.terms_accepted_at,
        privacyAcceptedAt: item.privacy_accepted_at,
        conversations: Number(item.conversations), messages: Number(item.messages),
        supportSentUsdc: Number(item.support_sent), creatorEarnedUsdc: Number(item.creator_earned)
      })),
      payments: payments.rows.map((item) => ({
        id: item.id, kind: item.kind, network: item.network, grossUsdc: Number(item.gross),
        creatorShareUsdc: Number(item.creator_share), platformShareUsdc: Number(item.platform_share),
        createdAt: item.created_at, profileName: item.profile_name, supporter: item.supporter,
        transactionHashes: item.hashes
      })),
      audit: audit.rows.map((item) => ({
        id: item.id, action: item.action, note: item.note, createdAt: item.created_at,
        displayName: item.display_name, email: item.email, actorEmail: item.actor_email
      })),
      funnel: {
        days: 30,
        pageViews: Number(funnelSummary.page_views), signInOpens: Number(funnelSummary.sign_in_opens),
        emailCodeRequests: Number(funnelSummary.email_code_requests), emailVerifications: Number(funnelSummary.email_verifications),
        rolesChosen: Number(funnelSummary.roles_chosen), profilesSubmitted: Number(funnelSummary.profiles_submitted),
        conversationsStarted: Number(funnelSummary.conversations_started), messagesSent: Number(funnelSummary.messages_sent),
        paymentsStarted: Number(funnelSummary.payments_started), paymentsConfirmed: Number(funnelSummary.payments_confirmed)
      },
      recentErrors: errors.rows.map((item) => ({
        id: item.id, scope: item.scope, message: item.message, occurrences: Number(item.occurrences),
        firstSeenAt: item.first_seen_at, lastSeenAt: item.last_seen_at
      }))
    });
  } catch (error) {
    await reportApplicationError("admin:operations-load", error);
    console.error("Admin operations load failed", error);
    return NextResponse.json({ error: "Operations data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = adminIdentity(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (!requestHasTrustedOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const input = await request.json().catch(() => null) as { userId?: string; action?: string; note?: string } | null;
  const action = String(input?.action || "");
  const note = String(input?.note || "").trim().slice(0, 1000);
  if (!input?.userId || !["SUSPEND", "RESTORE", "CLEAR_DELETION_REQUEST"].includes(action)) {
    return NextResponse.json({ error: "Choose an account and valid action." }, { status: 400 });
  }
  if (action === "SUSPEND" && note.length < 3) return NextResponse.json({ error: "Add a suspension reason." }, { status: 400 });

  const updated = await transaction(async (client) => {
    const result = action === "CLEAR_DELETION_REQUEST"
      ? await client.query(`UPDATE users SET deletion_requested_at = NULL, updated_at = now() WHERE id = $1 RETURNING id`, [input.userId])
      : await client.query(`
          UPDATE users SET status = $2, suspended_at = CASE WHEN $2 = 'SUSPENDED' THEN now() ELSE NULL END,
            suspension_reason = CASE WHEN $2 = 'SUSPENDED' THEN $3 ELSE NULL END, updated_at = now()
          WHERE id = $1 RETURNING id
        `, [input.userId, action === "SUSPEND" ? "SUSPENDED" : "ACTIVE", note || null]);
    if (!result.rowCount) return false;
    await client.query(`INSERT INTO admin_user_audit (id, user_id, action, note, actor_email) VALUES ($1, $2, $3, $4, $5)`, [
      randomUUID(), input.userId, action === "CLEAR_DELETION_REQUEST" ? "CLEAR_DELETION_REQUEST" : action, note || null, actor
    ]);
    return true;
  });
  if (!updated) return NextResponse.json({ error: "That account was not found." }, { status: 404 });
  return NextResponse.json({ updated: true });
}
