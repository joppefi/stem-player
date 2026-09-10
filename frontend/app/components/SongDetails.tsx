import Field from "./Field";
import { useGetSongAnalysis } from "~/api/hooks.generated";

type SongDetailsProps = {
  songId: string;
};

function SongDetails({ songId }: SongDetailsProps) {
  const { data, loading, error } = useGetSongAnalysis(songId);

  if (error) return null;

  return (
    <div className="flex flex-row gap-6">
      <Field label="Key" value={loading ? undefined : data?.key} />
      <Field label="BPM" value={loading ? undefined : data?.bpm} />
      <Field
        label="First beat"
        value={
          loading || !data ? undefined : `${data.first_beat}s`
        }
      />
    </div>
  );
}

export default SongDetails;
