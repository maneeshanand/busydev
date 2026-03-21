import { defineConfig } from "vitepress";

export default defineConfig({
  title: "busydev",
  description: "Coordinate coding agents without terminal chaos.",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Docs", link: "/" },
      { text: "GitHub", link: "https://github.com/maneeshanand/busydev" },
    ],
    sidebar: [
      {
        text: "Get Started",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Setup", link: "/setup" },
          { text: "Core Workflows", link: "/core-workflows" },
        ],
      },
    ],
  },
});
