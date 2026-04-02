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
          className="h-4 w-4 rounded-sm object-cover"
        />
        {organization.name}
      </>
    );

    if (onOrgClick) {
      return (
        <button
          onClick={onOrgClick}
          className="mr-1 flex items-center gap-x-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 cursor-pointer"
        >
          {content}
        </button>
      );
    }

    return (
      <span className="mr-1 flex items-center gap-x-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
        {content}
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-300">
      {planLabelText[plan]}
    </span>
  );
};
