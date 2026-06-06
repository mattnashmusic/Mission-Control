type EventbriteMoney = {
  major_value?: string;
};

type EventbriteAttendee = {
  id?: string;
  status?: string;
  cancelled?: boolean;
  refunded?: boolean;
  created?: string;
  costs?: {
    base_price?: EventbriteMoney;
  };
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

export type DailyTicketSalesPoint = {
  date: string;
  label: string;
  ticketSales: number;
  ticketRevenue: number;
};

export type EventbriteShowStats = {
  ticketSales: number;
  ticketRevenue: number;
  dailyTicketSales: DailyTicketSalesPoint[];
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

function formatDailySalesLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

function isValidAttendee(attendee: EventbriteAttendee) {
  if (attendee.cancelled) return false;
  if (attendee.refunded) return false;
  if (attendee.status && attendee.status !== "Attending") return false;
  return true;
}

function getAttendeeBasePrice(attendee: EventbriteAttendee) {
  return Number(attendee.costs?.base_price?.major_value ?? 0);
}

export async function getEventbriteShowStatsBySlug(
  slug: string
): Promise<EventbriteShowStats | null> {
  const eventId = EVENTBRITE_EVENT_IDS_BY_SLUG[slug];

  if (!eventId) {
    return null;
  }

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN;

  if (!token) {
    console.warn("Missing EVENTBRITE_PRIVATE_TOKEN");
    return null;
  }

  const attendees: EventbriteAttendee[] = [];
  let page = 1;
  let hasMoreItems = false;

  do {
    const url = new URL(
      `https://www.eventbriteapi.com/v3/events/${eventId}/attendees/`
    );

    if (page > 1) {
      url.searchParams.set("page", String(page));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
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

    attendees.push(...(data.attendees ?? []));

    hasMoreItems = data.pagination?.has_more_items ?? false;
    page += 1;
  } while (hasMoreItems);

  const validAttendees = attendees.filter(isValidAttendee);

  const ticketRevenue = validAttendees.reduce((sum, attendee) => {
    return sum + getAttendeeBasePrice(attendee);
  }, 0);

  const dailySalesByDate = new Map<string, DailyTicketSalesPoint>();

  validAttendees.forEach((attendee) => {
    if (!attendee.created) return;

    const date = attendee.created.slice(0, 10);
    const basePrice = getAttendeeBasePrice(attendee);
    const existing = dailySalesByDate.get(date);

    if (existing) {
      existing.ticketSales += 1;
      existing.ticketRevenue += basePrice;
      return;
    }

    dailySalesByDate.set(date, {
      date,
      label: formatDailySalesLabel(date),
      ticketSales: 1,
      ticketRevenue: basePrice,
    });
  });

  return {
    ticketSales: validAttendees.length,
    ticketRevenue,
    dailyTicketSales: Array.from(dailySalesByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  };
}
