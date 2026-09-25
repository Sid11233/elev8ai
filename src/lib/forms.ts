"use client";

import { type FormEvent, startTransition } from "react";

// onSubmit handler that runs a useActionState action WITHOUT React's automatic
// form reset. The reset snaps <select>s back to their first option after a
// validation error; this keeps everything the user entered. Includes the
// clicked submit button's name/value (e.g. intent=publish).
export function submitWithoutReset(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
