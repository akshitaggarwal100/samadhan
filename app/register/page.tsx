import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
    return (
        <div className="flex justify-center items-center mt-20">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle className="text-center text-2xl">Create Account</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Input type="text" placeholder="Full Name" />
                    <Input type="text" placeholder="Registration Number" />
                    <Input type="password" placeholder="Create Password" />
                    <Button className="w-full">Register</Button>
                </CardContent>
            </Card>
        </div>
    );
}