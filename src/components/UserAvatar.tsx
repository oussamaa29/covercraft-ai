import { cn } from "@/lib/cn";

const SIZES = {
  sm: "h-7 w-7 text-xs", // 28px — navbar
  lg: "h-12 w-12 text-lg", // settings
} as const;

export function UserAvatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image: string | null;
  size?: keyof typeof SIZES;
}) {
  if (image) {
    return (
      // Provider avatars come from a handful of CDNs and are tiny; next/image
      // would need a remotePatterns entry per host for no real gain.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover", SIZES[size])}
      />
    );
  }

  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent-strong",
        SIZES[size]
      )}
    >
      {initial}
    </span>
  );
}
