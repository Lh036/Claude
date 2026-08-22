import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="h-5 w-5" />}
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      action={
        <Link to="/">
          <Button variant="secondary" size="sm">
            Back to Overview
          </Button>
        </Link>
      }
    />
  );
}
