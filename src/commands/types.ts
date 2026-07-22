// Contrat commun de toutes les commandes slash du bot.

import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export interface Commande {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  /** true = vérifier le rôle Staff avant exécution */
  staffUniquement?: boolean;
  execute: (interaction: ChatInputCommandInteraction<"cached">) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction<"cached">) => Promise<void>;
}
