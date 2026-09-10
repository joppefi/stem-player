import { Link, useParams } from "react-router";
import type { Route } from "./+types/song";
import SongDetails from "../components/SongDetails";
import StemPlayer from "../components/StemPlayer";
import { useGetSong, useGetSongAnalysis } from "~/api/hooks.generated";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Stem Player" }];
}

export default function SongPage() {
  const { songId } = useParams();
  const { data: song, loading, error } = useGetSong(songId ?? null);
  const { data: analysisData, loading: analysisLoading } = useGetSongAnalysis(
    songId ?? null,
  );

  if (!songId) {
    return <ErrorScreen message="No song id given." />;
  }

  if (loading && !song) {
    return (
      <Centered>
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </Centered>
    );
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  if (!song || song.status !== "done" || !song.stem_paths) {
    return <ErrorScreen message="Song not found." />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 pt-16">
      <div className="text-center">
        {song.title && (
          <h1 className="text-2xl font-semibold break-words max-w-xl">
            {song.title}
          </h1>
        )}
      </div>
      <SongDetails analysis={analysisData} loading={analysisLoading} />
      {song && analysisData && (
        <div className="w-full max-w-xl">
          <StemPlayer
            songId={songId}
            stemPaths={song.stem_paths}
            analysis={analysisData}
          />
        </div>
      )}
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <Centered>
      <div className="text-center flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">
          Not found
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        <Link
          to="/"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Back home
        </Link>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 pt-16">
      {children}
    </main>
  );
}
