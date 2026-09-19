import { NextResponse } from "next/server";
import { csvProcessor } from "@/lib/services/csv-processor";

/**
 * GET /api/csv/template
 * Mengunduh file CSV template untuk bulk post scheduling.
 */
export async function GET(): Promise<NextResponse> {
  const templateContent = csvProcessor.getTemplateCsv();

  return new NextResponse(templateContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mupost_template.csv"',
    },
  });
}
