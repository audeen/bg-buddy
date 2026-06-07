"use client";

import { useState } from "react";
import {
  CollectionManagerClient,
  type CollectionGameRow,
} from "@/components/CollectionManagerClient";
import { AddGameModal } from "@/components/BarcodeScanClient";

export function CollectionAdminClient({ games }: { games: CollectionGameRow[] }) {
  const [addGameOpen, setAddGameOpen] = useState(false);

  return (
    <>
      <CollectionManagerClient
        games={games}
        onAddGame={() => setAddGameOpen(true)}
      />
      <AddGameModal open={addGameOpen} onOpenChange={setAddGameOpen} />
    </>
  );
}
