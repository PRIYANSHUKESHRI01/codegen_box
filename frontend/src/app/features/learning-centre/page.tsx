import { FeatureRoute, featureMetadata } from "@/components/marketing-site/FeatureRoute";

export const metadata = featureMetadata("learning-centre");

export default function Page() {
  return <FeatureRoute slug="learning-centre" />;
}
