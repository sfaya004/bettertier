import { permanentRedirect } from "next/navigation";

/** There is no paid tier. Old links to /pricing go to the support page. */
export default function PricingRedirect() {
  permanentRedirect("/support");
}
