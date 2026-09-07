type PropsT = {
  heading: string;
  /** One sentence saying what the block below is, before it is read. */
  subtitle: string;
  children: React.ReactNode;
};

/**
 * A titled block of the page.
 *
 * Every section says what it is before it shows it. A map, a set of buttons and
 * a colored key are all things a reader can see but not name, and a page of
 * them with no headings is a page that has to be explained by whoever built it.
 */
export const Section = ({ heading, subtitle, children }: PropsT) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <h2 className="text-xs tracking-widest">{heading.toUpperCase()}</h2>
      <p className="text-sm max-w-2xl">{subtitle}</p>
    </div>
    {children}
  </section>
);
