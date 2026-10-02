import { Container, LinkButton, PageTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <Container narrow>
      <PageTitle lead="The page you were looking for doesn&apos;t exist or has moved.">We couldn&apos;t find that page</PageTitle>
      <div className="flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/check">Check a subscription</LinkButton>
        <LinkButton href="/" variant="secondary">Go to the home page</LinkButton>
      </div>
    </Container>
  );
}
