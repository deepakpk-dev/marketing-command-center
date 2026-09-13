import { z } from "zod";
import { readJson, withRepository } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRepository(request, async (repo) => {
    const id = z.uuid().parse((await params).id);
    const body = z
      .object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().min(3).max(1000),
        reviewer: z.string().trim().min(1).max(100),
      })
      .strict()
      .parse(await readJson(request));
    const event = await repo.decide(
      id,
      body.decision,
      body.note,
      body.reviewer,
    );
    return {
      event,
      message: `Action ${body.decision}. Decision recorded in the audit trail.`,
    };
  });
}
