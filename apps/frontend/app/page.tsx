import { 
  LandingNavigation,
  HeroSection,
  TrustRibbon,
  CapabilityBento,
  WorkflowSection,
  WorkspaceShowcase,
  ArchitectureSection,
  EnterpriseSafetySection,
  FinalCta,
  LandingFooter
} from "../components/landing";

export default function LandingPage() {
  return (
    <main className="premium-page">
      <LandingNavigation />
      <HeroSection />
      <TrustRibbon />
      <CapabilityBento />
      <WorkflowSection />
      <WorkspaceShowcase />
      <ArchitectureSection />
      <EnterpriseSafetySection />
      <FinalCta />
      <LandingFooter />
    </main>
  );
}
