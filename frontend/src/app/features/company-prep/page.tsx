import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("company-prep");

export default function Page() {
  return <FeatureRoute slug="company-prep" />;
}
