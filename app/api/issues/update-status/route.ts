import { createClient } from "@supabase/supabase-js";

const allowedTransitions = {
  "In Review": "Assigned",
  Resolved: "In Review",
} as const;

type TargetStatus = keyof typeof allowedTransitions;

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
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!accessToken) return Response.json({ error: "Authentication required" }, { status: 401 });

    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: authData, error: authError } = await publicClient.auth.getUser(accessToken);
    if (authError || !authData.user) return Response.json({ error: "Invalid session" }, { status: 401 });

    const body = await request.json() as {
      issueId?: string;
      status?: TargetStatus;
      actionTaken?: string;
    };
    if (!body.issueId || !body.status || !(body.status in allowedTransitions)) {
      return Response.json({ error: "Invalid status update" }, { status: 400 });
    }
    if (body.status === "Resolved" && !body.actionTaken?.trim()) {
      return Response.json({ error: "Action taken is required to resolve an issue" }, { status: 400 });
    }

    const adminClient = getServiceClient();
    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("is_admin, dept")
      .eq("id", authData.user.id)
      .single();
    if (profileError || !profile?.is_admin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: issue, error: issueError } = await adminClient
      .from("issues")
      .select("id, title, status, assigned_admin_id, department")
      .eq("id", body.issueId)
      .single();
    if (issueError || !issue) return Response.json({ error: "Issue not found" }, { status: 404 });

    const isAssignedAdmin = issue.assigned_admin_id === authData.user.id;
    const isSeniorEscalationAdmin = profile.dept === "senior" && issue.status === "Escalated";
    if (!isAssignedAdmin && !isSeniorEscalationAdmin) {
      return Response.json({ error: "This issue is not assigned to you" }, { status: 403 });
    }
    if (issue.status !== allowedTransitions[body.status]) {
      return Response.json({ error: `Issue must be ${allowedTransitions[body.status]} first` }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("issues")
      .update({
        status: body.status,
        action_taken: body.status === "Resolved" ? body.actionTaken!.trim() : null,
        updated_at: now,
        status_changed_at: now,
      })
      .eq("id", body.issueId);
    if (updateError) throw updateError;

    const { error: historyError } = await adminClient
      .from("issue_status_history")
      .insert({
        issue_id: body.issueId,
        from_status: issue.status,
        to_status: body.status,
        changed_by: authData.user.id,
        note: body.status === "Resolved" ? body.actionTaken!.trim() : null,
      });
    if (historyError) throw historyError;

    const { data: reports, error: reportsError } = await adminClient
      .from("issue_reports")
      .select("student_id")
      .eq("issue_id", body.issueId);
    if (reportsError) throw reportsError;

    const recipientIds = Array.from(new Set([
      ...(reports ?? []).map((report) => report.student_id),
      authData.user.id,
    ]));
    const { error: notificationError } = await adminClient
      .from("notifications")
      .insert(recipientIds.map((recipientId) => ({
        recipient_user_id: recipientId,
        issue_id: body.issueId,
        type: "status_update",
        message: `Issue "${issue.title}" is now ${body.status}.`,
      })));
    if (notificationError) throw notificationError;

    return Response.json({ status: body.status });
  } catch (error) {
    console.error("Status update failed", error);
    return Response.json({ error: "Status update failed" }, { status: 500 });
  }
}
