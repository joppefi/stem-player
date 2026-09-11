import { Link } from "react-router";
import { useConfig } from "~/api/hooks.generated";
import Field, { Label } from "./Field";
import VolumeControl from "./VolumeControl";

export default function TopBar() {
  const { data } = useConfig();

  return (
    <header className="fixed top-0 inset-x-0 h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur z-10">
      <Link to="/" className="text-sm font-semibold">
        Stem Player
      </Link>
      <div className="flex gap-4">
        <VolumeControl />
        <Field label="Data path" value={data?.data_dir} />
      </div>
    </header>
  );
}
