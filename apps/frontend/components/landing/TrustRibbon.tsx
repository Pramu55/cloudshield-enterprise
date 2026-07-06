export function TrustRibbon() {
  const techs = [
    "Next.js", "React Server Components", "TypeScript", 
    "PostgreSQL", "Redis", "Docker", "BullMQ", 
    "AWS SDK v2", "Prisma", "Node.js"
  ];

  return (
    <section className="border-y border-white/5 bg-[#0d1320] py-8">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs font-semibold text-gray-500 uppercase tracking-widest mb-6">
          Powered by industry-standard enterprise technologies
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60">
          {techs.map((tech, index) => (
            <div key={index} className="text-gray-400 font-bold text-lg tracking-tight hover:text-white transition-colors cursor-default">
              {tech}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
