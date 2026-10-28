import { createClient } from "@supabase/supabase-js";

const departments = [
  "Mechanic",
  "Carpenter",
  "Electrical",
  "Civil",
  "Mess",
  "Academic",
] as const;

type Classification = {
  department: (typeof departments)[number];
  departmentConfidence: number;
  duplicateIssueId: string | null;
  duplicateConfidence: number;
};

type CandidateIssue = {
  id: string;
  title: string;
  description: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing server-side Supabase configuration");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseClassification(text: string, candidates: CandidateIssue[]) {
  const jsonText = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const result = JSON.parse(jsonText) as Partial<Classification>;
  const department = departments.includes(result.department as Classification["department"])
    ? result.department as Classification["department"]
    : null;
  const departmentConfidence = Number(result.departmentConfidence);
  const duplicateConfidence = Number(result.duplicateConfidence);
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  if (!department || !Number.isFinite(departmentConfidence) || !Number.isFinite(duplicateConfidence)) {
    throw new Error("AI returned an invalid classification");
  }

  return {
    department,
    departmentConfidence: Math.max(0, Math.min(1, departmentConfidence)),
    duplicateIssueId:
      typeof result.duplicateIssueId === "string" && candidateIds.has(result.duplicateIssueId)
        ? result.duplicateIssueId
        : null,
    duplicateConfidence: Math.max(0, Math.min(1, duplicateConfidence)),
  } satisfies Classification;
}

async function classifyIssue(title: string, description: string, candidates: CandidateIssue[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: `Classify this campus grievance and detect duplicates. Return JSON only, with no markdown.

Allowed departments: ${departments.join(", ")}.
A duplicateIssueId may be selected only when the new report clearly describes the same real-world problem. Use null when uncertain.

Required JSON shape:
{"department":"Electrical","departmentConfidence":0.0,"duplicateIssueId":null,"duplicateConfidence":0.0}

New issue title: ${title}
New issue description: ${description}

Existing active issue candidates:
${JSON.stringify(candidates)}`,
          }],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no classification");
  }

  return parseClassification(text, candidates);
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!accessToken) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: authData, error: authError } = await publicClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json() as {
      issueId?: string;
      title?: string;
      description?: string;
    };
    if (!body.issueId || !body.title || !body.description) {
      return Response.json({ error: "Issue details are required" }, { status: 400 });
    }

    const adminClient = getServiceClient();
    const { data: report, error: reportError } = await adminClient
      .from("issue_reports")
      .select("id")
      .eq("issue_id", body.issueId)
      .eq("student_id", authData.user.id)
      .single();
    if (reportError || !report) {
      return Response.json({ error: "Issue report not found" }, { status: 404 });
    }

    const { data: candidates, error: candidatesError } = await adminClient
      .from("issues")
      .select("id, title, description")
      .neq("id", body.issueId)
      .in("status", ["Filed", "Assigned", "In Review", "Escalated"])
      .order("created_at", { ascending: false })
      .limit(30);
    if (candidatesError) throw candidatesError;

    const classification = await classifyIssue(body.title, body.description, candidates ?? []);
    const duplicateIsConfident = classification.duplicateIssueId !== null
      && classification.duplicateConfidence >= 0.85;

    if (duplicateIsConfident) {
      const { data: existingStudentReport, error: existingReportError } = await adminClient
        .from("issue_reports")
        .select("id")
        .eq("issue_id", classification.duplicateIssueId)
        .eq("student_id", authData.user.id)
        .maybeSingle();
      if (existingReportError) throw existingReportError;

      if (existingStudentReport) {
        const { error: duplicateReportError } = await adminClient
          .from("issue_reports")
          .delete()
          .eq("id", report.id);
        if (duplicateReportError) throw duplicateReportError;

        const { error: duplicateIssueError } = await adminClient
          .from("issues")
          .delete()
          .eq("id", body.issueId);
        if (duplicateIssueError) throw duplicateIssueError;

        return Response.json({ status: "already-linked", issueId: classification.duplicateIssueId });
      }

      const { error: relinkError } = await adminClient
        .from("issue_reports")
        .update({
          issue_id: classification.duplicateIssueId,
          duplicate_confidence: classification.duplicateConfidence,
        })
        .eq("id", report.id);
      if (relinkError) throw relinkError;

      const { error: deleteError } = await adminClient
        .from("issues")
        .delete()
        .eq("id", body.issueId);
      if (deleteError) throw deleteError;

      return Response.json({ status: "linked", issueId: classification.duplicateIssueId });
    }

    const { data: admins, error: adminsError } = await adminClient
      .from("users")
      .select("id")
      .eq("is_admin", true)
      .eq("dept", classification.department);
    if (adminsError) throw adminsError;

    let assignedAdminId: string | null = null;
    let lowestActiveCount = Number.POSITIVE_INFINITY;
    for (const admin of admins ?? []) {
      const { count, error: countError } = await adminClient
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("assigned_admin_id", admin.id)
        .in("status", ["Assigned", "In Review", "Escalated"]);
      if (countError) throw countError;
      if ((count ?? 0) < lowestActiveCount) {
        lowestActiveCount = count ?? 0;
        assignedAdminId = admin.id;
      }
    }

    const nextStatus = assignedAdminId ? "Assigned" : "Filed";
    const { error: updateError } = await adminClient
      .from("issues")
      .update({
        department: classification.department,
        department_confidence: classification.departmentConfidence,
        assigned_admin_id: assignedAdminId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
        status_changed_at: assignedAdminId ? new Date().toISOString() : undefined,
      })
      .eq("id", body.issueId);
    if (updateError) throw updateError;

    if (assignedAdminId) {
      const { error: historyError } = await adminClient
        .from("issue_status_history")
        .insert({
          issue_id: body.issueId,
          from_status: "Filed",
          to_status: "Assigned",
          changed_by: null,
          note: "Automatically classified and assigned by AI",
        });
      if (historyError) throw historyError;

      const { error: notificationError } = await adminClient
        .from("notifications")
        .insert({
          recipient_user_id: assignedAdminId,
          issue_id: body.issueId,
          type: "assignment",
          message: `New issue assigned: "${body.title}".`,
        });
      if (notificationError) throw notificationError;
    }

    return Response.json({ status: nextStatus, department: classification.department });
  } catch (error) {
    console.error("Issue processing failed", error);
    return Response.json({ error: "Issue processing failed" }, { status: 500 });
  }
}
