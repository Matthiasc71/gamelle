/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:gamelle-donnees' {
  import type { IngredientCatalogue, PrixReference, Recette } from './domain/schema';
  const donnees: {
    recettes: Recette[];
    catalogue: Record<string, Omit<IngredientCatalogue, 'ciqual_nom' | 'note'>>;
    prix: Record<string, PrixReference>;
    ciqual: Record<string, [string, string, ...(number | null)[]]>;
  };
  export default donnees;
}
