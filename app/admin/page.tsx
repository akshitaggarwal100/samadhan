"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AdminIssue = {
  id: string;
  title: string;
  description: string;
  department: string | null;
  status: string;
  action_taken: string | null;
  created_at: string;
  issue_reports: { count: number }[];
};

export default function AdminPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [actionTaken, setActionTaken] = useState<Record<string, string>>({});
  const [loadingIssue, setLoadingIssue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadIssues() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/");
      return;
    }

    const { data, error: issuesError } = await supabase
      .from("issues")
      .select("id, title, description, department, status, action_taken, created_at, issue_reports(count)")
      .eq("assigned_admin_id", userData.user.id)
      .in("status", ["Assigned", "In Review", "Escalated"])
      .order("created_at", { ascending: false });

    if (issuesError) setError(issuesError.message);
    else setIssues((data ?? []) as AdminIssue[]);
    setIsLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadIssues();
    }, 0);

    let channel: ReturnType<typeof supabase.channel> | undefined;
    void supabase.auth.getUser().then(({ data: userData }) => {
      if (!userData.user) return;
      channel = supabase
        .channel(`admin-notifications-${userData.user.id}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${userData.user.id}`,
          },
          () => {
            void loadIssues();
          }
        )
        .subscribe();
    });

    return () => {
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
    // The initial load should run once; status updates call loadIssues directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(issue: AdminIssue, status: "In Review" | "Resolved") {
    setError("");
    setLoadingIssue(issue.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/issues/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        issueId: issue.id,
        status,
        actionTaken: actionTaken[issue.id] ?? "",
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Could not update the issue.");
    } else {
      await loadIssues();
    }
    setLoadingIssue("");
  }

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin dashboard</p>
        <h1 className="text-2xl font-semibold">Assigned issues</h1>
      </div>
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      {isLoading && <p className="text-muted-foreground">Loading assigned issues...</p>}
      {!isLoading && !error && issues.length === 0 && (
        <Card><CardContent className="pt-6">No assigned issues.</CardContent></Card>
      )}
      <div className="grid gap-4">
        {issues.map((issue) => (
          <Card key={issue.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{issue.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {issue.department ?? "Unclassified"} · {issue.issue_reports[0]?.count ?? 0} report(s)
                  </p>
                </div>
                <span className="text-sm font-medium">{issue.status}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{issue.description}</p>
              {issue.status === "Assigned" && (
                <Button disabled={loadingIssue === issue.id} onClick={() => updateStatus(issue, "In Review")}>
                  {loadingIssue === issue.id ? "Updating..." : "Start review"}
                </Button>
              )}
              {issue.status === "In Review" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium" htmlFor={`action-${issue.id}`}>
                      Action taken
                    </label>
                    <Input
                      id={`action-${issue.id}`}
                      value={actionTaken[issue.id] ?? ""}
                      onChange={(event) => setActionTaken((current) => ({ ...current, [issue.id]: event.target.value }))}
                      placeholder="Describe the repair or action taken"
                    />
                  </div>
                  <Button disabled={loadingIssue === issue.id} onClick={() => updateStatus(issue, "Resolved")}>
                    {loadingIssue === issue.id ? "Resolving..." : "Resolve"}
                  </Button>
                </div>
              )}
              {issue.status === "Escalated" && (
                <p className="text-sm text-red-500">This issue requires senior-admin attention.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
