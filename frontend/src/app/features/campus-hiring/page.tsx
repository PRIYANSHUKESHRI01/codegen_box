import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("campus-hiring");

export default function Page() {
  return <FeatureRoute slug="campus-hiring" />;
}
