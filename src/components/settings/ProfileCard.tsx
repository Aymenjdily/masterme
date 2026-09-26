"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SettingsCard } from "@/components/settings/SettingsCard";

export type SettingsUser = { name: string; email: string; image?: string | null };

export function ProfileCard({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [savedName, setSavedName] = useState(user.name);
  const [name, setName] = useState(user.name);
  const [justSaved, setJustSaved] = useState(false);

  const trimmed = name.trim();
  const invalid = trimmed.length === 0 || trimmed.length > 60;
  const dirty = trimmed !== savedName;

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) throw new Error(error.message ?? "Couldn't save your profile");
    },
    onSuccess: () => {
      setSavedName(trimmed);
      setName(trimmed);
      setJustSaved(true);
      router.refresh(); // header reads the name from the server session
    },
  });

  return (
    <SettingsCard id="profile" title="Profile" description="How you appear in MasterMe.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid && dirty) mutation.mutate();
        }}
      >
        <div className="mt-4.5 grid grid-cols-1 items-end gap-4.5 sm:grid-cols-[auto_1fr_1fr]">
          <span className="size-18 rounded-full bg-[conic-gradient(from_200deg,var(--primary),var(--info),var(--primary))] p-[3px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.image || "/images/avatar.png"}
              alt=""
              className="size-full rounded-full border-3 border-card object-cover"
            />
          </span>
          <Field>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <Input
              id="profile-name"
              value={name}
              maxLength={60}
              aria-invalid={invalid || undefined}
              onChange={(e) => {
                setName(e.target.value);
                setJustSaved(false);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <div className="relative">
              <Input id="profile-email" value={user.email} readOnly className="bg-background pr-10 text-muted-foreground" />
              <Lock aria-hidden className="absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </Field>
        </div>
        {invalid && <FieldError className="mt-2" errors={[{ message: "Enter a name (up to 60 characters)" }]} />}
        {mutation.isError && <p className="mt-2 text-sm text-destructive-strong">{mutation.error.message}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          {justSaved && !dirty ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-success-strong">
              <Check className="size-3.5" />
              Profile saved
            </span>
          ) : (
            <span className="text-[0.8125rem] text-muted-foreground">
              Your email is your sign-in and can&apos;t be changed here.
            </span>
          )}
          <Button
            type="submit"
            variant={dirty && !invalid ? "default" : "outline"}
            disabled={!dirty || invalid || mutation.isPending}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
