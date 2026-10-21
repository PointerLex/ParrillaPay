export default function manifest() {
  return {
    name: "ParrillaPay",
    short_name: "ParrillaPay",
    description: "Organiza y divide los gastos de tus juntas.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
