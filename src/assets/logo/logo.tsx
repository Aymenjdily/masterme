import Image from "next/image";

const Logo = () => {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/images/avatar.png"
        alt="MasterMe"
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-primary ring-offset-2 ring-offset-sidebar"
      />
      <span className="text-xl font-semibold text-foreground">
        MasterMe
      </span>
    </div>
  );
};

export default Logo;
