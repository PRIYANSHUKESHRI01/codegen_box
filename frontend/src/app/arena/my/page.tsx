import type { Metadata } from "next";
import { MyHackathons } from "@/components/arena/MyHackathons";

export const metadata: Metadata = { title: "My hackathons" };

export default function MyHackathonsPage() {
  return <MyHackathons />;
}
