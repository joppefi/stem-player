import { Link } from "react-router";

export default function TopBar() {
  return (
    <header className="fixed top-0 inset-x-0 h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur z-10">
      <Link to="/" className="text-sm font-semibold">
        Stem Player
      </Link>
    </header>
  );
}
