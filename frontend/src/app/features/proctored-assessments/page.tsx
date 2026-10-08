import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("proctored-assessments");

export default function Page() {
  return <FeatureRoute slug="proctored-assessments" />;
}
