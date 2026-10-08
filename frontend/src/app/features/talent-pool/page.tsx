import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("talent-pool");

export default function Page() {
  return <FeatureRoute slug="talent-pool" />;
}
