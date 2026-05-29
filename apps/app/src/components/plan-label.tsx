import { Plan } from "src/lib/account-plans";
import { useOrganization } from "src/hooks/use-organization";

const planLabelText: Record<Plan, string> = {
  free: "",
  pro: "PRO",
  personal: "PERSONAL",
  education: "EDUCATION",
  teams: "",
};

export const PlanLabel = ({
  plan,
  onOrgClick,
}: {
  plan: Plan;
  onOrgClick?: () => void;
}) => {
  const { organization } = useOrganization();

  if (plan === "free") return null;

  if (plan === "teams" && organization) {
    const content = (
      <>
        <img
          src={organization.imageUrl}
          alt={organization.name}
          className="h-4 w-4 rounded-xs object-cover"
        />
        {organization.name}
      </>
    );

    if (onOrgClick) {
      return (
        <button
          onClick={onOrgClick}
          className="mr-1 flex items-center gap-x-1.5 text-size-base font-semibold text-subtle hover:text-default dark:text-gray-300 dark:hover:text-gray-100 cursor-pointer"
        >
          {content}
        </button>
      );
    }

    return (
      <span className="mr-1 flex items-center gap-x-1.5 text-size-base font-semibold text-subtle">
        {content}
      </span>
    );
  }

  return (
    <span className="text-size-small font-semibold tracking-wide text-subtle">
      {planLabelText[plan]}
    </span>
  );
};
