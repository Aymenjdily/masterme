import {
  siAngular,
  siAnthropic,
  siApollographql,
  siAstro,
  siBun,
  siChakraui,
  siClickhouse,
  siCss,
  siCypress,
  siDart,
  siDeno,
  siDjango,
  siDocker,
  siDotnet,
  siDrizzle,
  siElectron,
  siExpo,
  siExpress,
  siFigma,
  siFirebase,
  siFlutter,
  siGit,
  siGithub,
  siGo,
  siGraphql,
  siHtml5,
  siJavascript,
  siJest,
  siKotlin,
  siKubernetes,
  siLaravel,
  siMongodb,
  siMui,
  siMysql,
  siNeon,
  siNestjs,
  siNextdotjs,
  siNodedotjs,
  siNuxt,
  siPhp,
  siPostgresql,
  siPrisma,
  siPython,
  siReact,
  siReactquery,
  siReactrouter,
  siRedis,
  siRedux,
  siRemix,
  siRuby,
  siRubyonrails,
  siRust,
  siSanity,
  siSass,
  siShadcnui,
  siSpring,
  siStorybook,
  siSupabase,
  siSvelte,
  siSwift,
  siTailwindcss,
  siTauri,
  siThreedotjs,
  siTurborepo,
  siTypescript,
  siVercel,
  siVite,
  siVuedotjs,
  siWebpack,
  siZod,
  type SimpleIcon,
} from "simple-icons";
import { cn } from "@/lib/utils";

// Curated skill → official logo (simple-icons, CC0). Only these are bundled, not the whole set.
// Keys are normalized: lowercase, no spaces, dots, dashes or underscores.
const LOGOS: Record<string, SimpleIcon> = {
  next: siNextdotjs, nextjs: siNextdotjs,
  react: siReact, reactjs: siReact, reactnative: siReact,
  typescript: siTypescript, ts: siTypescript,
  javascript: siJavascript, js: siJavascript,
  node: siNodedotjs, nodejs: siNodedotjs,
  tailwind: siTailwindcss, tailwindcss: siTailwindcss,
  prisma: siPrisma, rust: siRust,
  vue: siVuedotjs, vuejs: siVuedotjs, nuxt: siNuxt, nuxtjs: siNuxt,
  angular: siAngular, svelte: siSvelte, sveltekit: siSvelte,
  nest: siNestjs, nestjs: siNestjs, express: siExpress, expressjs: siExpress,
  mongodb: siMongodb, mongo: siMongodb, postgres: siPostgresql, postgresql: siPostgresql,
  mysql: siMysql, redis: siRedis, graphql: siGraphql, apollo: siApollographql,
  python: siPython, django: siDjango, go: siGo, golang: siGo,
  dotnet: siDotnet, net: siDotnet, csharp: siDotnet, "c#": siDotnet,
  php: siPhp, laravel: siLaravel, kotlin: siKotlin, swift: siSwift,
  flutter: siFlutter, dart: siDart, vite: siVite, redux: siRedux,
  reactquery: siReactquery, tanstackquery: siReactquery, tanstack: siReactquery,
  supabase: siSupabase, firebase: siFirebase, vercel: siVercel, neon: siNeon,
  git: siGit, github: siGithub, docker: siDocker, kubernetes: siKubernetes, k8s: siKubernetes,
  shadcn: siShadcnui, shadcnui: siShadcnui, sanity: siSanity, remix: siRemix, astro: siAstro,
  deno: siDeno, bun: siBun, html: siHtml5, html5: siHtml5, css: siCss, css3: siCss,
  sass: siSass, scss: siSass, jest: siJest, cypress: siCypress, figma: siFigma,
  storybook: siStorybook, spring: siSpring, springboot: siSpring,
  rails: siRubyonrails, rubyonrails: siRubyonrails, ruby: siRuby,
  clickhouse: siClickhouse, zod: siZod, turborepo: siTurborepo, webpack: siWebpack,
  drizzle: siDrizzle, drizzleorm: siDrizzle, anthropic: siAnthropic, claude: siAnthropic,
  reactrouter: siReactrouter, expo: siExpo, mui: siMui, materialui: siMui,
  chakra: siChakraui, chakraui: siChakraui, three: siThreedotjs, threejs: siThreedotjs,
  electron: siElectron, tauri: siTauri,
};

const FALLBACK_DOTS = ["bg-primary", "bg-info", "bg-success", "bg-special", "bg-destructive", "bg-stone"];

const normalize = (skill: string) => skill.trim().toLowerCase().replace(/[\s._-]/g, "");

export function stackIcon(skill: string): SimpleIcon | undefined {
  return LOGOS[normalize(skill)];
}

/**
 * Brand color, adjusted for the light page: pale brands (React, JavaScript…) are darkened until
 * readable; near-black brands (Next.js, Vercel…) follow the text color so they also work in dark mode.
 */
function brandFill(hex: string) {
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = () => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance() < 0.08) return "currentColor";
  while (luminance() > 0.5) {
    [r, g, b] = [r, g, b].map((c) => Math.round(c * 0.85));
  }
  return `rgb(${r} ${g} ${b})`;
}

/** The skill's official logo, or a stable palette dot when there's no logo for it. */
export function StackLogo({ skill, className }: { skill: string; className?: string }) {
  const icon = stackIcon(skill);
  if (!icon) {
    const hash = [...normalize(skill)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return (
      <span aria-hidden className={cn("flex size-3.5 shrink-0 items-center justify-center", className)}>
        <span className={cn("size-2 rounded-full", FALLBACK_DOTS[hash % FALLBACK_DOTS.length])} />
      </span>
    );
  }
  return (
    <svg
      role="img"
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("size-3.5 shrink-0 text-foreground", className)}
      fill={brandFill(icon.hex)}
    >
      <path d={icon.path} />
    </svg>
  );
}
