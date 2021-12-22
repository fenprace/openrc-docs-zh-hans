// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "OpenRC 中文文档",
  tagline: "整理和翻译 OpenRC 项目中的部分文档",
  url: "https://openrc-docs.zhuof.engineer",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  // favicon: "img/favicon.ico",
  organizationName: "fenprace", // Usually your GitHub org/user name.
  projectName: "openrc-docs-zh-hans", // Usually your repo name.

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          // editUrl:
          //   "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      metadata: [
        { name: "keywords", content: "init, linux, openrc, 教程, 运维, 中文" },
      ],
      navbar: {
        title: "OpenRC 中文文档",
        // logo: {
        //   alt: "OpenRC 中文文档",
        //   src: "img/logo.svg",
        // },
        items: [
          // {
          //   type: "doc",
          //   docId: "intro",
          //   position: "left",
          //   label: "Tutorial",
          // },
          {
            href: "https://github.com/OpenRC/openrc/",
            label: "OpenRC",
            position: "right",
          },
          {
            href: "https://github.com/fenprace/openrc-docs-zh-hans",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "More",
            items: [
              {
                label: "OpenRC",
                href: "https://github.com/OpenRC/openrc/",
              },
              {
                label: "GitHub",
                href: "https://github.com/fenprace/openrc-docs-zh-hans",
              },
            ],
          },
          {
            title: "About me",
            items: [
              {
                label: "Profile",
                href: "https://github.com/fenprace",
              },
              {
                label: "ArchWiki",
                href: "https://wiki.archlinux.org/title/User:FENPRACE",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} FENPRACE. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
