"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShaderBackground } from "@/components/auth/shader-background";

const GENERIC_ERROR = "Invalid email or password.";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setError(error.message || GENERIC_ERROR);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <section className="relative isolate flex min-h-screen items-center justify-center px-4 py-10">
      <ShaderBackground />

      <Card className="w-full max-w-[420px] gap-0 rounded-[20px] border-white bg-card/90 px-(--card-spacing) [--card-spacing:--spacing(8)] sm:[--card-spacing:--spacing(10)] shadow-[0_1px_2px_#1b1e290f,0_20px_50px_#1b1e291f] backdrop-blur-md dark:border-border">
        <div className="flex flex-col items-center text-center">
          <Avatar className="size-16 ring-2 ring-primary ring-offset-[3px] ring-offset-card">
            <AvatarImage src="/images/avatar.png" alt="MasterMe" />
            <AvatarFallback>MM</AvatarFallback>
          </Avatar>
          <h1 className="mt-[22px] text-2xl font-semibold tracking-tight">
            Welcome to MasterMe
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-[10px] border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-[0.8125rem] text-destructive-strong"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={error ? "mt-[18px]" : "mt-[30px]"}>
          <fieldset disabled={loading} className="contents">
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="email" className="text-[0.8125rem] font-medium">
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-[42px]"
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="password" className="text-[0.8125rem] font-medium">
                  Password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-[42px] pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-[10px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground disabled:cursor-not-allowed"
                  >
                    {showPassword ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                  </button>
                </div>
              </Field>

              <Button type="submit" className="mt-2 h-[42px] w-full cursor-pointer">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </FieldGroup>
          </fieldset>
        </form>

        {!error && (
          <p className="mt-5 text-center text-[0.8125rem] text-muted-foreground">
            Personal project, contact admin for access.
          </p>
        )}
      </Card>
    </section>
  );
};

export default LoginForm;
