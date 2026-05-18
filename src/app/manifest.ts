import type { MetadataRoute } from "next";
import { getSiteDisplayName } from "@/lib/site-identity";

export default function manifest(): MetadataRoute.Manifest {
  const name = getSiteDisplayName();

  return {
    name,
    short_name: name.length <= 12 ? name : name.slice(0, 12),
    description:
      "登録不要で3往復まで無料。恋の悩みを占い師「月乃ミラ」にチャットで相談。深く鑑定するプランも。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2ff",
    theme_color: "#8f7ae5",
    lang: "ja",
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" }],
  };
}
