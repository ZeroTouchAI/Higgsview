// Higgsfield-style slanted badges (colors sampled from higgsfield.ai menus).
const STYLE: Record<string, string> = {
  TOP: "text-white [background-image:linear-gradient(90deg,rgb(50,89,180)_0%,rgb(60,140,255)_50%,rgb(0,200,210)_75%,rgb(120,201,230)_100%)]",
  PRO: "text-white [background-image:radial-gradient(39.71%_136.54%_at_51.64%_117.31%,#F920D1_0%,#ED1572_100%)]",
  TRENDING: "text-white [background-image:radial-gradient(39.71%_136.54%_at_51.64%_117.31%,#F920D1_0%,#ED1572_100%)]",
  CHEAP: "text-white [background-image:radial-gradient(39.71%_136.54%_at_51.64%_117.31%,#F920D1_0%,#ED1572_100%)]",
  NEW: "bg-lime text-[#131517]",
  FREE: "bg-lime text-[#131517]",
};

export default function Badge({ label, className = "" }: { label?: string; className?: string }) {
  if (!label) return null;
  return (
    <span className={`inline-block -skew-x-12 rounded-sm px-1.5 text-[10px] leading-4 font-bold whitespace-nowrap uppercase ${STYLE[label.toUpperCase()] ?? STYLE.NEW} ${className}`}>
      {label}
    </span>
  );
}
