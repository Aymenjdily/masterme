"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { queryKeys } from "@/lib/query-keys";
import type { RecruiterContact } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

// Blank optional fields are allowed here and sent as "not set" (the API schema rejects "").
const formSchema = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  company: z.string(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  phone: z.string(),
  linkedinUrl: z.union([z.literal(""), z.string().trim().url("Enter a full link starting with https://")]),
  notes: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const optional = (value: string) => value.trim() || undefined;

async function saveContact(contact: RecruiterContact | undefined, values: FormValues) {
  const body = {
    name: values.name.trim(),
    company: optional(values.company),
    email: optional(values.email),
    phone: optional(values.phone),
    linkedinUrl: optional(values.linkedinUrl),
    notes: optional(values.notes),
  };
  const res = await fetch(contact ? `/api/recruiter-contacts/${contact.id}` : "/api/recruiter-contacts", {
    method: contact ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save recruiter contact");
  return res.json();
}

export function RecruiterContactForm({
  contact,
  onDone,
}: {
  contact?: RecruiterContact;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: contact?.name ?? "",
      company: contact?.company ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      linkedinUrl: contact?.linkedinUrl ?? "",
      notes: contact?.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => saveContact(contact, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruiterContacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsSummary });
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col">
      <FieldGroup className="grid grid-cols-1 gap-4.5 px-6 pb-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="rc-name">Name</FieldLabel>
          <Input id="rc-name" placeholder="Salma B." autoFocus {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rc-company">Company</FieldLabel>
          <Input id="rc-company" placeholder="Talentia" {...register("company")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rc-email">Email</FieldLabel>
          <Input id="rc-email" type="email" placeholder="name@company.com" {...register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rc-phone">Phone</FieldLabel>
          <Input id="rc-phone" type="tel" placeholder="+212 6…" className="font-mono" {...register("phone")} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="rc-linkedin">LinkedIn URL</FieldLabel>
          <Input id="rc-linkedin" type="url" placeholder="https://linkedin.com/in/…" {...register("linkedinUrl")} />
          <FieldError errors={[errors.linkedinUrl]} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="rc-notes">Notes</FieldLabel>
          <Textarea id="rc-notes" placeholder="What you sent, what they said…" className="min-h-16" {...register("notes")} />
        </Field>
      </FieldGroup>
      {mutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive-strong">Something went wrong. Please try again.</p>
      )}
      <div className="flex justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="ghost" onClick={onDone} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : contact ? "Save changes" : "Add recruiter"}
        </Button>
      </div>
    </form>
  );
}
