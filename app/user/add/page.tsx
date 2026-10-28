"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AddIssuePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/");
      return;
    }

    const issueId = crypto.randomUUID();
    const { error: issueError } = await supabase
      .from("issues")
      .insert({
        id: issueId,
        title: title.trim(),
        description: description.trim(),
        status: "Filed",
        department: null,
        assigned_admin_id: null,
        escalated_at: null,
      })

    if (issueError) {
      setError(issueError?.message ?? "Could not create the issue.");
      setIsSubmitting(false);
      return;
    }

    const { error: reportError } = await supabase.from("issue_reports").insert({
      issue_id: issueId,
      student_id: userData.user.id,
      submitted_title: title.trim(),
      submitted_description: description.trim(),
    });

    if (reportError) {
      setError(reportError.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/user/issues");
    router.refresh();
  };

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>File a new grievance</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
            <Input
              aria-label="Issue title"
              placeholder="Issue title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={160}
            />
            <textarea
              aria-label="Issue description"
              className="min-h-32 rounded-md border border-input bg-input/20 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Describe the issue and where it is happening"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              maxLength={2000}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit issue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
