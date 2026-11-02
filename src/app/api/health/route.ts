import { getPool } from "@/server/db";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const result = await getPool().query<{ server_time: Date }>(
      "select now() as server_time",
    );
    return Response.json(
      { database: "ok", serverTime: result.rows[0]?.server_time ?? null },
      { headers: noStore },
    );
  } catch (error) {
    console.error(
      "Database health check failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json(
      {
        error: {
          code: "database_unavailable",
          message: "The database is temporarily unavailable. Please try again.",
          fields: [],
        },
      },
      { status: 503, headers: noStore },
    );
  }
}
