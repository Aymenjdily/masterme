"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, LaptopMinimal, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SettingsCard } from "@/components/settings/SettingsCard";

// Better Auth defaults (auth.ts doesn't override them).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

export function SecurityCard() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [updated, setUpdated] = useState(false);

  const filled = current !== "" && next !== "" && confirm !== "";

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: revokeOthers,
      });
      if (error) {
        const wrongCurrent = error.code === "INVALID_PASSWORD" || error.status === 400;
        throw Object.assign(new Error(error.message ?? "Couldn't update your password"), { wrongCurrent });
      }
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setUpdated(true);
    },
    onError: (error: Error & { wrongCurrent?: boolean }) => {
      setErrors(error.wrongCurrent ? { current: "Current password is incorrect" } : { form: error.message });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (next.length < MIN_PASSWORD || next.length > MAX_PASSWORD) {
      found.next = `Use ${MIN_PASSWORD}–${MAX_PASSWORD} characters`;
    } else if (next === current) {
      found.next = "Choose a password different from the current one";
    }
    if (confirm !== next) found.confirm = "Passwords don't match";
    setErrors(found);
    setUpdated(false);
    if (Object.keys(found).length === 0) passwordMutation.mutate();
  }

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    error: string | undefined,
    autoComplete: string,
    placeholder?: string
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          set(e.target.value);
          setUpdated(false);
        }}
      />
      <FieldError errors={[error ? { message: error } : undefined]} />
    </Field>
  );

  return (
    <SettingsCard id="security" title="Security" description="Change your password and manage where you're signed in.">
      <form onSubmit={submit}>
        <div className="mt-4.5 grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
          {field("pw-current", "Current password", current, setCurrent, errors.current, "current-password")}
          {field("pw-new", "New password", next, setNext, errors.next, "new-password", `At least ${MIN_PASSWORD} characters`)}
          {field("pw-confirm", "Confirm new password", confirm, setConfirm, errors.confirm, "new-password", "Repeat it")}
        </div>

        <label className="mt-3.5 flex w-fit cursor-pointer items-center gap-2.5 text-[0.8125rem]">
          <Checkbox checked={revokeOthers} onCheckedChange={(checked) => setRevokeOthers(checked === true)} />
          Sign out of other devices after changing it
        </label>

        {errors.form && <p className="mt-3 text-sm text-destructive-strong">{errors.form}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {updated ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-success-strong">
              <Check className="size-3.5" />
              Password updated
              {revokeOthers ? " · other devices signed out" : ""}
            </span>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            variant={filled ? "default" : "outline"}
            disabled={!filled || passwordMutation.isPending}
            className="cursor-pointer"
          >
            {passwordMutation.isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>

      <div className="mt-4.5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-background px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9.5 items-center justify-center rounded-[10px] border bg-card text-muted-foreground">
            <LaptopMinimal className="size-4.25" />
          </span>
          <div>
            <p className="text-[0.84rem] font-medium">This device</p>
            <p className="font-mono text-[0.71875rem] text-muted-foreground">Signed in · session active</p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={signOutMutation.isPending}
          onClick={() => signOutMutation.mutate()}
          className="cursor-pointer"
        >
          <LogOut />
          {signOutMutation.isPending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </SettingsCard>
  );
}
