import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("campus-drives");

export default function Page() {
  return <FeatureRoute slug="campus-drives" />;
}
