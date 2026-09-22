import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, Button } from '@mch/ui-v2';

export const dynamic = 'force-dynamic';

const TIERS: Array<{
  id: 'club' | 'prestige' | 'elite';
  price: string;
  perks: string[];
  highlighted?: boolean;
}> = [
  {
    id: 'club',
    price: 'Gratuit',
    perks: ['Accès catalogue complet', 'Conseils du Concierge', 'Newsletter insider'],
  },
  {
    id: 'prestige',
    price: 'Sur invitation',
    perks: ["Tarifs membres jusqu'à -25 %", 'Upgrades prioritaires', 'Concierge dédié'],
    highlighted: true,
  },
  {
    id: 'elite',
    price: 'Sur candidature',
    perks: ['Avantages propriétés partenaires', 'Accès événements privés', 'Ligne directe 24/7'],
  },
];

export default async function MemberProgramPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('memberProgram');

  return (
    <div className="ui-v2-container py-8">
      <header className="mb-10 max-w-2xl">
        <h1>{t('title')}</h1>
        <p className="mt-3 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <article
            key={tier.id}
            className={`flex flex-col rounded-sm border p-6 ${
              tier.highlighted === true
                ? 'border-[var(--color-gold-600)] bg-[var(--color-surface-container-low)] shadow-[var(--shadow-card-hover)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-card)]'
            }`}
          >
            {tier.highlighted === true ? (
              <Badge variant="gold" className="mb-4 self-start">
                Recommandé
              </Badge>
            ) : null}
            <h2 className="font-serif text-xl">{t(tier.id)}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--color-action)]">{tier.price}</p>
            <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm">
              {tier.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span aria-hidden className="text-[var(--color-gold-600)]">
                    ✓
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-6 w-full">
              En savoir plus
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
