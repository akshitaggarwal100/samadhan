"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isReady, setIsReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    async function syncAuthState() {
        const { data: userData } = await supabase.auth.getUser();
        setIsAuthenticated(Boolean(userData.user));

        if (!userData.user) {
            setIsAdmin(false);
            setIsReady(true);
            return;
        }

        const { data: profile } = await supabase
            .from("users")
            .select("is_admin")
            .eq("id", userData.user.id)
            .maybeSingle();
        setIsAdmin(Boolean(profile?.is_admin));
        setIsReady(true);
    }

    useEffect(() => {
        const initialSync = window.setTimeout(() => {
            void syncAuthState();
        }, 0);
        const { data: authListener } = supabase.auth.onAuthStateChange(() => {
            void syncAuthState();
        });

        return () => {
            window.clearTimeout(initialSync);
            authListener.subscription.unsubscribe();
        };
    }, []);

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
    }

    const dashboardPath = isAdmin ? "/admin" : "/user/issues";

    return (
        <div className="relative mb-8 flex min-h-14 w-full items-center justify-center border-b p-4">
            {isReady && (
                <Tabs value={pathname} onValueChange={(value) => router.push(value)}>
                    <TabsList>
                        {isAuthenticated ? (
                            <>
                                <TabsTrigger value={dashboardPath}>
                                    {isAdmin ? "Assigned Issues" : "Your Issues"}
                                </TabsTrigger>
                                <TabsTrigger value="/ledger">Public Ledger</TabsTrigger>
                            </>
                        ) : (
                            <>
                                <TabsTrigger value="/">Login</TabsTrigger>
                                <TabsTrigger value="/register">Register</TabsTrigger>
                                <TabsTrigger value="/ledger">Public Ledger</TabsTrigger>
                            </>
                        )}
                    </TabsList>
                </Tabs>
            )}
            {isReady && isAuthenticated && (
                <Button
                    className="absolute right-4"
                    variant="outline"
                    onClick={() => void handleLogout()}
                >
                    Logout
                </Button>
            )}
        </div>
    );
}