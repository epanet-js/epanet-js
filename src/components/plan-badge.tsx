import { Plan } from "src/user-plan";
import { translate } from "src/infra/i18n";

const planStyles: Record<string, string> = {
  free: "bg-gradient-to-r from-purple-100 via-purple-200 to-purple-300 text-purple-800",
  pro: "bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 font-bold text-yellow-700",
  personal:
    "bg-gradient-to-r from-blue-200 via-blue-300 to-blue-400 text-gray-700 font-bold shadow-md",
  education:
    "bg-gradient-to-r from-green-300 via-green-400 to-green-600 text-gray-100 font-bold shadow-md",
};

const planBadgeText: Record<Plan, string> = {
  free: "FREE",
  pro: "PRO",
  personal: "PERS",
  education: "EDU",
};

export const PlanBadge = ({ plan }: { plan: Plan }) => {
  if (plan === "free") return null;

  return (
    <span
      title={`${translate("planExplain", translate(`plan.${plan}`))}`}
      className={`absolute right-[4.8px] top-[23.5px] -mr-2 h-3 flex items-center justify-center rounded-full px-[6px] py-[6px] text-[8px]  font-bold z-10 tracking-[1px] ${planStyles[plan] || "bg-gray-200 text-gray-800"}`}
    >
      {planBadgeText[plan]}
    </span>
  );
};
