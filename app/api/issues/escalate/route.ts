import { createClient } from "@supabase/supabase-js";

const activeStatuses = ["Filed", "Assigned", "In Review"] as const;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing server-side Supabase configuration");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    const providedSecret = request.headers.get("x-cron-secret")
      ?? (authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null);
    if (!cronSecret || providedSecret !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getServiceClient();
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: overdueIssues, error: issuesError } = await adminClient
      .from("issues")
      .select("id, title, status, assigned_admin_id")
      .in("status", activeStatuses)
      .lt("status_changed_at", cutoff);
    if (issuesError) throw issuesError;

    const { data: seniorAdmins, error: seniorError } = await adminClient
      .from("users")
      .select("id")
      .eq("is_admin", true)
      .eq("dept", "senior");
    if (seniorError) throw seniorError;

    let escalatedCount = 0;
    for (const issue of overdueIssues ?? []) {
      const now = new Date().toISOString();
      const { error: updateError } = await adminClient
        .from("issues")
        .update({
          status: "Escalated",
          escalated_at: now,
          updated_at: now,
          status_changed_at: now,
        })
        .eq("id", issue.id)
        .eq("status", issue.status);
      if (updateError) throw updateError;

      const { error: historyError } = await adminClient
        .from("issue_status_history")
        .insert({
          issue_id: issue.id,
          from_status: issue.status,
          to_status: "Escalated",
          changed_by: null,
          note: "Automatically escalated after 48 hours without a status change",
        });
      if (historyError) throw historyError;

      const { data: reports, error: reportsError } = await adminClient
        .from("issue_reports")
        .select("student_id")
        .eq("issue_id", issue.id);
      if (reportsError) throw reportsError;

      const recipientIds = Array.from(new Set([
        issue.assigned_admin_id,
        ...(reports ?? []).map((report) => report.student_id),
        ...(seniorAdmins ?? []).map((admin) => admin.id),
      ].filter((id): id is string => Boolean(id))));

      if (recipientIds.length > 0) {
        const { error: notificationError } = await adminClient
          .from("notifications")
          .insert(recipientIds.map((recipientId) => ({
            recipient_user_id: recipientId,
            issue_id: issue.id,
            type: "escalation",
            message: `Issue "${issue.title}" has been escalated after 48 hours.`,
          })));
        if (notificationError) throw notificationError;
      }

      escalatedCount += 1;
    }

    return Response.json({ escalatedCount });
  } catch (error) {
    console.error("Escalation failed", error);
    return Response.json({ error: "Escalation failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
