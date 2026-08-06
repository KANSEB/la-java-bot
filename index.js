// Point d'entrée pour les hébergeurs qui lancent « node index.js » sans réglage
// possible (panels Pterodactyl). Le vrai code compilé vit dans dist/, généré
// automatiquement par « npm install » (script postinstall → tsc).
import "./dist/index.js";
