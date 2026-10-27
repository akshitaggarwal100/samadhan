"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { registrationEmail, normalizeRegistrationNumber } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const normalizedRegNo = normalizeRegistrationNumber(regNo);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: registrationEmail(normalizedRegNo),
      password,
    });

    if (authError || !data.user) {
      setError("Invalid Registration Number or Password");
      setIsSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Your account profile is missing. Please contact an administrator.");
      setIsSubmitting(false);
      return;
    }

    router.push(profile.is_admin ? "/admin" : "/user/issues");
    router.refresh();
  };

  return (
    <div className="flex justify-center items-center mt-20">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin}>
          <CardHeader className="mb-4">
            <CardTitle className="text-2xl">Login</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
            <Input
              aria-label="Registration Number"
              type="text"
              placeholder="Registration Number"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              aria-label="Password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}