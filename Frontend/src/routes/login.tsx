import { createFileRoute } from "@tanstack/react-router";
import Login from "@/Pages/LandingPage/login";

export const Route = createFileRoute("/login")({
  component: Login,
});
