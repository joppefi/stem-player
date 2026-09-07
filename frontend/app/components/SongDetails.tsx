import React from "react";
import Field from "./Field";
import { useGetAnalysis } from "~/api/hooks.generated";

type SongDetailsProps = {
  jobId: string;
};

function SongDetails({ jobId }: SongDetailsProps) {
  const { data, loading } = useGetAnalysis(jobId);

  return (
    <div className="flex-row flex gap-4">
      <Field label="Key" value={data?.key} />
      <Field label="BPM" value={data?.bpm} />
    </div>
  );
}

export default SongDetails;
