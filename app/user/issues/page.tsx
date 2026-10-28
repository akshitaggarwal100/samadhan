"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type IssueReport = {
  id: string;
  issue_id: string;
  submitted_title: string;
  submitted_description: string;
  department: string | null;
  status: string;
  action_taken: string | null;
};

type Notification = {
  id: string;
  message: string;
  created_at: string;
};

export default function StudentIssuesPage() {
  const router = useRouter();
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryingReportId, setRetryingReportId] = useState("");
  const [error, setError] = useState("");

  async function loadReports() {
    setIsRefreshing(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/");
      return;
    }

    const { data: reportData, error: reportsError } = await supabase
      .from("issue_reports")
      .select("id, issue_id, submitted_title, submitted_description")
      .eq("student_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (reportsError) {
      setError(reportsError.message);
    } else {
      const reports = reportData ?? [];
      const issueIds = reports.map((report) => report.issue_id);
      const { data: issueData, error: issuesError } = issueIds.length
        ? await supabase.from("issues").select("id, department, status, action_taken").in("id", issueIds)
        : { data: [], error: null };

      if (issuesError) {
        setError(issuesError.message);
      } else {
        const issuesById = new Map((issueData ?? []).map((issue) => [issue.id, issue]));
        setReports(reports.map((report) => ({
          ...report,
          department: issuesById.get(report.issue_id)?.department ?? null,
          status: issuesById.get(report.issue_id)?.status ?? "Filed",
          action_taken: issuesById.get(report.issue_id)?.action_taken ?? null,
        })) as IssueReport[]);
      }
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadReports();
    }, 0);

    let channel: ReturnType<typeof supabase.channel> | undefined;
    void supabase.auth.getUser().then(({ data: userData }) => {
      if (!userData.user) return;
      channel = supabase
        .channel(`student-notifications-${userData.user.id}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${userData.user.id}`,
          },
          (payload) => {
            const notification = payload.new as Notification;
            setNotifications((current) => [
              notification,
              ...current.filter((item) => item.id !== notification.id),
            ].slice(0, 5));
            void loadReports();
          }
        )
        .subscribe();
      });

    return () => {
      window.clearTimeout(initialLoad);
      if (channel) void supabase.removeChannel(channel);
    };
    // The notification channel refreshes the dashboard; the button is a manual fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function retryClassification(report: IssueReport) {
    setError("");
    setRetryingReportId(report.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/issues/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        issueId: report.issue_id,
        title: report.submitted_title,
        description: report.submitted_description,
      }),
    });

    if (!response.ok) {
      setError("Automatic classification is still unavailable. Please try again later.");
    } else {
      await loadReports();
    }
    setRetryingReportId("");
  }

  return (
    <div className="mx-auto mt-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Student dashboard</p>
          <h1 className="text-2xl font-semibold">Your issues</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isRefreshing} onClick={() => void loadReports()}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button onClick={() => router.push("/user/add")}>Add issue</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your submitted issues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground">Loading issues...</p>}
          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          {!isLoading && !error && reports.length === 0 && (
            <p className="text-muted-foreground">You have not submitted an issue yet.</p>
          )}
          {!isLoading && !error && reports.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action taken</TableHead>
                  <TableHead> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.submitted_title}</TableCell>
                    <TableCell className="whitespace-normal">{report.submitted_description}</TableCell>
                    <TableCell>{report.status}</TableCell>
                    <TableCell className="whitespace-normal">{report.action_taken ?? "-"}</TableCell>
                    <TableCell>
                      {report.status === "Filed" && !report.department && (
                        <Button
                          variant="outline"
                          disabled={retryingReportId === report.id}
                          onClick={() => void retryClassification(report)}
                        >
                          {retryingReportId === report.id ? "Retrying..." : "Retry AI"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {notifications.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {notifications.map((notification) => (
              <p key={notification.id} className="text-sm">{notification.message}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
