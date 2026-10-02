// Données de démonstration. Les PRIX SONT FICTIFS (isExample = true) :
// ils ne reprennent pas les tarifs fournisseur et seront remplacés par les vôtres.
// Les références et les photos viennent du catalogue Impex « Refrigerados y Congelados 2025 ».

export const countries = [
  ["Colombie", "CO"], ["Pérou", "PE"], ["Mexique", "MX"], ["Brésil", "BR"], ["Argentine", "AR"],
  ["Venezuela", "VE"], ["Équateur", "EC"], ["Paraguay", "PY"], ["Chili", "CL"], ["République dominicaine", "DO"],
  ["Bolivie", "BO"], ["Honduras", "HN"], ["Guatemala", "GT"], ["Salvador", "SV"], ["Cuba", "CU"], ["Espagne", "ES"],
] as const;

export const categories: { name: string; description: string; children?: string[] }[] = [
  { name: "Arepas & galettes", description: "Arepas de maïs blanc ou jaune, nature ou fourrées." },
  { name: "Pulpes & fruits", description: "Pulpes de fruits surgelées pour jus et desserts, fruits entiers.", children: ["Pulpes de fruits", "Fruits entiers"] },
  { name: "Légumes & tubercules", description: "Yuca, maïs, papa criolla, plantains, piments." },
  { name: "Boulangerie & en-cas", description: "Pandebonos, buñuelos, empanadas, tequeños, à cuire chez soi." },
  { name: "Charcuterie", description: "Chorizos, salamis et viandes fumées." },
  { name: "Fromages & crèmes", description: "Fromages frais latino-américains et nata." },
  { name: "Glaces", description: "Glaces aux fruits tropicaux." },
  { name: "Épicerie sèche", description: "Farines, cafés, sauces, épices.", children: ["Farines", "Cafés", "Sauces & épices"] },
];

type Demo = {
  ref: string;
  name: string;
  brand?: string;
  category: string;
  country?: string;
  storage: "AMBIENT" | "CHILLED" | "FROZEN";
  weight?: number;
  units?: number;
  packaging?: string;
  price: string;
  promo?: string;
  case?: [number, string];
  kg?: boolean;
  featured?: boolean;
  isNew?: boolean;
  available?: boolean;
  tags?: string;
  description?: string;
};

