// Source unique des pôles bénévoles : utilisée par les deux forums de fiches
// (coordination-referents côté référents, fiches-missions côté bénévoles).
// Les modifier ici, jamais dans un seul des deux scripts.
//
// tag        : nom du tag dans les deux forums (doit exister dans config.ts)
// titre      : nom du sujet créé dans le forum
// referents  : qui pilote le pôle, affiché en tête du sujet
// texte      : le pôle en une phrase, avant la fiche détaillée
// fichiers   : base des noms de PDF (Fiche-Benevole-<base>.pdf, Fiche-Referent-<base>.pdf)
// benevoleSeul : pas de fiche référent pour ce pôle

export const POLES = [
  { tag: "Bar", titre: "🍺 Bar", referents: "Malo, Matthieu, Mathilde", fichiers: ["Bar"],
    texte: "Servir vite et bien, encaisser, tenir le stand propre. Verre témoin pour le vin, appli caisse pour les calculs." },
  { tag: "Billetterie / Accueil", titre: "🎫 Billetterie / Accueil", referents: "Rémi, Oswald", fichiers: ["Billetterie-Accueil"],
    texte: "Premier contact du public : scanner, poser le bracelet, orienter. Jamais seul au poste." },
  { tag: "Cashless", titre: "🪙 Cashless", referents: "Mathieu, Nicolas", fichiers: ["Cashless"],
    texte: "Vendre les tickets, tenir la caisse. Tickets valables sur tous les bars, jamais remboursés." },
  { tag: "Déconsigne", titre: "♻️ Déconsigne", referents: "Natanaël", fichiers: ["Deconsigne"],
    texte: "Récupérer les gobelets, rembourser sur preuve, réapprovisionner les bars. Trois gobelets max par personne." },
  { tag: "Gestion du site", titre: "🧹 Gestion du site", referents: "Clément", fichiers: ["Gestion-Site"],
    texte: "Tours réguliers, propreté, signalétique, sécurité. On signale, on ne manipule jamais seul le matériel technique." },
  { tag: "Loges", titre: "🎤 Loges", referents: "Pauline", fichiers: ["Loges"],
    texte: "Accueillir les artistes, catering, propreté, contrôle des accès. Pas de photos, pas d'autographes." },
  { tag: "Merch", titre: "👕 Merch", referents: "Lucien, Angéline", fichiers: ["Merch"],
    texte: "Vendre, conseiller, tenir le stock et la caisse. Appli merch pour valider chaque vente." },
  { tag: "Prévention", titre: "💚 Prévention (RDR / VSS)", referents: "Sasha", fichiers: ["Prevention"],
    texte: "Informer et accompagner sans juger, distribuer le matériel de prévention. Code radio pour les situations VSS, confidentialité totale." },
  { tag: "Runs", titre: "🚗 Runs", referents: "Julien", fichiers: ["Runs"],
    texte: "Transport des artistes : gare, hôtel, sites. Confirmer le point de RDV, garder de la marge, zéro alcool. Canal talkie 4." },
  { tag: "Volant", titre: "🔁 Volant", referents: "Eloïse, Sasha", fichiers: ["Volant"], benevoleSeul: true,
    texte: "Renfort mobile, envoyé là où il manque quelqu'un. Se place sous les consignes du référent du pôle rejoint." },
];
