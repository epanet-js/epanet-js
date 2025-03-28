import { Plan } from "src/auth";

const planStyles: Record<string, string> = {
  free: "bg-gray-200 text-gray-800",
  pro: "bg-gradient-to-r from-yellow-200 to-yellow-400 text-yellow-600",
  personal:
    "bg-gradient-to-r from-gray-200 via-gray-300 to-gray-400 text-gray-700 font-bold shadow-md",
  education:
    "bg-gradient-to-r from-green-300 via-green-400 to-green-600 text-gray-100 font-bold shadow-md",
};

const planLabel: Record<Plan, string> = {
  free: "FREE",
  pro: "PRO",
  personal: "PERSONAL",
  education: "EDU",
};

export const PlanBadge = ({ plan }: { plan: Plan }) => {
  return (
    <span
      className={`px-2 py-1 text-xs font-bold rounded-md ${planStyles[plan] || "bg-gray-200 text-gray-800"}`}
    >
      {planLabel[plan]}
    </span>
  );
};
