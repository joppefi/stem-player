import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("jobs/:jobId", "routes/job.tsx"),
  route("songs/:songId", "routes/song.tsx"),
] satisfies RouteConfig;
