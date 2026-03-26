export default function EvaluationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#162b46] min-h-screen antialiased">
      {children}
    </div>
  );
}
