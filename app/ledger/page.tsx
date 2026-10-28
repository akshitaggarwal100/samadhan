"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LedgerIssue = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  department: string | null;
  status: string;
  report_count: number;
};

export default function LedgerPage() {
  const [issues, setIssues] = useState<LedgerIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLedger() {
      const { data, error: ledgerError } = await supabase
        .from("public_ledger")
        .select("id, created_at, title, description, department, status, report_count")
        .order("created_at", { ascending: false });

      if (ledgerError) {
        setError(ledgerError.message);
      } else {
        setIssues((data ?? []) as LedgerIssue[]);
      }
      setIsLoading(false);
    }

    void loadLedger();
  }, []);

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Public Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground">Loading public issues...</p>}
          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          {!isLoading && !error && issues.length === 0 && (
            <p className="text-muted-foreground">No issues have been posted yet.</p>
          )}
          {!isLoading && !error && issues.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Reports</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>{new Date(issue.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{issue.title}</TableCell>
                    <TableCell className="whitespace-normal">{issue.description}</TableCell>
                    <TableCell>{issue.department ?? "Pending"}</TableCell>
                    <TableCell>{issue.report_count}</TableCell>
                    <TableCell>{issue.status}</TableCell>
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
