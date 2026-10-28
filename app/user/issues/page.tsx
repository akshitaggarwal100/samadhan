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
  submitted_title: string;
  submitted_description: string;
  issue: {
    status: string;
    action_taken: string | null;
  }[];
};

export default function StudentIssuesPage() {
  const router = useRouter();
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/");
        return;
      }

      const { data, error: reportsError } = await supabase
        .from("issue_reports")
        .select("id, submitted_title, submitted_description, issue:issues(status, action_taken)")
        .eq("student_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (reportsError) {
        setError(reportsError.message);
      } else {
        setReports((data ?? []) as IssueReport[]);
      }
      setIsLoading(false);
    }

    void loadReports();
  }, [router]);

  return (
    <div className="mx-auto mt-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Student dashboard</p>
          <h1 className="text-2xl font-semibold">Your issues</h1>
        </div>
        <Button onClick={() => router.push("/user/add")}>Add issue</Button>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.submitted_title}</TableCell>
                    <TableCell className="whitespace-normal">{report.submitted_description}</TableCell>
                    <TableCell>{report.issue[0]?.status ?? "Filed"}</TableCell>
                    <TableCell className="whitespace-normal">{report.issue[0]?.action_taken ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
