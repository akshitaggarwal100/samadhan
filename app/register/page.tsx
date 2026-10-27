"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeRegistrationNumber, registrationEmail } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [regNo, setRegNo] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        const normalizedRegNo = normalizeRegistrationNumber(regNo);
        const { data, error: authError } = await supabase.auth.signUp({
            email: registrationEmail(normalizedRegNo),
            password,
        });

        if (authError || !data.user) {
            setError(authError?.message ?? "Could not create your account.");
            setIsSubmitting(false);
            return;
        }

        if (!data.session) {
            setError("Account created, but no session was returned. Check that email confirmation is disabled in Supabase Auth.");
            setIsSubmitting(false);
            return;
        }

        const { error: profileError } = await supabase.from("users").insert({
            id: data.user.id,
            name: name.trim(),
            reg_no: normalizedRegNo,
            is_admin: false,
            dept: null,
        });

        if (profileError) {
            setError(`Your Auth account was created, but its profile could not be saved: ${profileError.message}`);
            setIsSubmitting(false);
            return;
        }

        router.push("/user/issues");
        router.refresh();
    };

    return (
        <div className="flex justify-center items-center mt-20">
            <Card className="w-[400px]">
                <form onSubmit={handleRegister}>
                  <CardHeader>
                    <CardTitle className="text-center text-2xl">Create Account</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
                    <Input
                      aria-label="Full Name"
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      autoComplete="name"
                    />
                    <Input
                      aria-label="Registration Number"
                      type="text"
                      placeholder="Registration Number"
                      value={regNo}
                      onChange={(event) => setRegNo(event.target.value)}
                      required
                      autoComplete="username"
                    />
                    <Input
                      aria-label="Create Password"
                      type="password"
                      placeholder="Create Password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Creating account..." : "Register"}
                    </Button>
                  </CardContent>
                </form>
            </Card>
        </div>
    );
}