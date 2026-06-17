"use client";

import { useState } from "react";
import type { RegisteredPlayer } from "@/lib/meetup-participants";
import { DiceRollerTool } from "@/components/tools/DiceRollerTool";

// Erweiterbares Tool-Register. Weitere Tisch-Tools (Startspieler, Teams,
// Punktezähler …) lassen sich hier ergänzen.
const TOOLS = [{ id: "dice", label: "Würfel" }] as const;
type ToolId = (typeof TOOLS)[number]["id"];

export function MeetupTableToolsClient({
  players,
}: {
  players: RegisteredPlayer[];
}) {
  const [active, setActive] = useState<ToolId>("dice");

  return (
    <div className="flex flex-col gap-4">
      {TOOLS.length > 1 && (
        <div className="segment-control self-start">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`btn btn-tab btn-sm ${
                active === tool.id ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => setActive(tool.id)}
            >
              {tool.label}
            </button>
          ))}
        </div>
      )}

      {active === "dice" && <DiceRollerTool players={players} />}
    </div>
  );
}
