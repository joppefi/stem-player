import type { components } from "~/api/types";
import Field from "./Field";

type SongDetailsProps = {
  analysis: components["schemas"]["SongAnalysis"] | null;
  loading?: boolean;
};

function SongDetails({ analysis, loading }: SongDetailsProps) {
  return (
    <div className="flex flex-row gap-6">
      <Field label="Key" value={loading ? undefined : analysis?.key} />
      <Field label="BPM" value={loading ? undefined : analysis?.bpm} />
      <Field
        label="First beat"
        value={loading || !analysis ? undefined : `${analysis.first_beat}`}
      />
      <Field
        label="Duration"
        value={loading || !analysis ? undefined : `${analysis.duration}`}
      />
    </div>
  );
}

export default SongDetails;
