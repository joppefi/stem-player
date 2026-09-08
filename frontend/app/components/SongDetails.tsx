import React from "react";
import Field from "./Field";
import { useGetSongAnalysis } from "~/api/hooks.generated";

type SongDetailsProps = {
  songId: string;
};

function SongDetails({ songId }: SongDetailsProps) {
  const { data, loading } = useGetSongAnalysis(songId);

  return (
    <div className="flex-row flex gap-4">
      <Field label="Key" value={data?.key} />
      <Field label="BPM" value={data?.bpm} />
    </div>
  );
}

export default SongDetails;
