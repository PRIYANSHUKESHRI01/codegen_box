import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("placement-analytics");

export default function Page() {
  return <FeatureRoute slug="placement-analytics" />;
}
