import { PageHeader } from "@/components/page-header";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { redirect } from "next/navigation";
import { ClipboardCheck, FileSearch, Rocket, ScanSearch } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SubmitForm } from "@/components/submit-form";

export default async function SubmitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contribute"
        title="Submit to the catalog"
        subtitle="Share a skill, MCP server, plugin or doc with the company. Every submission goes through this pipeline:"
      />
      <PipelineStepper />
      <SubmitForm />
    </div>
  );
}
