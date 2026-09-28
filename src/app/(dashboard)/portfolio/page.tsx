import { PortfolioLinkList } from "@/components/portfolio/PortfolioLinkList";
import { SocialAppList } from "@/components/portfolio/SocialAppList";
import { BlogCard } from "@/components/blog/BlogCard";
import { ProjectsCard } from "@/components/sanity-projects/ProjectsCard";

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-5.5 px-2 pt-2 pb-6">
      <div>
        <h1 className="text-[1.625rem] font-semibold tracking-tight">Portfolio &amp; Links</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your portfolio and social profiles, in one place.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-4">
          <PortfolioLinkList />
          <ProjectsCard />
        </div>
        <div className="flex flex-col gap-4">
          <SocialAppList />
          <BlogCard />
        </div>
      </div>
    </div>
  );
}
