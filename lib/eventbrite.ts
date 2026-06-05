type EventbritePagination = {
  has_more_items?: boolean;
  continuation?: string;
};

type EventbriteAttendeesResponse = {
  attendees?: unknown[];
  pagination?: EventbritePagination;
};

const EVENTBRITE_EVENT_IDS_BY_SLUG: Record<string, string> = {
  "hamburg-2026": "1989791795825",
  "berlin-2026": "1990698520864",
  "munich-2026": "1990698738515",
  "zurich-2026": "1990698874923",
  "cologne-2026": "1990698933097",
  "brussels-2026": "1990699004310",
  "amsterdam-2026": "1990699029385",
};

export async function getEventbriteTicketSalesBySlug(slug: string) {
  const eventId = EVENTBRITE_EVENT_IDS_BY_SLUG[slug];

  if (!eventId) {
    return null;
  }

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN;

  if (!token) {
    console.warn("Missing EVENTBRITE_PRIVATE_TOKEN");
    return null;
  }

  let total = 0;
  let continuation: string | undefined;

  do {
    const url = new URL(
      `https://www.eventbriteapi.com/v3/events/${eventId}/attendees/`
    );

    url.searchParams.set("page_size", "200");

    if (continuation) {
      url.searchParams.set("continuation", continuation);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      console.error(
        `Eventbrite API error for ${slug}:`,
        response.status,
        await response.text()
      );
      return null;
    }

    const data = (await response.json()) as EventbriteAttendeesResponse;

    total += data.attendees?.length ?? 0;

    continuation = data.pagination?.has_more_items
      ? data.pagination.continuation
      : undefined;
  } while (continuation);

  return total;
}