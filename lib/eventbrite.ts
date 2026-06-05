type EventbriteAttendee = {
  id?: string;
  status?: string;
  cancelled?: boolean;
  refunded?: boolean;
};

type EventbriteAttendeesResponse = {
  pagination?: {
    object_count?: number;
    page_number?: number;
    page_count?: number;
    has_more_items?: boolean;
  };
  attendees?: EventbriteAttendee[];
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

  const response = await fetch(
    `https://www.eventbriteapi.com/v3/events/${eventId}/attendees/`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: {
        revalidate: 300,
      },
    }
  );

  if (!response.ok) {
    console.error(
      `Eventbrite API error for ${slug}:`,
      response.status,
      await response.text()
    );
    return null;
  }

  const data = (await response.json()) as EventbriteAttendeesResponse;

  const attendees = data.attendees ?? [];

  return attendees.filter((attendee) => {
    if (attendee.cancelled) return false;
    if (attendee.refunded) return false;
    if (attendee.status && attendee.status !== "Attending") return false;
    return true;
  }).length;
}