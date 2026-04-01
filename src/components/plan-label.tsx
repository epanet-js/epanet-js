import { Plan } from "src/lib/account-plans";

const planLabelText: Record<Plan, string> = {
  free: "",
  pro: "PRO",
  personal: "PERSONAL",
  education: "EDUCATION",
  teams: "TEAMS",
};

export const PlanLabel = ({ plan }: { plan: Plan }) => {
  if (plan === "free") return null;

  return (
    <span className="text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-300">
      {planLabelText[plan]}
    </span>
  );
};
