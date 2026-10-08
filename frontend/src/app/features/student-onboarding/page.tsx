import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("student-onboarding");

export default function Page() {
  return <FeatureRoute slug="student-onboarding" />;
}
