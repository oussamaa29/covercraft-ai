"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";

export function LogoutButton({
  size = "sm",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          // The JSON content type is what the API's CSRF guard checks for.
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          router.push("/");
          router.refresh();
        });
      }}
    >
      Log out
    </Button>
  );
}
