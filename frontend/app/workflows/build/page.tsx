import MeshWorkflowBuilder from "@/components/workflow-builder/MeshWorkflowBuilder";

export const metadata = {
  title: "Create workflow · Mesh",
  description: "Visual DAG builder that generates Mesh workflow JSON and calls the Workflow Manager API.",
};

export default function WorkflowBuildPage() {
  return <MeshWorkflowBuilder />;
}
