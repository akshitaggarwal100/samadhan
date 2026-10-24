import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export default function LedgerPage() {
    return (
        <div className="mt-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Public Ledger</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>Oct 24, 2026</TableCell>
                                <TableCell>C001</TableCell>
                                <TableCell className="font-medium">Hostel Wi-Fi Down</TableCell>
                                <TableCell>No internet connection in CV Raman.</TableCell>
                                <TableCell>Filed</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Oct 23, 2026</TableCell>
                                <TableCell>C002</TableCell>
                                <TableCell className="font-medium">Study room AC</TableCell>
                                <TableCell>study room ac not working.</TableCell>
                                <TableCell>Assigned</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}