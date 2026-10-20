"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
};

export default function SubmitButton({ children, disabled, pendingText = "Saving…", ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type={props.type || "submit"} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}
