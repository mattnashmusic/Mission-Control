import { NextResponse } from "next/server";

const MAILERLITE_BASE_URL = "https://connect.mailerlite.com/api";

type CreateGroupResponse = {
  data?: {
    id: string;
    name: string;
  };
  message?: string;
};

type ImportSubscribersResponse = {
  import_progress_url?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.MAILERLITE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { message: "Missing MAILERLITE_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const rawName = typeof body?.name === "string" ? body.name : "";
    const rawEmails = Array.isArray(body?.emails) ? body.emails : [];

    const name = rawName.trim().slice(0, 255);
    const emails = dedupeEmails(rawEmails);

    if (!name) {
      return NextResponse.json(
        { message: "Group name is required" },
        { status: 400 }
      );
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { message: "No emails provided" },
        { status: 400 }
      );
    }

    // 1) Create MailerLite group
    const createGroupRes = await fetch(`${MAILERLITE_BASE_URL}/groups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
      cache: "no-store",
    });

    const createGroupJson =
      (await safeJson<CreateGroupResponse>(createGroupRes)) ?? {};

    if (!createGroupRes.ok || !createGroupJson.data?.id) {
      return NextResponse.json(
        {
          message:
            createGroupJson.message ||
            "Failed to create MailerLite group",
          details: createGroupJson,
        },
        { status: createGroupRes.status || 500 }
      );
    }

    const groupId = createGroupJson.data.id;

    // 2) Bulk import subscribers into that group
    const importRes = await fetch(
      `${MAILERLITE_BASE_URL}/groups/${groupId}/import-subscribers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscribers: emails.map((email) => ({ email })),
        }),
        cache: "no-store",
      }
    );

    const importJson =
      (await safeJson<ImportSubscribersResponse>(importRes)) ?? {};

    if (!importRes.ok) {
      return NextResponse.json(
        {
          message:
            importJson.message ||
            "Group created, but failed to import subscribers",
          groupId,
          groupName: createGroupJson.data.name,
          details: importJson,
        },
        { status: importRes.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      groupId,
      name: createGroupJson.data.name,
      count: emails.length,
      importProgressUrl: importJson.import_progress_url ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to create MailerLite group",
      },
      { status: 500 }
    );
  }
}

function dedupeEmails(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;

    const email = value.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;

    seen.add(email);
    result.push(email);
  }

  return result;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}