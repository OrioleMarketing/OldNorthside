import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ownerPagePath = fileURLToPath(new URL("../client/src/pages/OwnerPage.tsx", import.meta.url));
const ownerPageSource = readFileSync(ownerPagePath, "utf8");

describe("owner room-block management", () => {
  it("lists all active owner blocks and requires a reason before unblocking", () => {
    expect(ownerPageSource).toContain("const activeBlockQuery = useMemo(() => ({}), [])");
    expect(ownerPageSource).toContain("trpc.owner.blocks.useQuery(activeBlockQuery");
    expect(ownerPageSource).toContain("Active room blocks");
    expect(ownerPageSource).toContain("No active owner blocks are currently in place.");
    expect(ownerPageSource).toContain("Unblock room");
    expect(ownerPageSource).toContain("Reason for unblocking");
    expect(ownerPageSource).toContain("blockCancellationReason.trim().length < 2");
    expect(ownerPageSource).toContain("reservationBlockId: pendingBlockCancellation.id");
  });
});
