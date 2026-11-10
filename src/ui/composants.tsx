/** Composants du design system « Herbier imprimé en risographie ». */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Illustration as NomIllustration } from '../domain/schema';
import { Icone, type NomIcone } from './Icone';

const ILLUS = import.meta.glob('./illustrations/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const urlIllustration = (nom: NomIllustration) => ILLUS[`./illustrations/${nom}.svg`];

/** Gros chiffre en double impression : copie rose décalée derrière l'encre (aria-hidden). */
export function Chiffre({ children, taille = 'm', className = '' }: { children: ReactNode; taille?: 'xl' | 'l' | 'm' | 's'; className?: string }) {
  return (
    <span className={`chiffre chiffre--${taille} ${className}`}>
      <span className="chiffre__rose" aria-hidden="true">
        {children}
      </span>
      <span className="chiffre__encre">{children}</span>
    </span>
  );
}

export function Puce({ children, variante = 'contour', icone }: { children: ReactNode; variante?: 'encre' | 'contour' | 'rose' | 'sauge' | 'menthe' | 'tirets'; icone?: NomIcone }) {
  return (
    <span className={`puce puce--${variante}`}>
      {icone && <Icone nom={icone} taille={15} />}
      {children}
    </span>
  );
}

export function Illustration({ nom, taille = 56, className = '' }: { nom: NomIllustration; taille?: number; className?: string }) {
  return <img className={`illus ${className}`} src={urlIllustration(nom)} width={taille} height={taille} alt="" decoding="async" />;
}

/** Étiquette de spécimen d'herbier : « Planche n° 12 · Dahl corail ». */
export function Etiquette({ numero, nom }: { numero: number; nom: string }) {
  return (
    <div className="etiquette">
      <span className="etiquette__planche">{numero ? `Planche n° ${numero}` : "Ma planche"}</span>
      <span className="etiquette__nom">{nom}</span>
    </div>
  );
}

/** Brin botanique décoratif (en-têtes) : trait encre, aplats décalés. */
export function Brin({ className = '' }: { className?: string }) {
  const feuilles = [
    { d: 'M62 40 C48 30 44 16 52 4 C64 14 66 28 62 40Z', f: 'var(--sauge)' },
    { d: 'M58 66 C40 62 30 50 32 36 C48 40 58 52 58 66Z', f: 'var(--sauge-pale)' },
    { d: 'M66 78 C80 68 94 68 104 76 C94 88 78 90 66 78Z', f: 'var(--abricot)' },
    { d: 'M54 98 C38 98 26 90 22 78 C38 74 50 84 54 98Z', f: 'var(--sauge-pale)' },
    { d: 'M64 112 C76 102 90 102 100 110 C90 122 74 122 64 112Z', f: 'var(--menthe)' },
  ];
  return (
    <svg className={`brin ${className}`} viewBox="0 0 110 170" aria-hidden="true" focusable="false">
      <g transform="translate(3 2)" style={{ mixBlendMode: 'multiply' }}>
        {feuilles.map((x, i) => (
          <path key={i} d={x.d} fill={x.f} />
        ))}
      </g>
      <g fill="none" stroke="var(--encre)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 168 C58 120 64 70 56 6" />
        {feuilles.map((x, i) => (
          <path key={i} d={x.d} />
        ))}
        <path d="M62 40 L53 8M58 66 L35 38M66 78 L100 76M54 98 L25 80M64 112 L97 110" strokeWidth="0.9" />
      </g>
    </svg>
  );
}

/** Fleuron d'imprimeur : petit brin couché avec aplats décalés, pour finir une page ou séparer. */
export function Fleuron({ className = '' }: { className?: string }) {
  return (
    <svg className={`fleuron ${className}`} viewBox="0 0 140 28" aria-hidden="true" focusable="false">
      <g style={{ mixBlendMode: 'multiply' }}>
        <path d="M70 14 C60 4 48 4 40 10 C48 18 60 20 70 14Z" fill="var(--sauge-pale)" transform="translate(2 2)" />
        <path d="M70 14 C80 4 92 4 100 10 C92 18 80 20 70 14Z" fill="var(--rose)" transform="translate(2 2)" />
      </g>
      <g fill="none" stroke="var(--encre)" strokeWidth="1.2" strokeLinecap="round">
        <path d="M70 14 C60 4 48 4 40 10 C48 18 60 20 70 14ZM70 14 C80 4 92 4 100 10 C92 18 80 20 70 14Z" />
        <path d="M44 11 L70 14 L96 11" strokeWidth="0.8" />
        <path d="M8 14h22M110 14h22" strokeDasharray="2 4" />
      </g>
      <g fill="var(--encre)">
        <circle cx="70" cy="14" r="2" />
        <circle cx="34" cy="14" r="1.2" />
        <circle cx="106" cy="14" r="1.2" />
      </g>
    </svg>
  );
}

/** Tampon encré légèrement penché (« Panier complet »). */
export function Tampon({ children }: { children: ReactNode }) {
  return (
    <p className="tampon-encre" role="status">
      <span>{children}</span>
    </p>
  );
}

/** Bouton + rond à l'encre : effet tampon au tap et petit tampon « gardée ! ». */
export function BoutonPlus({ actif, onBasculer, nom, clair = false }: { actif: boolean; onBasculer: () => void; nom: string; clair?: boolean }) {
  const [tampon, setTampon] = useState(0);
  return (
    <span className="plus-zone">
      <button
        type="button"
        className={`plus ${actif ? 'plus--actif' : ''} ${clair ? 'plus--clair' : ''}`}
        aria-pressed={actif}
        aria-label={actif ? `Retirer ${nom} des favoris` : `Garder ${nom} dans les favoris`}
        onClick={() => {
          if (!actif) setTampon((t) => t + 1);
          onBasculer();
        }}
      >
        <Icone nom={actif ? 'coche' : 'plus'} taille={24} />
      </button>
      {tampon > 0 && actif && (
        <span key={tampon} className="tampon" aria-hidden="true">
          gardée !
        </span>
      )}
    </span>
  );
}

export function BoutonIcone({ icone, label, onClick, href, variante = 'contour' }: { icone: NomIcone; label: string; onClick?: () => void; href?: string; variante?: 'contour' | 'plein' | 'nu' }) {
  const cls = `bouton-icone bouton-icone--${variante}`;
  if (href)
    return (
      <a className={cls} href={href} aria-label={label}>
        <Icone nom={icone} />
      </a>
    );
  return (
    <button type="button" className={cls} aria-label={label} onClick={onClick}>
      <Icone nom={icone} />
    </button>
  );
}

/** Filet en tirets. */
export const Filet = () => <hr className="filet" />;

/** Titre de section en petites capitales (Bricolage). */
export const Rubrique = ({ children, id }: { children: ReactNode; id?: string }) => (
  <h2 className="rubrique" id={id}>
    {children}
  </h2>
);

/** Feuille modale qui monte du bas de l'écran. */
export function Feuille({ titre, ouverte, fermer, children }: { titre: string; ouverte: boolean; fermer: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouverte) return;
    const prec = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    document.addEventListener('keydown', esc);
    document.body.classList.add('fige');
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.classList.remove('fige');
      prec?.focus?.();
    };
  }, [ouverte, fermer]);
  if (!ouverte) return null;
  return (
    <div className="feuille-fond" onClick={fermer}>
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="feuille__tete">
          <h2 className="feuille__titre">{titre}</h2>
          <BoutonIcone icone="fermer" label="Fermer" onClick={fermer} variante="nu" />
        </div>
        <div className="feuille__corps">{children}</div>
      </div>
    </div>
  );
}

