// Produits réels de l'épicerie (liste du 2 octobre 2026).
// Prix de vente = prix public. Prix d'achat = privé, visible seulement dans l'admin.
// Photos : prisma/images-epicerie/<référence>.png, tirées du catalogue Impex « Seco 2025 ».

export type EpicerieProduct = {
  ref: string;
  name: string;
  brand: string;
  category: [string, string]; // [catégorie, sous-catégorie]
  country: string; // code ISO
  storage?: "AMBIENT" | "CHILLED" | "FROZEN";
  weight?: number;
  volume?: number;
  packaging?: string;
  price: string;
  cost?: string;
  tags: string;
  description: string;
};

export const categories: { name: string; description: string; order: number; children: string[] }[] = [
  { name: "Épicerie sèche", description: "Farines, cafés, sauces, épices et douceurs d'Amérique latine.", order: -20, children: ["Farines & maïs", "Cafés & maté", "Sauces & épices", "Sucre & desserts"] },
  { name: "Boissons", description: "Alcools et boissons d'Amérique latine.", order: -10, children: ["Alcools"] },
];

export const products: EpicerieProduct[] = [
  {
    ref: "01276", name: "Pisco Acholado", brand: "Ocucaje", category: ["Boissons", "Alcools"], country: "PE",
    volume: 700, packaging: "Bouteille", price: "22", cost: "13,85", tags: "alcool, pisco sour, eau-de-vie",
    description: "Pisco péruvien, eau-de-vie de raisin. La base du pisco sour.",
  },
  {
    ref: "00044", name: "Aguardiente Antioqueño sans sucre", brand: "Antioqueño", category: ["Boissons", "Alcools"], country: "CO",
    volume: 700, packaging: "Bouteille", price: "22", cost: "10,97", tags: "alcool, anis, guaro",
    description: "L'eau-de-vie anisée colombienne, version sans sucre ajouté (étiquette bleue).",
  },
  {
    ref: "00469", name: "Tajín", brand: "Tajín", category: ["Épicerie sèche", "Sauces & épices"], country: "MX",
    weight: 142, packaging: "Flacon saupoudreur", price: "6", cost: "3,17", tags: "piment, citron vert, assaisonnement, chamoy",
    description: "Assaisonnement mexicain au piment, citron vert et sel. Sur la mangue, l'ananas, le concombre, le maïs ou le bord des verres.",
  },
  {
    ref: "00087", name: "Sauce piquante Valentina", brand: "Valentina", category: ["Épicerie sèche", "Sauces & épices"], country: "MX",
    volume: 370, packaging: "Bouteille", price: "5", cost: "1,81", tags: "sauce piquante, piment",
    description: "La sauce piquante mexicaine classique, étiquette jaune. Sur les tacos, les chips, les œufs.",
  },
  {
    ref: "00033", name: "Panela", brand: "Coexito", category: ["Épicerie sèche", "Sucre & desserts"], country: "CO",
    weight: 454, packaging: "Pain", price: "5", tags: "sucre de canne, aguapanela, rapadura",
    description: "Sucre de canne complet non raffiné, en pain. Pour l'aguapanela, les jus et les desserts.",
  },
  {
    ref: "00415", name: "Maïs chulpe", brand: "América", category: ["Épicerie sèche", "Farines & maïs"], country: "PE",
    weight: 500, packaging: "Sachet", price: "5", tags: "cancha, maïs à griller, ceviche",
    description: "Maïs andin à griller : à la poêle avec un peu d'huile et de sel, il devient croustillant. Accompagne le ceviche.",
  },
  {
    ref: "00014", name: "Harina P.A.N. blanche", brand: "P.A.N.", category: ["Épicerie sèche", "Farines & maïs"], country: "VE",
    weight: 1000, packaging: "Paquet", price: "4", cost: "2,08", tags: "farine de maïs, arepa, harina pan",
    description: "Farine de maïs blanc précuite, pour arepas, empanadas et hallacas.",
  },
  {
    ref: "00241", name: "Pâte d'ají amarillo", brand: "Del Huerto", category: ["Épicerie sèche", "Sauces & épices"], country: "PE",
    weight: 212, packaging: "Bocal", price: "5", cost: "2", tags: "piment jaune, pasta de ají, ají de gallina, causa",
    description: "Purée de piment jaune péruvien. La base de l'ají de gallina, de la causa et de nombreuses sauces.",
  },
  {
    ref: "00721", name: "Gelée à la fraise", brand: "Universal", category: ["Épicerie sèche", "Sucre & desserts"], country: "PE",
    weight: 250, packaging: "Sachet", price: "5", cost: "2,56", tags: "gelatina, dessert",
    description: "Préparation pour gelée parfum fraise.",
  },
  {
    ref: "02801", name: "Yerba maté Mañanita", brand: "Mañanita", category: ["Épicerie sèche", "Cafés & maté"], country: "AR",
    weight: 500, packaging: "Paquet", price: "10", cost: "3", tags: "mate, yerba, infusion",
    description: "Yerba maté argentine, à infuser dans la calebasse avec la bombilla.",
  },
  {
    ref: "02085", name: "Café moulu Cumbre", brand: "Juan Valdez", category: ["Épicerie sèche", "Cafés & maté"], country: "CO",
    weight: 250, packaging: "Paquet", price: "15", cost: "7", tags: "café colombien, café moulu",
    description: "Café 100 % colombien, moulu.",
  },
];
