import Image from 'next/image';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Logo preview (interne)',
  robots: { index: false, follow: false },
};

const LOGO_SRC = '/logos/logo-dark.png';
const LOGO_W = 1024;
const LOGO_H = 1024;

interface FrameProps {
  readonly title: string;
  readonly description: string;
  readonly bg: string;
  readonly children: React.ReactNode;
}

function Frame({ title, description, bg, children }: FrameProps): React.ReactElement {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="font-serif text-lg text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500">{description}</p>
      </header>
      <div className={`overflow-hidden rounded-md ${bg}`}>{children}</div>
    </section>
  );
}

export default function LogoPreviewPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-500">
          Page interne — noindex
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Logo preview · MyConciergeHotel</h1>
        <p className="mt-2 max-w-3xl text-neutral-600">
          Test du nouveau logo (chapeau haut-de-forme doré + wordmark) sur les 7 surfaces où il sera
          utilisé. Source : <code className="text-sm">{LOGO_SRC}</code> (1024×1024, version dark
          mode fournie par le PO).
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Frame
          title="1. Header — fond noir (variante dark, version PO)"
          description="Le logo rend parfaitement sur fond sombre. Hauteur header = 80px, logo ≈ 56px."
          bg="bg-black"
        >
          <div className="flex h-20 items-center px-6">
            <Image
              src={LOGO_SRC}
              alt="MyConciergeHotel"
              width={LOGO_W}
              height={LOGO_H}
              className="h-14 w-auto"
              priority
            />
          </div>
        </Frame>

        <Frame
          title="2. Header — fond crème (variante actuelle prod)"
          description="Sur fond clair, le wordmark blanc disparaît. Démontre le besoin d'une version light (texte noir + chapeau doré sur transparent)."
          bg="bg-[#fafaf8]"
        >
          <div className="flex h-20 items-center px-6">
            <Image
              src={LOGO_SRC}
              alt="MyConciergeHotel"
              width={LOGO_W}
              height={LOGO_H}
              className="h-14 w-auto"
            />
          </div>
        </Frame>

        <Frame
          title="3. Header — fond crème + CSS invert (palliatif)"
          description="Filter CSS qui inverse le PNG. Pas idéal (le doré devient bleu), confirme qu'il faut une version light vectorielle."
          bg="bg-[#fafaf8]"
        >
          <div className="flex h-20 items-center px-6">
            <Image
              src={LOGO_SRC}
              alt="MyConciergeHotel"
              width={LOGO_W}
              height={LOGO_H}
              className="h-14 w-auto invert"
            />
          </div>
        </Frame>

        <Frame
          title="4. Footer — fond noir (le site a déjà un footer sombre)"
          description="Cas d'usage natural pour la variante dark mode actuelle."
          bg="bg-neutral-950"
        >
          <div className="flex h-32 items-center justify-center px-6">
            <Image
              src={LOGO_SRC}
              alt="MyConciergeHotel"
              width={LOGO_W}
              height={LOGO_H}
              className="h-20 w-auto"
            />
          </div>
        </Frame>

        <Frame
          title="5. Hero overlay (fond photo, lecture facile)"
          description="Le logo en overlay sur une image lifestyle — usage potentiel sur la home ou pages éditoriales premium."
          bg="bg-gradient-to-br from-[#3a2e25] via-[#2b1f15] to-[#0a0807]"
        >
          <div className="flex h-48 items-center justify-center px-6">
            <Image
              src={LOGO_SRC}
              alt="MyConciergeHotel"
              width={LOGO_W}
              height={LOGO_H}
              className="h-32 w-auto"
            />
          </div>
        </Frame>

        <Frame
          title="6. Favicon — 16 / 32 / 48 px sur fond noir"
          description="À ces tailles, le chapeau doré reste-t-il lisible ? (PNG plein, non vectorisé — un SVG monochrome serait plus net)."
          bg="bg-black"
        >
          <div className="flex h-32 items-end justify-around px-6 pb-4">
            <div className="flex flex-col items-center gap-2">
              <Image
                src={LOGO_SRC}
                alt="favicon 16"
                width={LOGO_W}
                height={LOGO_H}
                className="h-4 w-4"
              />
              <span className="text-xs text-neutral-400">16px</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Image
                src={LOGO_SRC}
                alt="favicon 32"
                width={LOGO_W}
                height={LOGO_H}
                className="h-8 w-8"
              />
              <span className="text-xs text-neutral-400">32px</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Image
                src={LOGO_SRC}
                alt="favicon 48"
                width={LOGO_W}
                height={LOGO_H}
                className="h-12 w-12"
              />
              <span className="text-xs text-neutral-400">48px</span>
            </div>
          </div>
        </Frame>

        <Frame
          title="7. OG image preview — 1200×630 (LinkedIn, X, Slack)"
          description="Format Open Graph standard. Logo centré sur fond noir avec un peu de contexte tagline."
          bg="bg-black"
        >
          <div className="relative flex aspect-[1200/630] w-full flex-col items-center justify-center gap-4 px-12">
            <Image
              src={LOGO_SRC}
              alt="OG preview"
              width={LOGO_W}
              height={LOGO_H}
              className="h-2/3 w-auto"
            />
            <p className="text-center text-xs font-medium uppercase tracking-[0.3em] text-amber-200/60">
              Book like a concierge · Stay like a guest
            </p>
          </div>
        </Frame>

        <Frame
          title="8. Bonus — Email transactionnel (Brevo / Resend header)"
          description="Le header d'un email de réservation. Fond noir = parfaitement compatible."
          bg="bg-black"
        >
          <div className="flex h-24 items-center justify-center">
            <Image
              src={LOGO_SRC}
              alt="email header"
              width={LOGO_W}
              height={LOGO_H}
              className="h-16 w-auto"
            />
          </div>
        </Frame>
      </div>

      <footer className="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h3 className="font-serif text-lg text-amber-900">Décisions à prendre avant intégration</h3>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-amber-900">
          <li>
            <strong>Variante light obligatoire ?</strong> Le header actuel du site est sur fond
            crème ; il faut une version avec texte noir (chapeau peut rester doré) sur transparent.
            Sinon on doit changer le fond du header en noir.
          </li>
          <li>
            <strong>Format vectoriel (SVG) ?</strong> Le PNG fourni est 1024×1024 = ~55 KB. Un SVG
            serait plus net à toutes les tailles (favicon, retina, print) et &lt;5 KB.
          </li>
          <li>
            <strong>Favicon dédié ?</strong> À 16×16, seul le chapeau reste visible. Il faut une
            variante &quot;mark only&quot; (le chapeau seul sans wordmark) pour les favicons et
            l&apos;app icon iOS/Android.
          </li>
          <li>
            <strong>Périmètre de remplacement ?</strong> Header / Footer / Favicon / OG image /
            Emails Brevo / Manifest PWA — tout d&apos;un coup, ou progressif ?
          </li>
        </ul>
      </footer>
    </main>
  );
}