export const products: Demo[] = [
  { ref: "00113", name: "Arepas blanches", brand: "La Victoria", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 5, packaging: "Paquet de 5", price: "3,20", case: [25, "72,00"], featured: true, tags: "arepa, maïs blanc", description: "Arepas de maïs blanc précuites. À dorer 4 minutes de chaque côté à la poêle ou au grille-pain." },
  { ref: "00920", name: "Arepas jaunes", brand: "La Victoria", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 5, packaging: "Paquet de 5", price: "3,20", case: [25, "72,00"], tags: "arepa, maïs jaune" },
  { ref: "00467", name: "Arepas au fromage", brand: "La Victoria", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 4, packaging: "Paquet de 4", price: "4,90", promo: "3,99", tags: "arepa, queso, fromage", featured: true, description: "Arepas fourrées au fromage fondant." },
  { ref: "00401", name: "Arepas de yuca au fromage", brand: "La Victoria", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 4, packaging: "Paquet de 4", price: "4,90", tags: "arepa, yuca, manioc, fromage" },
  { ref: "01487", name: "Arepas au beurre", brand: "La Victoria", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 5, packaging: "Paquet de 5", price: "3,40", tags: "arepa, mantequilla" },
  { ref: "00466", name: "Petites arepas", brand: "La Victoria", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 12, packaging: "Paquet de 12", price: "3,30", tags: "arepa, apéritif" },
  { ref: "00180", name: "Arepas blanches", brand: "Goya", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 5, packaging: "Paquet de 5", price: "3,40", tags: "arepa" },
  { ref: "01079", name: "Arepas de choclo", brand: "Goya", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 4, packaging: "Paquet de 4", price: "4,40", isNew: true, tags: "arepa, maïs doux, choclo" },
  { ref: "02898", name: "Arepas au chicharrón", brand: "Campesino", category: "Arepas & galettes", country: "CO", storage: "FROZEN", units: 5, packaging: "Paquet de 5", price: "5,50", isNew: true, tags: "arepa, porc" },

  { ref: "00102", name: "Pulpe de maracuyá", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 90, packaging: "Sachet individuel", price: "1,40", case: [20, "25,00"], featured: true, tags: "fruit de la passion, jus, pulpa", description: "Pulpe 100 % fruit, sans sucre ajouté. Un sachet = un grand verre de jus : mixez avec 250 ml d'eau ou de lait." },
  { ref: "00116", name: "Pulpe de maracuyá", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 250, packaging: "Sachet", price: "3,30", tags: "fruit de la passion, jus, pulpa" },
  { ref: "00103", name: "Pulpe de guanábana", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 90, packaging: "Sachet individuel", price: "1,40", tags: "corossol, jus, pulpa" },
  { ref: "00105", name: "Pulpe de mangue", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 90, packaging: "Sachet individuel", price: "1,00", tags: "mango, jus, pulpa" },
  { ref: "00108", name: "Pulpe de mora", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 90, packaging: "Sachet individuel", price: "1,10", promo: "0,89", tags: "mûre, jus, pulpa" },
  { ref: "00109", name: "Pulpe de lulo", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 90, packaging: "Sachet individuel", price: "1,10", tags: "naranjilla, jus, pulpa" },
  { ref: "00104", name: "Pulpe de tomate d'arbre", brand: "Canoa", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 90, packaging: "Sachet individuel", price: "1,10", tags: "tamarillo, tomate de árbol, pulpa" },
  { ref: "02703", name: "Pulpe de maracuyá", brand: "SAS", category: "Pulpes de fruits", country: "CO", storage: "FROZEN", weight: 1000, units: 10, packaging: "Boîte de 10 sachets de 100 g", price: "9,90", tags: "fruit de la passion, pulpa" },
  { ref: "01116", name: "Pulpe d'açaí premium bio", brand: "Coraçai", category: "Pulpes de fruits", country: "BR", storage: "FROZEN", weight: 400, units: 4, packaging: "4 sachets de 100 g", price: "6,90", isNew: true, featured: true, tags: "açaí, bio, smoothie bowl", description: "Pulpe d'açaí biologique, 14 % de matière sèche. Idéale pour les açaí bowls." },
  { ref: "01121", name: "Pulpe de pitaya bio", brand: "Coraçai", category: "Pulpes de fruits", country: "BR", storage: "FROZEN", weight: 400, units: 4, packaging: "4 sachets de 100 g", price: "7,20", isNew: true, tags: "fruit du dragon, bio" },
  { ref: "00225", name: "Mûres entières", brand: "Canoa", category: "Fruits entiers", country: "CO", storage: "FROZEN", weight: 500, packaging: "Sachet", price: "4,20", tags: "mora, mûre" },
  { ref: "00392", name: "Maracuyá entier", category: "Fruits entiers", country: "EC", storage: "FROZEN", weight: 1000, packaging: "Sachet", price: "6,50", tags: "fruit de la passion" },

  { ref: "00051", name: "Yuca en morceaux", brand: "Coexito", category: "Légumes & tubercules", country: "CO", storage: "FROZEN", weight: 500, packaging: "Sachet", price: "2,40", featured: true, tags: "manioc, yuca", description: "Manioc épluché et coupé, prêt à cuire : à l'eau 20 minutes puis frit ou en purée." },
  { ref: "02158", name: "Frites de yuca", brand: "Goya", category: "Légumes & tubercules", country: "CO", storage: "FROZEN", weight: 454, packaging: "Sachet", price: "4,90", tags: "manioc, frites, palitos" },
  { ref: "00008", name: "Papa criolla", brand: "Goya", category: "Légumes & tubercules", country: "CO", storage: "FROZEN", weight: 400, packaging: "Sachet", price: "4,60", tags: "pomme de terre jaune, ajiaco" },
  { ref: "00007", name: "Maïs égrené (choclo)", brand: "Sabor y Sazón", category: "Légumes & tubercules", country: "PE", storage: "FROZEN", weight: 500, packaging: "Sachet", price: "4,70", tags: "choclo, maïs géant" },
  { ref: "00635", name: "Ají amarillo entier", brand: "Sabor y Sazón", category: "Légumes & tubercules", country: "PE", storage: "FROZEN", weight: 500, packaging: "Sachet", price: "5,20", tags: "piment, ají, causa, lomo saltado" },
  { ref: "02170", name: "Plantain vert", brand: "Coexito", category: "Légumes & tubercules", country: "CO", storage: "FROZEN", weight: 1000, packaging: "Sachet", price: "5,60", tags: "plátano, banane plantain" },
  { ref: "03075", name: "Patacones", category: "Légumes & tubercules", country: "EC", storage: "FROZEN", weight: 500, packaging: "Sachet", price: "4,80", promo: "3,90", tags: "plantain, tostones", description: "Plantains verts aplatis et précuits : 3 minutes de friture et c'est prêt." },
  { ref: "02445", name: "Mélange pour ajiaco", brand: "Coexito", category: "Légumes & tubercules", country: "CO", storage: "FROZEN", weight: 1000, packaging: "Sachet", price: "6,90", tags: "soupe, ajiaco, papa criolla" },

  { ref: "02460", name: "Pandebonos", brand: "PanPaYa", category: "Boulangerie & en-cas", country: "CO", storage: "FROZEN", units: 6, packaging: "Sachet de 6", price: "8,90", featured: true, tags: "pain au fromage, petit-déjeuner", description: "Petits pains au fromage et à l'amidon de manioc. 15 minutes au four, sans décongélation." },
  { ref: "02461", name: "Almojábanas", brand: "PanPaYa", category: "Boulangerie & en-cas", country: "CO", storage: "FROZEN", units: 6, packaging: "Sachet de 6", price: "9,40", tags: "pain au fromage" },
  { ref: "02485", name: "Buñuelos", brand: "PanPaYa", category: "Boulangerie & en-cas", country: "CO", storage: "FROZEN", units: 6, packaging: "Sachet de 6", price: "9,60", promo: "7,90", tags: "beignet au fromage, noël" },
  { ref: "02724", name: "Tequeños au fromage", brand: "Paisa", category: "Boulangerie & en-cas", country: "VE", storage: "FROZEN", units: 8, packaging: "Sachet de 8", price: "6,90", featured: true, tags: "apéritif, fromage, tequeño" },
  { ref: "01368", name: "Empanadas au bœuf", brand: "Tosty Fri", category: "Boulangerie & en-cas", country: "CO", storage: "FROZEN", units: 6, packaging: "Sachet de 6", price: "8,50", tags: "empanada, carne" },
  { ref: "01369", name: "Empanadas au poulet", brand: "Tosty Fri", category: "Boulangerie & en-cas", country: "CO", storage: "FROZEN", units: 6, packaging: "Sachet de 6", price: "8,50", tags: "empanada, pollo" },
  { ref: "01786", name: "Yuquesos (pão de queijo)", brand: "Gaudir", category: "Boulangerie & en-cas", country: "BR", storage: "FROZEN", weight: 500, packaging: "Sachet", price: "8,90", isNew: true, tags: "pain au fromage, pão de queijo" },

  { ref: "00818", name: "Chorizo traditionnel", brand: "La Victoria", category: "Charcuterie", country: "CO", storage: "FROZEN", weight: 465, units: 5, packaging: "Paquet de 5", price: "7,50", tags: "chorizo, barbecue" },
  { ref: "00544", name: "Chorizo Sabrosito", brand: "Sabrosito", category: "Charcuterie", country: "CO", storage: "FROZEN", units: 5, packaging: "Paquet de 5", price: "7,40", available: false, tags: "chorizo" },
  { ref: "01604", name: "Salami Quisqueya", brand: "Induveca", category: "Charcuterie", country: "DO", storage: "CHILLED", weight: 500, packaging: "Pièce", price: "7,30", tags: "salami, dominicain, mangú" },

  { ref: "00166", name: "Fromage frais campesino", brand: "Campesino", category: "Fromages & crèmes", country: "CO", storage: "CHILLED", weight: 300, packaging: "Barquette", price: "4,30", tags: "queso fresco, campesino" },
  { ref: "00305", name: "Fromage frais campesino à la coupe", brand: "Campesino", category: "Fromages & crèmes", country: "CO", storage: "CHILLED", kg: true, price: "13,90", tags: "queso fresco" },
  { ref: "00374", name: "Fromage costeño", brand: "Campesino", category: "Fromages & crèmes", country: "CO", storage: "CHILLED", weight: 300, packaging: "Barquette", price: "4,50", tags: "queso costeño, salé" },
  { ref: "00185", name: "Crème aigre latino-américaine", brand: "Campesino", category: "Fromages & crèmes", storage: "CHILLED", weight: 450, packaging: "Pot", price: "5,40", tags: "nata ácida, crème" },

  { ref: "00787", name: "Glace à la mûre", brand: "La Quindianita", category: "Glaces", country: "CO", storage: "FROZEN", weight: 110, packaging: "Bâtonnet", price: "1,90", case: [30, "49,00"], tags: "helado, mora" },
  { ref: "00778", name: "Glace à la noix de coco", brand: "La Quindianita", category: "Glaces", country: "CO", storage: "FROZEN", weight: 110, packaging: "Bâtonnet", price: "1,90", case: [30, "49,00"], tags: "helado, coco" },
  { ref: "00782", name: "Glace au maracuyá", brand: "La Quindianita", category: "Glaces", country: "CO", storage: "FROZEN", weight: 110, packaging: "Bâtonnet", price: "1,90", promo: "1,50", case: [30, "49,00"], tags: "helado, fruit de la passion" },
];
