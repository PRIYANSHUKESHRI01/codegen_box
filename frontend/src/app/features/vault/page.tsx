import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("vault");

export default function Page() {
  return <FeatureRoute slug="vault" />;
}
