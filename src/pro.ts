/** Pro gate. Every Pro feature asks `gate.has(feature)` first. Pro code never touches the network. */
export type ProFeature = "trackedChanges";

export interface ProGate {
  has(feature: ProFeature): boolean;
}

export class FreeGate implements ProGate {
  has(_feature: ProFeature): boolean {
    return false;
  }
}

export class UnlockedGate implements ProGate {
  has(_feature: ProFeature): boolean {
    return true;
  }
}

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  trackedChanges: "tracked changes marked in the note, with author and date (or accept-all / reject-all)",
};
