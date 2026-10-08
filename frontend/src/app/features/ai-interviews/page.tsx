import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("ai-interviews");

export default function Page() {
  return <FeatureRoute slug="ai-interviews" />;
}
