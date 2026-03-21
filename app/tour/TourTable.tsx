"use client";

import { useState } from "react";
import type { EditableShowField, ShowRow } from "@/lib/show-client";
import { saveShowField } from "@/lib/show-client";

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  initialShows: ShowRow[];
};

export default function TourTable({ initialShows }: Props) {
  const [shows, setShows] = useState<ShowRow[]>(initialShows);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  function setFieldValue(showId: string, field: EditableShowField, value: string) {
    setShows((prev) =>
      prev.map((show) =>
        show.id === showId
          ? {
              ...show,
              [field]: value === "" ? show[field] : Number(value),
            }
          : show
      )
    );
  }

  async function handleSave(showId: string, field: EditableShowField, value: string) {
    const key = `${showId}:${field}`;

    try {
      setSaveStates((prev) => ({ ...prev, [key]: "saving" }));
      await saveShowField(showId, field, value);
      setSaveStates((prev) => ({ ...prev, [key]: "saved" }));

      setTimeout(() => {
        setSaveStates((prev) => {
          const next = { ...prev };
          if (next[key] === "saved") delete next[key];
          return next;
        });
      }, 1500);
    } catch (error) {
      console.error(error);
      setSaveStates((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  function renderStatus(showId: string, field: EditableShowField) {
    const key = `${showId}:${field}`;
    const state = saveStates[key];

    if (state === "saving") {
      return <span className="text-xs text-neutral-500">Saving...</span>;
    }

    if (state === "saved") {
      return <span className="text-xs text-green-600">Saved</span>;
    }

    if (state === "error") {
      return <span className="text-xs text-red-600">Failed</span>;
    }

    return null;
  }

  function renderNumberInput(show: ShowRow, field: EditableShowField) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="number"
          step="any"
          defaultValue={show[field]}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          onChange={(e) => setFieldValue(show.id, field, e.target.value)}
          onBlur={(e) => handleSave(show.id, field, e.target.value)}
        />
        {renderStatus(show.id, field)}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">City</th>
            <th className="px-3 py-2 text-left">Venue</th>
            <th className="px-3 py-2 text-left">Capacity</th>
            <th className="px-3 py-2 text-left">Ticket €</th>
            <th className="px-3 py-2 text-left">Sales</th>
            <th className="px-3 py-2 text-left">Meta Spend</th>
            <th className="px-3 py-2 text-left">Venue Hire</th>
            <th className="px-3 py-2 text-left">Production</th>
            <th className="px-3 py-2 text-left">Hotel/Petrol/Misc</th>
          </tr>
        </thead>
        <tbody>
          {shows.map((show) => (
            <tr key={show.id} className="border-b align-top">
              <td className="px-3 py-2">
                {new Date(show.date).toLocaleDateString("en-GB")}
              </td>
              <td className="px-3 py-2">{show.city}</td>
              <td className="px-3 py-2">{show.venue}</td>
              <td className="px-3 py-2">{renderNumberInput(show, "capacity")}</td>
              <td className="px-3 py-2">{renderNumberInput(show, "ticketPrice")}</td>
              <td className="px-3 py-2">{renderNumberInput(show, "ticketSales")}</td>
              <td className="px-3 py-2">{renderNumberInput(show, "metaSpend")}</td>
              <td className="px-3 py-2">{renderNumberInput(show, "venueHire")}</td>
              <td className="px-3 py-2">{renderNumberInput(show, "production")}</td>
              <td className="px-3 py-2">
                {renderNumberInput(show, "hotelPetrolMisc")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}