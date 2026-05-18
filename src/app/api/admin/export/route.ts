import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  const token = request.nextUrl.searchParams.get("token");
  if (!adminToken || token !== adminToken) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const payments = await prisma.payment.findMany({
    where: { status: "paid" },
    orderBy: { createdAt: "desc" },
    include: { consultation: true },
  });

  const header = [
    "id",
    "createdAt",
    "plan",
    "amountTotal",
    "status",
    "consultationId",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "stripeSessionId",
  ];

  const lines = [
    header.join(","),
    ...payments.map((p) =>
      [
        csvEscape(p.id),
        csvEscape(p.createdAt.toISOString()),
        csvEscape(p.plan),
        csvEscape(String(p.amountTotal ?? "")),
        csvEscape(p.status),
        csvEscape(p.consultationId),
        csvEscape(p.consultation.utmSource ?? ""),
        csvEscape(p.consultation.utmMedium ?? ""),
        csvEscape(p.consultation.utmCampaign ?? ""),
        csvEscape(p.stripeSessionId ?? ""),
      ].join(","),
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `koi-uranai-payments-${stamp}.csv`;
  const body = `\uFEFF${lines.join("\n")}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
