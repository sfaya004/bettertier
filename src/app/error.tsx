"use client";

import { useEffect } from "react";
import { Button, Container, LinkButton, PageTitle } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container narrow>
      <PageTitle lead="Something went wrong on our side, not yours. Your answers are kept, so trying again is safe.">Sorry – that didn&apos;t work</PageTitle>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/" variant="secondary">Go to the home page</LinkButton>
      </div>
      {error.digest ? <p className="mt-6 text-[0.9rem] text-[var(--color-ink-soft)]">Reference: {error.digest}</p> : null}
    </Container>
  );
}
