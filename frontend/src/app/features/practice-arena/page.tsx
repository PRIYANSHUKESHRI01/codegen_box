import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("practice-arena");

export default function Page() {
  return <FeatureRoute slug="practice-arena" />;
}