export function Interrupteur({ actif, onChange, label, aide }: { actif: boolean; onChange: (v: boolean) => void; label: string; aide?: string }) {
  return (
    <label className="interrupteur">
      <span className="interrupteur__texte">
        <span>{label}</span>
        {aide && <small>{aide}</small>}
      </span>
      <input type="checkbox" role="switch" checked={actif} onChange={(e) => onChange(e.target.checked)} />
      <span className="interrupteur__piste" aria-hidden="true" />
    </label>
  );
}

export function Compteur({ valeur, min = 1, max = 12, onChange, label }: { valeur: number; min?: number; max?: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="compteur" role="group" aria-label={label}>
      <button type="button" aria-label="Moins" disabled={valeur <= min} onClick={() => onChange(valeur - 1)}>
        <Icone nom="moins" taille={18} />
      </button>
      <span aria-live="polite">{valeur}</span>
      <button type="button" aria-label="Plus" disabled={valeur >= max} onClick={() => onChange(valeur + 1)}>
        <Icone nom="plus" taille={18} />
      </button>
    </span>
  );
}

/** Message temporaire en bas d'écran, avec une action facultative (« Annuler »). */
type Annonce = { id: number; texte: string; action?: { libelle: string; faire: () => void }; duree: number };
let annonces: Annonce[] = [];
let suivant = 0;
const ecouteurs = new Set<() => void>();
const publier = () => ecouteurs.forEach((f) => f());

export function annoncer(texte: string, action?: Annonce['action'], duree = action ? 7000 : 3000) {
  const a = { id: ++suivant, texte, action, duree };
  annonces = [...annonces.slice(-1), a];
  publier();
  setTimeout(() => {
    annonces = annonces.filter((x) => x.id !== a.id);
    publier();
  }, duree);
}

export function Annonces() {
  const liste = useSyncExternalStore(
    (f) => (ecouteurs.add(f), () => ecouteurs.delete(f)),
    () => annonces,
  );
  return (
    <div className="annonces" role="status" aria-live="polite">
      {liste.map((a) => (
        <div className="annonce" key={a.id}>
          <span>{a.texte}</span>
          {a.action && (
            <button
              type="button"
              onClick={() => {
                a.action!.faire();
                annonces = annonces.filter((x) => x.id !== a.id);
                publier();
              }}
            >
              {a.action.libelle}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Chargement({ texte = 'Un instant…' }: { texte?: string }) {
  return (
    <div className="chargement" role="status">
      <Brin className="chargement__brin" />
      <p>{texte}</p>
    </div>
  );
}
