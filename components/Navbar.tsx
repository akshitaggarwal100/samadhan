"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <div className="w-full flex justify-center p-4 border-b mb-8">
            <Tabs value={pathname} onValueChange={(value) => router.push(value)}>
                <TabsList>
                    <TabsTrigger value="/">Login</TabsTrigger>
                    <TabsTrigger value="/register">Register</TabsTrigger>
                    <TabsTrigger value="/ledger">Public Ledger</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
}