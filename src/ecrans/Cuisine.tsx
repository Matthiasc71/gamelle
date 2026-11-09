import { useEffect, useMemo, useRef, useState } from 'react';
import { BASE } from '../app/base';
import { useMenu, useReglages, useSemaineVue } from '../app/etat';
import { NOM_EQUIPEMENT, quantite } from '../app/presentation';
import { retour, useRoute } from '../app/routeur';
import { sessionDimanche } from '../domain/regles';
import { BoutonIcone, Feuille } from '../ui/composants';
import { Icone } from '../ui/Icone';

type EtapeCuisine = { texte: string; recette?: string; duree: number; equipement?: string; minuteur?: number };
type Minuteur = { id: number; libelle: string; fin: number; sonne?: boolean };

const CLE_MINUTEURS = 'gamelle.minuteurs';

/** Contexte audio créé au premier tap (iOS n'autorise le son qu'après un geste). */
let audio: AudioContext | null = null;
function debloquerSon() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio ??= new Ctx();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

export default function Cuisine() {
  const { id, params } = useRoute();
  const vue = useSemaineVue();
  const semaine = params.get('s') ?? vue.semaine;
  const reglages = useReglages();
  const session = id === 'session';
  const etat = useMenu(session ? semaine : '', session ? reglages : undefined);
  const r = id && !session ? BASE.parId[id] : undefined;
  const parts = Number(params.get('parts')) || r?.portions_base || 1;

  const etapes: EtapeCuisine[] | null = useMemo(() => {
    if (r)
      return r.etapes.map((e) => ({
        texte: e.texte,
        duree: e.duree_min,
        equipement: e.equipement && NOM_EQUIPEMENT[e.equipement],
        minuteur: e.minuteur_s ?? (!e.actif || e.en_fond ? Math.round(e.duree_min * 60) : undefined),
      }));
    if (session && etat.etat === 'pret')
      return [...sessionDimanche(etat.menu, BASE).etapes]
        .sort((a, b) => a.debut - b.debut)
        .map((e) => ({
          texte: e.texte,
          recette: BASE.parId[e.recetteId].nom,
          duree: Math.round(e.fin - e.debut),
          equipement: e.equipement && NOM_EQUIPEMENT[e.equipement],
          minuteur: !e.actif || e.enFond ? Math.round((e.fin - e.debut) * 60) : undefined,
        }));
    return null;
  }, [r, session, etat]);

  const titre = r ? r.nom : 'Session batch';
  const [i, setI] = useState(0);
  const [ingredients, setIngredients] = useState(false);
  const eveil = useEcranAllume();
  const { minuteurs, lancer, arreter, maintenant } = useMinuteurs();
  const touche = useRef<number | null>(null);

  useEffect(() => {
    const touches = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') setI((x) => Math.min((etapes?.length ?? 1) - 1, x + 1));
      if (ev.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', touches);
    return () => document.removeEventListener('keydown', touches);
  }, [etapes]);

  if (!etapes) return <main className="cuisine" />;
  const e = etapes[Math.min(i, etapes.length - 1)];
  const aller = (d: number) => setI((x) => Math.max(0, Math.min(etapes.length - 1, x + d)));

  return (
    <main
      className="cuisine"
      aria-labelledby="titre-cuisine"
      onTouchStart={(ev) => (touche.current = ev.touches[0].clientX)}
      onTouchEnd={(ev) => {
        if (touche.current === null) return;
        const dx = ev.changedTouches[0].clientX - touche.current;
        if (Math.abs(dx) > 60) aller(dx < 0 ? 1 : -1);
        touche.current = null;
      }}
    >
      <div className="cuisine__tete">
        <BoutonIcone icone="fermer" label="Quitter le mode cuisine" onClick={() => retour()} />
        <div className="cuisine__titre">
          <p className="kicker">
            Étape {i + 1} / {etapes.length}
          </p>
          <h1 id="titre-cuisine">{titre}</h1>
        </div>
        {r && (
          <button className="btn btn--contour btn--petit" onClick={() => setIngredients(true)}>
            Ingrédients
          </button>
        )}
      </div>
      {eveil && <p className="cuisine__eveil">{eveil}</p>}

      {minuteurs.length > 0 && (
        <ul className="minuteurs" aria-label="Minuteurs en cours">
          {minuteurs.map((m) => {
            const reste = Math.max(0, Math.round((m.fin - maintenant) / 1000));
            return (
              <li key={m.id} className={`minuteur ${reste === 0 ? 'minuteur--fini' : ''}`}>
                <Icone nom="minuteur" taille={18} />
                <span className="minuteur__temps" aria-live={reste === 0 ? 'assertive' : 'off'}>
                  {reste === 0 ? 'Fini !' : `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`}
                </span>
                <span className="minuteur__nom">{m.libelle}</span>
                <button className="bouton-icone bouton-icone--nu" aria-label="Arrêter le minuteur" onClick={() => arreter(m.id)}>
                  <Icone nom="fermer" taille={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <section className="cuisine__etape" aria-live="polite">
        <span className="cuisine__num" aria-hidden="true">
          {i + 1}
        </span>
        {e.recette && <p className="kicker">{e.recette}</p>}
        <p className="cuisine__texte">{e.texte}</p>
        <p className="etapes__meta">
          {e.duree} min{e.equipement ? ` · ${e.equipement}` : ''}
        </p>
        {e.minuteur && (
          <button className="btn btn--contour" onClick={() => lancer(`${e.recette ? `${e.recette.split(' ')[0]} · ` : ''}étape ${i + 1}`, e.minuteur!)}>
            <Icone nom="minuteur" taille={18} /> Minuteur {Math.round(e.minuteur / 60)} min
          </button>
        )}
      </section>

      <div className="cuisine__nav">
        <button className="btn btn--contour" onClick={() => aller(-1)} disabled={i === 0}>
          <Icone nom="retour" taille={20} /> Précédente
        </button>
        {i < etapes.length - 1 ? (
          <button className="btn btn--plein" onClick={() => aller(1)}>
            Suivante <Icone nom="suivant" taille={20} />
          </button>
        ) : (
          <button className="btn btn--plein" onClick={() => retour()}>
            Terminé
          </button>
        )}
      </div>

      {r && (
        <Feuille titre={`Ingrédients · ${parts} part${parts > 1 ? 's' : ''}`} ouverte={ingredients} fermer={() => setIngredients(false)}>
          <ul className="ingredients">
            {r.ingredients.map((ing) => (
              <li key={ing.ingredient + ing.nom_affiche}>
                <span>
                  <strong>{quantite(ing, parts / r.portions_base)}</strong> {ing.nom_affiche}
                </span>
              </li>
            ))}
          </ul>
        </Feuille>
      )}
    </main>
  );
}

/** Écran maintenu allumé (Screen Wake Lock), avec message de repli si indisponible. */
function useEcranAllume(): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let verrou: { release: () => Promise<void> } | null = null;
    let actif = true;
    const demander = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wl) throw new Error('indisponible');
        verrou = await wl.request('screen');
        if (actif) setMessage(null);
      } catch {
        if (actif) setMessage('L’écran ne peut pas rester allumé ici : touche-le de temps en temps (iOS 18.4 et plus, depuis l’écran d’accueil).');
      }
    };
    const visibilite = () => document.visibilityState === 'visible' && demander();
    demander();
    document.addEventListener('visibilitychange', visibilite);
    return () => {
      actif = false;
      document.removeEventListener('visibilitychange', visibilite);
      verrou?.release().catch(() => {});
    };
  }, []);
  return message;
}

/** Minuteurs horodatés : ils survivent au verrouillage et au rechargement. Son et vibration à la fin. */
function useMinuteurs() {
  const [minuteurs, setMinuteurs] = useState<Minuteur[]>(() => {
    try {
      // les minuteurs finis depuis plus d'une heure sont oubliés
      return (JSON.parse(localStorage.getItem(CLE_MINUTEURS) ?? '[]') as Minuteur[]).filter((m) => m.fin > Date.now() - 3600e3);
    } catch {
      return [];
    }
  });
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    try {
      localStorage.setItem(CLE_MINUTEURS, JSON.stringify(minuteurs));
    } catch {
      /* stockage indisponible : les minuteurs restent en mémoire */
    }
  }, [minuteurs]);
  useEffect(() => {
    if (!minuteurs.length) return;
    const t = setInterval(() => setMaintenant(Date.now()), 500);
    const reveil = () => setMaintenant(Date.now());
    document.addEventListener('visibilitychange', reveil);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', reveil);
    };
  }, [minuteurs.length]);
  useEffect(() => {
    const finis = minuteurs.filter((m) => !m.sonne && m.fin <= maintenant);
    if (!finis.length) return;
    sonner();
    setMinuteurs((ms) => ms.map((m) => (finis.some((f) => f.id === m.id) ? { ...m, sonne: true } : m)));
  }, [maintenant, minuteurs]);
  return {
    minuteurs,
    maintenant,
    lancer: (libelle: string, secondes: number) => {
      debloquerSon();
      setMaintenant(Date.now());
      setMinuteurs((ms) => [...ms, { id: Date.now(), libelle, fin: Date.now() + secondes * 1000 }]);
    },
    arreter: (id: number) => setMinuteurs((ms) => ms.filter((m) => m.id !== id)),
  };
}

function sonner() {
  try {
    debloquerSon();
    const ctx = audio;
    if (!ctx) throw new Error('pas de son');
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    /* pas de son disponible */
  }
  navigator.vibrate?.([200, 100, 200]);
}
